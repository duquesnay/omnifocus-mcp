import * as path from 'path';
import { BaseTool } from '../base.js';
import { CacheManager } from '../../cache/CacheManager.js';
import { ReadSchema, type ReadInput } from './schemas/read-schema.js';
import { QueryCompiler, type CompiledQuery } from './compilers/QueryCompiler.js';
import { buildListTasksScriptV4 } from '../../omnifocus/scripts/tasks.js';
import {
  buildTaskCountScript,
  buildFilteredProjectsScript,
  buildFilteredFoldersScript,
  buildExportTasksScript,
  NOTE_TRUNCATE_LENGTH,
  resolveEffectiveTaskFields,
  resolveEffectiveProjectFields,
  type ExportFilter,
} from '../../contracts/ast/script-builder.js';
import { EXPORT_PROJECTS_SCRIPT } from '../../omnifocus/scripts/export/export-projects.js';
import { isScriptSuccess, isScriptError } from '../../omnifocus/script-result-types.js';
import {
  createTaskResponseV2,
  createListResponseV2,
  createErrorResponseV2,
  createSuccessResponseV2,
  OperationTimerV2,
} from '../../utils/response-format.js';
import type { ExportDataV2 } from '../response-types-v2.js';
import type { TaskFilter, ProjectFilter } from '../../contracts/filters.js';
import {
  augmentFilterForMode,
  getDefaultSort,
  parseTasks,
  sortTasks,
  projectFields,
  scoreForSmartSuggest,
  countTodayCategories,
  type TaskQueryMode,
} from '../tasks/task-query-pipeline.js';
import { buildTagsScript } from '../../contracts/ast/tag-script-builder.js';
import type { TagQueryOptions, TagQueryMode, TagSortBy } from '../../contracts/tag-options.js';
import { LIST_PERSPECTIVES_SCRIPT } from '../../omnifocus/scripts/perspectives/list-perspectives.js';

/**
 * Post-hoc field projection for project query results.
 * Strips project objects to only the requested fields.
 * Always includes 'id' for identity (matching task projectFields behavior).
 *
 * Handles the StandardResponseV2 envelope: projects live at result.data.projects.
 */
export function projectFieldsOnResult(
  result: Record<string, unknown>,
  fields: string[] | undefined,
): Record<string, unknown> {
  if (!fields || fields.length === 0) return result;

  const data = result.data as Record<string, unknown> | undefined;
  if (!data) return result;

  const projects = data.projects as Record<string, unknown>[] | undefined;
  if (!projects || !Array.isArray(projects)) return result;

  const projectOne = (project: Record<string, unknown>) => {
    const out: Record<string, unknown> = { id: project.id };
    for (const field of fields) {
      if (field in project) {
        out[field] = project[field];
      }
    }
    return out;
  };

  const projected = projects.map(projectOne);

  return { ...result, data: { ...data, projects: projected } };
}

// =============================================================================
// TASK QUERY BUILDER
// =============================================================================

type ExportFormat = 'json' | 'csv' | 'markdown';

interface TaskQueryPlan {
  script: string;
  filter: TaskFilter;
  mode: TaskQueryMode | undefined;
  scriptFields: string[];
  limit: number;
  sortedInScript: boolean;
}

/**
 * Determine the fields_mode for metadata reporting.
 */
function resolveFieldsMode(
  userFields: string[] | undefined,
  details: boolean | undefined,
): 'minimal' | 'detailed' | 'explicit' {
  if (userFields && userFields.length > 0) return 'explicit';
  if (details) return 'detailed';
  return 'minimal';
}

/**
 * Build the full task query: resolve mode, augment filters, inject fields, build script.
 */
function buildTaskQuery(compiled: CompiledQuery): TaskQueryPlan & { fieldsMode: 'minimal' | 'detailed' | 'explicit' } {
  const limit = compiled.limit || 25;
  const mode = (compiled.filters.inInbox ? 'inbox' : compiled.mode) as TaskQueryMode | undefined;

  const filter = augmentFilterForMode(mode, compiled.filters, {
    daysAhead: compiled.daysAhead,
  });

  const userExplicitFields = compiled.fields && compiled.fields.length > 0 ? compiled.fields : undefined;
  const fieldsMode = resolveFieldsMode(userExplicitFields, compiled.details);

  // Resolve effective fields: explicit > details=true > MINIMAL_FIELDS
  let scriptFields = resolveEffectiveTaskFields(userExplicitFields, compiled.details);

  // Today mode needs extra fields for category counting
  if (mode === 'today') {
    scriptFields = [...new Set([...scriptFields, 'reason', 'daysOverdue', 'modified'])];
  }

  // Note truncation: apply when not in detail mode
  // Truncate when using minimal fields OR when user explicitly requests note without details=true
  const shouldTruncateNotes = !compiled.details;
  const noteTruncateLength = shouldTruncateNotes ? NOTE_TRUNCATE_LENGTH : undefined;

  // Only pass user-specified sort to the script builder (not mode default sorts).
  // Mode default sorts operate on small, already-filtered sets and stay as post-hoc.
  const userSort = compiled.sort;

  const script = buildListTasksScriptV4({
    filter,
    fields: scriptFields,
    limit,
    offset: compiled.offset,
    mode: mode === 'inbox' ? 'inbox' : undefined,
    sort: userSort,
    noteTruncateLength,
  });

  // Inbox path doesn't pass sort to buildInboxScript, so sort is never applied in-script.
  // Mark sortedInScript false so the post-hoc sort handles it instead.
  const isInboxPath = mode === 'inbox';
  return { script, filter, mode, scriptFields, limit, sortedInScript: !isInboxPath && !!userSort, fieldsMode };
}

export class OmniFocusReadTool extends BaseTool<typeof ReadSchema, unknown> {
  name = 'omnifocus_read';
  description = `Query OmniFocus data with flexible filtering. Returns tasks, projects, tags, perspectives, folders, or exports.

COMMON QUERIES:
- Inbox: { query: { type: "tasks", filters: { project: null } } }
- Overdue: { query: { type: "tasks", mode: "overdue" } }
- Today perspective: { query: { type: "tasks", mode: "today" } }
- Flagged: { query: { type: "tasks", mode: "flagged" } }
- Upcoming (7 days): { query: { type: "tasks", mode: "upcoming", daysAhead: 7 } }
- Smart suggestions: { query: { type: "tasks", mode: "smart_suggest", limit: 10 } }
- Count only (fast): { query: { type: "tasks", filters: { flagged: true }, countOnly: true } }
- Export tasks: { query: { type: "export", exportType: "tasks", format: "json" } }

MODES (use instead of manual filters when possible):
- today: Due soon (≤3 days) OR flagged, matching OmniFocus Today perspective
- overdue: Tasks past their due date
- flagged: Flagged tasks
- upcoming: Tasks due in next N days (set daysAhead, default 14)
- inbox, available, blocked, search, smart_suggest, all

FILTER OPERATORS:
- tags: { any: [...] } (has any), { all: [...] } (has all), { none: [...] } (has none)
- dates (dueDate, deferDate, plannedDate, added): { before: "YYYY-MM-DD" }, { after: "..." }, { between: ["...", "..."] }
- text: { contains: "..." }, { matches: "regex" }
- boolean: flagged, blocked, available, inInbox
- logic: { OR: [...] }, { AND: [...] }, { NOT: {...} }

RESPONSE CONTROL:
- Default returns minimal fields (id, name, flagged, completed, dueDate, deferDate, tags, project, available)
- details: true returns all fields with full notes
- fields: [...] returns exactly those fields (note truncated to 200 chars unless details: true)
- ID lookup always returns all fields with full notes
- fields (tasks): id, name, completed, flagged, blocked, available, estimatedMinutes, dueDate, deferDate, plannedDate, completionDate, added, modified, dropDate, note, projectId, project, tags, repetitionRule, parentTaskId, parentTaskName, inInbox
- fields (projects): id, name, status, flagged, note, dueDate, deferDate, completedDate, folder, folderPath, folderId, sequential, lastReviewDate, nextReviewDate, defaultSingletonActionHolder
- sort: [{ field: "dueDate", direction: "asc" }]
- limit/offset: Pagination (default limit: 25, max: 500)
- countOnly: true returns only count (33x faster for "how many" questions) — tasks only

COMPLETED TASKS:
- Task queries: Use filters: { status: "completed" } or filters: { completed: true }
- Export only: includeCompleted parameter applies to export operations, not task queries

PERFORMANCE:
- Use countOnly for counting questions
- Use fields to select only needed data
- Use modes instead of raw filters when available
- Default queries are token-efficient (9 fields, no notes)`;

  schema = ReadSchema;

  /**
   * Hand-crafted minimal JSON Schema for MCP tool advertisement.
   *
   * The auto-generated schema from zodToJsonSchema() is ~22 KB due to
   * discriminatedUnion duplicating filters across 6 query type branches.
   * This minimal version is ~1 KB (~5K tokens saved per interaction turn).
   *
   * Server-side validation still uses the full Zod ReadSchema — this only controls
   * what the MCP tools/list response advertises to LLM clients.
   */
  override get inputSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['tasks', 'projects', 'tags', 'perspectives', 'folders', 'export'],
            },
            mode: {
              type: 'string',
              enum: [
                'all',
                'inbox',
                'search',
                'overdue',
                'today',
                'upcoming',
                'available',
                'blocked',
                'flagged',
                'smart_suggest',
              ],
            },
            filters: { type: 'object' },
            sort: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  direction: { type: 'string', enum: ['asc', 'desc'] },
                },
              },
            },
            fields: { type: 'array', items: { type: 'string' } },
            limit: { type: 'number' },
            offset: { type: 'number' },
            countOnly: { type: 'boolean' },
            fastSearch: { type: 'boolean' },
            daysAhead: { type: 'number' },
            details: { type: 'boolean' },
            includeStats: { type: 'boolean' },
            exportType: { type: 'string', enum: ['tasks', 'projects', 'all'] },
            format: { type: 'string', enum: ['json', 'csv', 'markdown'] },
            exportFields: { type: 'array', items: { type: 'string' } },
            outputDirectory: { type: 'string' },
            includeCompleted: {
              type: 'boolean',
              description: 'Export only. For task queries use filters: { status: "completed" }',
            },
          },
          required: ['type'],
        },
      },
      required: ['query'],
    };
  }
  meta = {
    category: 'Utility' as const,
    stability: 'stable' as const,
    complexity: 'moderate' as const,
    performanceClass: 'fast' as const,
    tags: ['unified', 'read', 'query', 'export'],
    capabilities: ['tasks', 'projects', 'tags', 'perspectives', 'folders', 'smart_suggest', 'export'],
  };

  annotations = {
    title: 'Query OmniFocus Data',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  };

  private compiler: QueryCompiler;

  constructor(cache: CacheManager) {
    super(cache);
    this.compiler = new QueryCompiler();
  }

  async executeValidated(args: ReadInput): Promise<unknown> {
    const compiled = this.compiler.compile(args);

    // Dispatch to handler based on query type
    switch (compiled.type) {
      case 'tasks':
        return this.handleTaskQuery(compiled);
      case 'projects':
        return this.handleProjectQuery(compiled);
      case 'tags':
        return this.handleTagQuery(compiled);
      case 'perspectives':
        return this.handlePerspectiveQuery(compiled);
      case 'folders':
        return this.handleFolderQuery(compiled);
      case 'export':
        return this.handleExport(compiled);
      default: {
        // Exhaustiveness check
        const _exhaustive: never = compiled.type;
        throw new Error(`Unsupported query type: ${String(_exhaustive)}`);
      }
    }
  }

  private async handleTaskQuery(compiled: CompiledQuery): Promise<unknown> {
    const timer = new OperationTimerV2();
    const { script, filter, mode, limit, sortedInScript, fieldsMode } = buildTaskQuery(compiled);

    // --- Count-only fast path ---
    if (compiled.countOnly) {
      return this.executeCountOnly(filter, mode, timer);
    }

    // --- ID lookup fast path (always full detail) ---
    if (filter.id) {
      return this.executeIdLookup(filter, compiled.fields, timer);
    }

    // --- Execute main query ---
    const result = await this.execJson(script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'tasks',
        'SCRIPT_ERROR',
        `Failed to get tasks (mode: ${mode || 'all'})`,
        'Check if OmniFocus is running',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    const data = result.data as {
      tasks?: unknown[];
      items?: unknown[];
      metadata?: { total_matched?: number; sorted_in_script?: boolean };
    };
    let tasks = parseTasks(data.tasks || data.items || []);
    const totalMatched = data.metadata?.total_matched;

    // Smart suggest: score and rank
    if (mode === 'smart_suggest') {
      tasks = scoreForSmartSuggest(tasks, limit);
    }

    // Sort: skip post-hoc sort when sort was already applied in-script.
    // User-specified sorts are embedded in OmniJS (sort-before-limit fix).
    // Mode default sorts (e.g., overdue -> dueDate asc) stay as post-hoc
    // since they operate on small, already-filtered result sets.
    const sortOptions = sortedInScript ? undefined : compiled.sort || getDefaultSort(mode as TaskQueryMode);
    if (sortOptions) {
      tasks = sortTasks(tasks, sortOptions as import('../tasks/filter-types.js').SortOption[]);
    }

    // Build metadata
    const metadata: Partial<import('../../utils/response-format.js').StandardMetadataV2> = {
      ...timer.toMetadata(),
      from_cache: false,
      mode: mode || 'all',
      offset: compiled.offset || 0,
      sort_applied: sortedInScript || !!sortOptions,
      fields_mode: fieldsMode,
      ...(totalMatched !== undefined ? { total_matched: totalMatched } : {}),
    };

    // Today mode: count categories BEFORE field projection
    if (mode === 'today') {
      const counts = countTodayCategories(tasks);
      metadata.due_soon_days = compiled.daysAhead || 3;
      metadata.overdue_count = counts.overdueCount;
      metadata.due_soon_count = counts.dueSoonCount;
      metadata.flagged_count = counts.flaggedCount;
    }

    // Project fields (after counting)
    tasks = projectFields(tasks, compiled.fields);

    return createTaskResponseV2('tasks', tasks, metadata);
  }

  private async executeCountOnly(
    filter: TaskFilter,
    mode: TaskQueryMode | undefined,
    timer: OperationTimerV2,
  ): Promise<unknown> {
    // Ensure inbox mode sets the inInbox filter (mode: "inbox" is not in
    // MODE_DEFINITIONS, so augmentFilterForMode passes through unchanged)
    const countFilter = { ...filter };
    if (mode === 'inbox' && !countFilter.inInbox) {
      countFilter.inInbox = true;
    }

    const { script } = buildTaskCountScript(countFilter, { maxScan: 10000 });
    const result = await this.execJson(script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'tasks',
        'SCRIPT_ERROR',
        'Failed to count tasks',
        'Check if OmniFocus is running and filters are valid',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    const data = result.data as {
      count?: number;
      warning?: string;
      optimization?: string;
      filter_description?: string;
    };
    const count = data.count ?? 0;
    const response = createTaskResponseV2('tasks', [], {
      ...timer.toMetadata(),
      from_cache: false,
      mode: mode || 'count_only',
      count_only: true,
      total_count: count,
      filters_applied: countFilter as unknown as Record<string, unknown>,
      optimization: data.optimization || 'ast_omnijs_bridge',
      filter_description: data.filter_description,
      warning: data.warning,
    });

    // Override summary total_count with actual count from JXA
    // (generateTaskSummary receives [] for countOnly, producing total_count: 0)
    if (response.summary && 'total_count' in response.summary) {
      (response.summary as { total_count: number }).total_count = count;
    }

    return response;
  }

  private async executeIdLookup(
    filter: TaskFilter,
    fields: string[] | undefined,
    timer: OperationTimerV2,
  ): Promise<unknown> {
    // ID lookup is a detail view — always use full fields, no truncation
    const idFields = resolveEffectiveTaskFields(fields, true);
    const script = buildListTasksScriptV4({
      filter,
      fields: idFields,
      limit: 1,
    });
    const result = await this.execJson(script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'tasks',
        'SCRIPT_ERROR',
        `Failed to find task with ID: ${filter.id}`,
        'Verify the task ID is correct and the task exists',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    const data = result.data as { tasks?: unknown[]; items?: unknown[] };
    const tasks = parseTasks(data.tasks || data.items || []);

    if (tasks.length === 0) {
      return createErrorResponseV2(
        'tasks',
        'NOT_FOUND',
        `Task not found with ID: ${filter.id}`,
        'Verify the task ID is correct and the task exists',
        undefined,
        timer.toMetadata(),
      );
    }

    if (tasks[0].id !== filter.id) {
      return createErrorResponseV2(
        'tasks',
        'ID_MISMATCH',
        `Task ID mismatch: requested ${filter.id}, received ${tasks[0].id}`,
        'This indicates a potential issue with the OmniFocus script - please report this bug',
        undefined,
        timer.toMetadata(),
      );
    }

    const projectedTasks = projectFields(tasks, fields);
    return createTaskResponseV2('tasks', projectedTasks, {
      ...timer.toMetadata(),
      from_cache: false,
      mode: 'id_lookup',
      sort_applied: false,
    });
  }

  private async handleProjectQuery(compiled: CompiledQuery): Promise<unknown> {
    const timer = new OperationTimerV2();
    const limit = compiled.limit || 25;
    const includeStats = compiled.includeStats ?? false;

    // Resolve effective project fields
    const userExplicitFields = compiled.fields && compiled.fields.length > 0 ? compiled.fields : undefined;
    const effectiveFields = resolveEffectiveProjectFields(userExplicitFields, compiled.details);

    // Build ProjectFilter from compiled query
    const projectFilter: ProjectFilter = {};

    // Map status filter (QueryCompiler puts status info into filters.completed)
    // The read schema doesn't have a direct status field for projects —
    // status filtering comes through the compiled filters
    if (compiled.filters.projectStatus) {
      projectFilter.status = compiled.filters.projectStatus;
    }
    if (compiled.filters.folder) {
      projectFilter.folderName = compiled.filters.folder;
    }
    if (compiled.filters.search) {
      projectFilter.text = compiled.filters.search;
    }

    // Build cache key
    const cacheParams = { ...projectFilter, limit, includeStats };
    const cacheKey = `projects_list_${JSON.stringify(cacheParams)}`;

    // Check cache
    const cached = this.cache.get<{ projects: unknown[] }>('projects', cacheKey);
    if (cached) {
      const cacheResult = createListResponseV2('projects', cached.projects, 'projects', {
        ...timer.toMetadata(),
        from_cache: true,
        operation: 'list',
      }) as unknown as Record<string, unknown>;

      // Post-hoc field projection (always applied for thin-by-default)
      return projectFieldsOnResult(cacheResult, effectiveFields);
    }

    // Execute query using AST-powered script builder
    const generatedScript = buildFilteredProjectsScript(projectFilter, {
      limit,
      includeStats,
      performanceMode: includeStats ? 'normal' : 'lite',
    });

    const result = await this.execJson(generatedScript.script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'projects',
        'SCRIPT_ERROR',
        (isScriptError(result) ? result.error : null) || 'Failed to query projects',
        'Check if OmniFocus is running',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    // Parse dates and cache
    const resultData = result.data as { projects?: unknown[]; items?: unknown[] };
    const projects = this.parseProjects(resultData.projects || resultData.items || result.data);
    this.cache.set('projects', cacheKey, { projects });

    const listResult = createListResponseV2('projects', projects, 'projects', {
      ...timer.toMetadata(),
      from_cache: false,
      operation: 'list',
    }) as unknown as Record<string, unknown>;

    // Post-hoc field projection (always applied for thin-by-default)
    return projectFieldsOnResult(listResult, effectiveFields);
  }

  /**
   * Parse raw project data, converting date strings to Date objects.
   */
  private parseProjects(projects: unknown): unknown[] {
    if (!Array.isArray(projects)) return [];

    return projects.map((project: unknown) => {
      const projectRecord = project as Record<string, unknown>;
      return {
        ...projectRecord,
        dueDate: projectRecord.dueDate ? new Date(projectRecord.dueDate as string) : undefined,
        completionDate: projectRecord.completionDate ? new Date(projectRecord.completionDate as string) : undefined,
        nextReviewDate: projectRecord.nextReviewDate ? new Date(projectRecord.nextReviewDate as string) : undefined,
        lastReviewDate: projectRecord.lastReviewDate ? new Date(projectRecord.lastReviewDate as string) : undefined,
      };
    });
  }

  private async handleTagQuery(_compiled: CompiledQuery): Promise<unknown> {
    const timer = new OperationTimerV2();

    // Check cache
    const cacheKey = 'list:name:true:false:false:true:false';
    const cached = this.cache.get<{
      tags?: unknown[];
      items?: unknown[];
      count?: number;
    }>('tags', cacheKey);
    if (cached) {
      return cached;
    }

    // Build and execute AST-powered tag list script (basic mode, defaults)
    const tagOptions: TagQueryOptions = {
      mode: 'basic' as TagQueryMode,
      includeEmpty: true,
      sortBy: 'name' as TagSortBy,
    };
    const generatedScript = buildTagsScript(tagOptions);
    const result = await this.execJson(generatedScript.script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'tags',
        'SCRIPT_ERROR',
        (isScriptError(result) ? result.error : null) || 'Failed to list tags',
        'Check OmniFocus is running',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    // Unwrap AST envelope: {ok: true, v: "ast", items: [...], summary: {...}}
    const envelope = result.data as { ok?: boolean; v?: string; items?: unknown[]; summary?: { total?: number } };
    const items = envelope.items || [];
    const total = envelope.summary?.total ?? items.length;

    const response = createListResponseV2('tags', items, 'tags', {
      ...timer.toMetadata(),
      total,
      operation: 'list',
      mode: 'ast_unified',
    });

    // Cache the result
    this.cache.set('tags', cacheKey, response);
    return response;
  }

  private async handlePerspectiveQuery(_compiled: CompiledQuery): Promise<unknown> {
    const timer = new OperationTimerV2();

    try {
      const script = this.omniAutomation.buildScript(LIST_PERSPECTIVES_SCRIPT, {});
      const result = await this.execJson(script);

      if (!isScriptSuccess(result)) {
        return createErrorResponseV2(
          'perspectives',
          'SCRIPT_ERROR',
          (isScriptError(result) ? result.error : null) || 'Failed to list perspectives',
          'Check if OmniFocus is running',
          isScriptError(result) ? result.details : undefined,
          timer.toMetadata(),
        );
      }

      // Parse the result - handle both perspectives and items properties
      const parsedResult = result.data as {
        perspectives?: Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
        metadata?: Record<string, unknown>;
      };

      const perspectives = parsedResult.perspectives || parsedResult.items || [];

      // Sort perspectives by name
      perspectives.sort((a, b) => {
        const nameA = (a.name as string) || '';
        const nameB = (b.name as string) || '';
        return nameA.localeCompare(nameB);
      });

      return createSuccessResponseV2('perspectives', { perspectives }, undefined, {
        ...timer.toMetadata(),
        ...parsedResult.metadata,
        operation: 'list',
      });
    } catch (error) {
      return createErrorResponseV2(
        'perspectives',
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        { operation: 'list' },
        timer.toMetadata(),
      );
    }
  }

  private async handleFolderQuery(_compiled: CompiledQuery): Promise<unknown> {
    const timer = new OperationTimerV2();

    // Check cache first
    const cacheKey = 'folders_list_basic';
    const cached = this.cache.get<{ folders: unknown[] }>('folders', cacheKey);
    if (cached) {
      return createSuccessResponseV2('folders', { folders: cached.folders }, undefined, {
        ...timer.toMetadata(),
        operation: 'list',
        from_cache: true,
      });
    }

    // Build and execute AST-generated folder list script
    const { script } = buildFilteredFoldersScript({ limit: 100 });
    const result = await this.execJson(script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'folders',
        'SCRIPT_ERROR',
        (isScriptError(result) ? result.error : null) || 'Failed to query folders',
        'Check if OmniFocus is running',
        isScriptError(result) ? result.details : undefined,
        timer.toMetadata(),
      );
    }

    const resultData = result.data as { folders?: unknown[]; items?: unknown[] };
    const folders = resultData.folders || resultData.items || [];

    // Cache for 5 minutes (folders change infrequently)
    this.cache.set('folders', cacheKey, { folders });

    return createSuccessResponseV2('folders', { folders }, undefined, {
      ...timer.toMetadata(),
      operation: 'list',
      total_folders: folders.length,
    });
  }

  // =============================================================================
  // EXPORT (inlined from ExportTool)
  // =============================================================================

  private async handleExport(compiled: CompiledQuery): Promise<unknown> {
    const exportType = compiled.exportType || 'tasks';
    const format = (compiled.format || 'json') as ExportFormat;
    const timer = new OperationTimerV2();

    try {
      switch (exportType) {
        case 'tasks':
          return await this.handleTaskExport(compiled, format, timer);
        case 'projects':
          return await this.handleProjectExport(format, compiled.includeStats ?? false, timer);
        case 'all':
          return await this.handleBulkExport(compiled, format, timer);
        default:
          return createErrorResponseV2(
            'export',
            'INVALID_TYPE',
            `Invalid export type: ${String(exportType)}`,
            undefined,
            { type: exportType },
            timer.toMetadata(),
          );
      }
    } catch (error) {
      return this.handleErrorV2<ExportDataV2>(error);
    }
  }

  private async handleTaskExport(
    compiled: CompiledQuery,
    format: ExportFormat,
    timer: OperationTimerV2,
  ): Promise<unknown> {
    // Build ExportFilter from compiled query filters
    const exportFilter: ExportFilter = {
      available: compiled.filters.available,
      completed: compiled.filters.completed,
      flagged: compiled.filters.flagged,
      project: undefined, // export filter uses project name, not in compiled.filters
      projectId: compiled.filters.projectId,
      tags: compiled.filters.tags,
      tagsOperator: compiled.filters.tagsOperator as ExportFilter['tagsOperator'],
      search: compiled.filters.search,
    };
    const limit = compiled.limit || 1000;

    const { script } = buildExportTasksScript(exportFilter, {
      limit,
      fields: compiled.exportFields,
      format,
    });

    const result = await this.execJson(script);

    if (isScriptError(result)) {
      return createErrorResponseV2(
        'export',
        'TASK_EXPORT_FAILED',
        result.error || 'Failed to export tasks',
        undefined,
        { format, filter: exportFilter },
        timer.toMetadata(),
      );
    }

    if (isScriptSuccess(result)) {
      const data = result.data as { format: string; data: unknown; count: number };
      return createSuccessResponseV2(
        'export',
        {
          format: data.format as ExportFormat,
          exportType: 'tasks' as const,
          data: data.data as string | object,
          count: data.count,
        },
        undefined,
        { ...timer.toMetadata(), operation: 'tasks' },
      );
    }

    return createErrorResponseV2(
      'export',
      'UNEXPECTED_RESULT',
      'Unexpected script result format',
      undefined,
      { result },
      timer.toMetadata(),
    );
  }

  private async handleProjectExport(
    format: ExportFormat,
    includeStats: boolean,
    timer: OperationTimerV2,
  ): Promise<unknown> {
    const script = this.omniAutomation.buildScript(EXPORT_PROJECTS_SCRIPT, {
      format,
      includeStats,
    });
    const result = await this.execJson(script);

    if (isScriptError(result)) {
      return createErrorResponseV2(
        'export',
        'SCRIPT_ERROR',
        result.error || 'Script error during project export',
        'Check error details',
        result.details,
        timer.toMetadata(),
      );
    }

    if (isScriptSuccess(result)) {
      const data = result.data as { format: string; data: unknown; count: number };
      return createSuccessResponseV2(
        'export',
        {
          format: data.format as ExportFormat,
          exportType: 'projects' as const,
          data: data.data as string | object,
          count: data.count,
          includeStats,
        },
        undefined,
        { ...timer.toMetadata(), operation: 'projects' },
      );
    }

    return createErrorResponseV2(
      'export',
      'UNEXPECTED_RESULT',
      'Unexpected script result format',
      undefined,
      { result },
      timer.toMetadata(),
    );
  }

  private async handleBulkExport(
    compiled: CompiledQuery,
    format: ExportFormat,
    timer: OperationTimerV2,
  ): Promise<unknown> {
    const outputDirectory = compiled.outputDirectory;
    if (!outputDirectory) {
      return createErrorResponseV2(
        'export',
        'MISSING_PARAMETER',
        'outputDirectory is required for type="all"',
        undefined,
        { type: 'all' },
        timer.toMetadata(),
      );
    }

    const includeCompleted = compiled.includeCompleted ?? true;
    const includeProjectStats = compiled.includeStats ?? true;

    // Ensure directory exists
    try {
      const fsSync = await import('fs');
      fsSync.mkdirSync(outputDirectory, { recursive: true });
    } catch (mkdirError) {
      return createErrorResponseV2(
        'export',
        'MKDIR_FAILED',
        `Failed to create directory: ${String(mkdirError)}`,
        undefined,
        { outputDirectory, error: String(mkdirError) },
        timer.toMetadata(),
      );
    }

    const exports: Record<
      string,
      {
        format: string;
        task_count?: number;
        project_count?: number;
        tag_count?: number;
        exported: boolean;
      }
    > = {};
    let totalExported = 0;

    // Export tasks using AST-powered script
    const taskExportFilter: ExportFilter = includeCompleted ? {} : { completed: false };
    const { script: taskScript } = buildExportTasksScript(taskExportFilter, {
      format,
      limit: 5000,
    });
    const taskResult = await this.execJson(taskScript);

    if (isScriptSuccess(taskResult)) {
      const taskData = taskResult.data as { data?: unknown; count?: number };
      const taskFile = path.join(outputDirectory, `tasks.${format}`);
      const taskCount = taskData.count || 0;

      const payload = taskData.data;
      const toWrite = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      const fsSync = await import('fs');
      fsSync.writeFileSync(taskFile, toWrite, 'utf-8');

      exports.tasks = { format, task_count: taskCount, exported: true };
      totalExported += taskCount;
    }

    // Export projects
    const projectScript = this.omniAutomation.buildScript(EXPORT_PROJECTS_SCRIPT, {
      format,
      includeStats: includeProjectStats,
    });
    const projectResult = await this.execJson(projectScript);

    if (isScriptSuccess(projectResult)) {
      const projData = projectResult.data as { data?: unknown; count?: number };
      const projectFile = path.join(outputDirectory, `projects.${format}`);
      const projectCount = projData.count || 0;

      const ppayload = projData.data;
      const pwrite = typeof ppayload === 'string' ? ppayload : JSON.stringify(ppayload, null, 2);
      const fsSync = await import('fs');
      fsSync.writeFileSync(projectFile, pwrite, 'utf-8');

      exports.projects = { format, project_count: projectCount, exported: true };
      totalExported += projectCount;
    }

    // Export tags (JSON only) via AST builder
    const tagGeneratedScript = buildTagsScript({
      mode: 'basic' as TagQueryMode,
      includeEmpty: true,
      sortBy: 'name' as TagSortBy,
    });
    const tagResult = await this.execJson(tagGeneratedScript.script);

    if (isScriptSuccess(tagResult)) {
      const tagEnvelope = tagResult.data as { items?: unknown[]; summary?: { total?: number } };
      const tagItems = tagEnvelope.items || [];
      const tagCount = tagEnvelope.summary?.total ?? tagItems.length;
      const tagFile = path.join(outputDirectory, 'tags.json');

      const fsSync = await import('fs');
      fsSync.writeFileSync(tagFile, JSON.stringify(tagItems, null, 2), 'utf-8');

      exports.tags = { format: 'json', tag_count: tagCount, exported: true };
      totalExported += tagCount;
    }

    return createSuccessResponseV2(
      'export',
      {
        format,
        exportType: 'bulk' as const,
        data: exports,
        count: totalExported,
        exports,
        summary: { totalExported, export_date: new Date().toISOString() },
      },
      undefined,
      { ...timer.toMetadata(), operation: 'all' },
    );
  }
}
