import { BaseTool } from '../base.js';
import { CacheManager } from '../../cache/CacheManager.js';
import { WriteSchema, type WriteInput } from './schemas/write-schema.js';
import { MutationCompiler, type CompiledMutation } from './compilers/MutationCompiler.js';
import { TempIdResolver } from './utils/tempid-resolver.js';
import { DependencyGraph, DependencyGraphError } from './utils/dependency-graph.js';
import type { BatchItem } from './schemas/batch-schemas.js';
import { MANAGE_TAGS_SCRIPT } from '../../omnifocus/scripts/tags/manage-tags.js';
import { createSuccessResponseV2, createErrorResponseV2, OperationTimerV2 } from '../../utils/response-format.js';
import { TaskId } from '../../utils/branded-types.js';
import {
  buildUpdateProjectScript,
  buildCreateProjectScript,
  buildCreateFolderScript,
  buildCompleteScript,
  buildDeleteScript,
  buildCreateTaskScript,
  buildUpdateTaskScript,
  markProjectAsValidated,
  markTaskAsValidated,
} from '../../contracts/ast/mutation-script-builder.js';
import type {
  ProjectUpdateData,
  ProjectCreateData,
  FolderCreateData,
  RepetitionRule,
  TaskCreateData,
} from '../../contracts/mutations.js';
import { isScriptError, isScriptSuccess } from '../../omnifocus/script-result-types.js';
import type { ScriptExecutionResult, TaskCreationArgs } from '../../omnifocus/script-response-types.js';
import type { TaskOperationDataV2 } from '../response-types-v2.js';
import { COMPLETE_TASK_SCRIPT, DELETE_TASK_SCRIPT, BULK_DELETE_TASKS_SCRIPT } from '../../omnifocus/scripts/tasks.js';
import { localToUTC } from '../../utils/timezone.js';
import { parsingError, formatErrorWithRecovery, invalidDateError } from '../../utils/error-messages.js';
import { sanitizeTaskUpdates } from './utils/task-sanitizer.js';
import type { TaskOperationResult } from '../../omnifocus/script-response-types.js';
import { flattenBatchResults } from './batch-response-flatten.js';

// Convert string IDs to branded types for type safety (compile-time only, no runtime validation)
const convertToTaskId = (id: string): TaskId => id as TaskId;

/**
 * Unwrap v3 envelope format if present.
 * Scripts return: {ok: true, v: "3", data: {...}}
 * After extracting .data we get the envelope; this unwraps to the inner data.
 */
function unwrapV3Envelope(result: unknown): unknown {
  if (result && typeof result === 'object') {
    const envelope = result as { ok?: boolean; v?: string; data?: unknown };
    if (envelope.ok === true && envelope.v === '3' && envelope.data !== undefined) {
      return envelope.data;
    }
  }
  return result;
}

/**
 * Build recovery suggestions based on error message content from task creation failures.
 */
function buildCreateErrorRecovery(errorMessage: string): string[] {
  if (errorMessage.toLowerCase().includes('project')) {
    return ['Use list_projects to find valid project IDs', 'Ensure the project exists and is not completed'];
  } else if (errorMessage.toLowerCase().includes('parent')) {
    return ['Use list_tasks to find valid parent task IDs', 'Ensure the parent task exists and can have subtasks'];
  }
  return ['Check that all required parameters are provided', 'Verify OmniFocus is running and not showing dialogs'];
}

interface BatchItemCreationResult {
  tempId: string;
  realId: string | null;
  success: boolean;
  error?: string;
  type: 'project' | 'task';
}

export class OmniFocusWriteTool extends BaseTool<typeof WriteSchema, unknown> {
  name = 'omnifocus_write';
  description = `Create, update, complete, or delete OmniFocus tasks and projects.

OPERATIONS:
- create: New task/project with data
- create_folder: New folder (name required, optional parentFolder for nesting)
- update: Modify existing (provide id + changes)
- complete: Mark done (provide id)
- delete: Remove permanently (provide id)
- batch: Multiple operations in one call
- bulk_delete: Delete multiple items by IDs
- tag_manage: Manage tag hierarchy (create, rename, delete, merge, nest, unnest, reparent)

FOLDER CREATION:
- operation: "create_folder"
- data.name: Folder name (required)
- data.parentFolder: Parent folder name, path ("Parent : Child"), or ID (optional, omit for top-level)
- Supports nested path lookup with " : " syntax (parent must already exist)

BATCH OPERATIONS:
- operations: Array of create, update, complete, and delete operations
- Execution order: creates first, then updates, completes, deletes last
- tempId: Optional for creates (auto-generated if not provided)
- parentTempId: Reference parent by tempId for hierarchies
- Updates/completes can reference tempIds from creates in the same batch
- createSequentially: true (respects dependencies)
- returnMapping: true (returns tempId → realId map)
- stopOnError: true (halt on first failure)

BATCH SUBTASK EXAMPLE:
{ "mutation": { "operation": "batch", "operations": [
  { "operation": "create", "target": "task", "data": { "name": "Parent", "tempId": "p1", "project": "My Project" } },
  { "operation": "create", "target": "task", "data": { "name": "Child", "tempId": "c1", "parentTempId": "p1" } }
] } }

TAG OPERATIONS:
- tags: [...] - Replace all tags
- addTags: [...] - Add to existing
- removeTags: [...] - Remove from existing
- Nested tags use " : " path syntax: "Parent : Child : Leaf" (creates hierarchy, assigns leaf)

TAG MANAGEMENT (tag_manage operation):
- create: Create new tag (tagName required). Supports " : " path syntax for nested hierarchies.
- rename: Rename tag (tagName + newName required)
- delete: Delete tag (tagName required)
- merge: Merge source into target (tagName + targetTag required)
- nest: Move tag under parent (tagName + parentTag required)
- unnest: Move tag to root level (tagName required)
- reparent: Move tag to different parent (tagName + parentTag required)

DATE FORMATS:
- Date only: "YYYY-MM-DD" (defaults: due=5pm, defer=8am, planned=8am)
- Date+time: "YYYY-MM-DD HH:mm" (local time)
- Clear date: null or clearDueDate/clearDeferDate/clearPlannedDate: true

MOVE TO INBOX: Set project: null

REPETITION RULES (in data.repetitionRule):
- frequency: "daily"|"weekly"|"monthly"|"yearly" (required)
- interval: number (default 1)
- method: "fixed"|"due-after-completion"|"defer-after-completion" (default "fixed")
- daysOfWeek: [{ day: "SU"|"MO"|"TU"|"WE"|"TH"|"FR"|"SA", position?: number }] (for weekly)
- daysOfMonth: [1-31] (for monthly, -1 = last day)

SAFETY:
- Delete is permanent - confirm with user first
- Batch supports up to 100 operations`;

  schema = WriteSchema;

  /**
   * Hand-crafted minimal JSON Schema for MCP tool advertisement.
   *
   * The auto-generated schema is ~9.3KB due to discriminatedUnion expanding
   * 7 operation branches (each with full repetitionRule, data/changes objects).
   * repetitionRule alone appears 3× (create data, update changes, batch create).
   *
   * This flat schema advertises all operations and fields without branch
   * duplication. Server-side Zod validation (WriteSchema) still enforces
   * the full discriminated union with strict field types.
   */
  override get inputSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        mutation: {
          type: 'object',
          properties: {
            // Discriminator
            operation: {
              type: 'string',
              enum: ['create', 'create_folder', 'update', 'complete', 'delete', 'batch', 'bulk_delete', 'tag_manage'],
            },
            target: { type: 'string', enum: ['task', 'project'] },

            // create/update shared
            data: { type: 'object' },
            changes: { type: 'object' },
            id: { type: 'string' },
            minimalResponse: { type: 'boolean' },

            // complete
            completionDate: { type: 'string' },

            // batch
            operations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  operation: { type: 'string', enum: ['create', 'update', 'complete', 'delete'] },
                  target: { type: 'string', enum: ['task', 'project'] },
                  data: { type: 'object' },
                  changes: { type: 'object' },
                  id: { type: 'string' },
                  completionDate: { type: 'string' },
                },
                required: ['operation', 'target'],
              },
            },
            createSequentially: { type: 'boolean' },
            returnMapping: { type: 'boolean' },
            stopOnError: { type: 'boolean' },
            atomicOperation: { type: 'boolean' },
            dryRun: { type: 'boolean' },

            // bulk_delete
            ids: { type: 'array', items: { type: 'string' } },

            // tag_manage
            action: {
              type: 'string',
              enum: ['create', 'rename', 'delete', 'merge', 'nest', 'unnest', 'reparent'],
            },
            tagName: { type: 'string', description: 'The tag name to operate on' },
            newName: { type: 'string', description: 'New name for rename action' },
            targetTag: { type: 'string', description: 'Target tag for merge action' },
            parentTag: { type: 'string', description: 'Parent tag name for nest/reparent actions' },
          },
          required: ['operation'],
        },
      },
      required: ['mutation'],
    };
  }

  meta = {
    category: 'Task Management' as const,
    stability: 'stable' as const,
    complexity: 'moderate' as const,
    performanceClass: 'fast' as const,
    tags: ['unified', 'write', 'mutations', 'tags'],
    capabilities: ['create', 'update', 'complete', 'delete', 'batch', 'tag_manage'],
  };

  annotations = {
    title: 'Manage OmniFocus Tasks',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  };

  private compiler: MutationCompiler;

  constructor(cache: CacheManager) {
    super(cache);
    this.compiler = new MutationCompiler();
  }

  async executeValidated(args: WriteInput): Promise<unknown> {
    const compiled = this.compiler.compile(args);

    // Tag management operations
    if (compiled.operation === 'tag_manage') {
      return this.handleTagManage(compiled);
    }

    // Folder creation
    if (compiled.operation === 'create_folder') {
      return this.handleFolderCreate(compiled);
    }

    // Handle dry-run for batch operations
    if (compiled.operation === 'batch' && compiled.dryRun) {
      return this.previewBatch(compiled);
    }

    // Handle dry-run for bulk_delete
    if (compiled.operation === 'bulk_delete' && compiled.dryRun) {
      return this.previewBulkDelete(compiled);
    }

    // Route to batch tool if batch operation
    if (compiled.operation === 'batch') {
      return this.routeToBatch(compiled);
    }

    // Route bulk_delete — direct execution for tasks, delegate for projects
    if (compiled.operation === 'bulk_delete') {
      return this.handleBulkDelete(compiled);
    }

    // Route based on target: task vs project
    if (compiled.target === 'project') {
      return this.handleProjectOperation(compiled);
    }

    // Route task operations to inline handlers
    let taskResult: unknown;
    try {
      switch (compiled.operation) {
        case 'create':
          taskResult = await this.handleTaskCreate(compiled);
          break;
        case 'update':
          taskResult = await this.handleTaskUpdate(compiled);
          break;
        case 'complete':
          taskResult = await this.handleTaskComplete(compiled);
          break;
        case 'delete':
          taskResult = await this.handleTaskDelete(compiled);
          break;
        default:
          return createErrorResponseV2(
            'omnifocus_write',
            'INVALID_OPERATION',
            `Invalid task operation: ${String((compiled as { operation: string }).operation)}`,
            undefined,
            { operation: (compiled as { operation: string }).operation },
            new OperationTimerV2().toMetadata(),
          );
      }

      const isSuccess = taskResult && typeof taskResult === 'object' && (taskResult as { success?: boolean }).success;
      return this.formatForCLI(taskResult, compiled.operation, isSuccess ? 'success' : 'error');
    } catch (error) {
      const errorResult = this.handleErrorV2<TaskOperationDataV2>(error);
      return this.formatForCLI(errorResult, compiled.operation, 'error');
    }
  }

  // ─── Task Create ────────────────────────────────────────────────────

  private async handleTaskCreate(compiled: Extract<CompiledMutation, { operation: 'create' }>): Promise<unknown> {
    const timer = new OperationTimerV2();
    const data = compiled.data;

    // Build creation args, filtering out null/undefined values
    const createArgs: Partial<TaskCreationArgs> = { name: data.name };
    if (data.note) createArgs.note = data.note;
    if (data.project !== undefined && data.project !== null) {
      createArgs.projectId = data.project;
    }
    if (data.parentTaskId) createArgs.parentTaskId = data.parentTaskId;
    if (data.dueDate) createArgs.dueDate = data.dueDate;
    if (data.deferDate) createArgs.deferDate = data.deferDate;
    if (data.plannedDate) createArgs.plannedDate = data.plannedDate;
    if (data.flagged !== undefined) createArgs.flagged = data.flagged;
    if (data.estimatedMinutes !== undefined) createArgs.estimatedMinutes = data.estimatedMinutes;
    if (data.tags) createArgs.tags = data.tags;
    if (data.sequential !== undefined) createArgs.sequential = data.sequential;

    // Handle repetition rules - prefer unified API format (repetitionRule) over legacy format
    let repetitionRuleForCreate: RepetitionRule | undefined;
    if (data.repetitionRule && typeof data.repetitionRule === 'object') {
      repetitionRuleForCreate = data.repetitionRule as RepetitionRule;
      this.logger.debug('Using unified API repetitionRule for creation', {
        repetitionRule: repetitionRuleForCreate,
      });
    }

    // Convert local dates to UTC for OmniFocus
    const dateResult = this.convertTaskDates(createArgs, timer);
    if ('isError' in dateResult) return dateResult.response;
    const convertedTaskData = dateResult.data;

    this.logger.debug('Converted task data for script execution', { convertedTaskData });

    // Execute the create script
    const createResult = await this.executeCreateScript(convertedTaskData, timer);
    if ('isError' in createResult) return createResult.response;

    // Parse and validate the result
    const parseResult = this.parseAndValidateCreateResult(createResult.data, timer);
    if ('isError' in parseResult) return parseResult.response;

    const { parsedResult, createdTaskId } = parseResult;

    // Apply repetition rule post-creation if needed
    await this.applyRepetitionRulePostCreate(repetitionRuleForCreate, createdTaskId);

    // Smart cache invalidation after successful task creation
    this.cache.invalidateForTaskChange({
      operation: 'create',
      projectId: createArgs.projectId,
      tags: Array.isArray(createArgs.tags) ? createArgs.tags : undefined,
      affectsToday: createArgs.dueDate ? this.isDueSoon(createArgs.dueDate) : false,
      affectsOverdue: false, // New tasks can't be overdue
    });

    this.logger.debug('Returning success response', { parsedResult });

    return createSuccessResponseV2(
      'omnifocus_write',
      {
        task: parsedResult,
        id: createdTaskId,
        name: (parsedResult as Record<string, unknown>).name,
        operation: 'create' as const,
      },
      undefined,
      {
        ...timer.toMetadata(),
        created_id: createdTaskId,
        project_id: createArgs.projectId || null,
        input_params: {
          name: createArgs.name,
          has_project: !!createArgs.projectId,
          has_due_date: !!createArgs.dueDate,
          has_planned_date: !!createArgs.plannedDate,
          has_tags: !!(createArgs.tags && createArgs.tags.length > 0),
          has_repeat_rule: !!repetitionRuleForCreate,
        },
      },
    );
  }

  /**
   * Convert local dates in task creation args to UTC.
   * Returns either the converted data or an error response.
   */
  private convertTaskDates(
    createArgs: Partial<TaskCreationArgs>,
    timer: OperationTimerV2,
  ): { data: Record<string, unknown> } | { isError: true; response: unknown } {
    try {
      const converted: Record<string, unknown> = {
        ...createArgs,
        dueDate: createArgs.dueDate ? localToUTC(createArgs.dueDate, 'due') : undefined,
        deferDate: createArgs.deferDate ? localToUTC(createArgs.deferDate, 'defer') : undefined,
        plannedDate: createArgs.plannedDate ? localToUTC(createArgs.plannedDate, 'planned') : undefined,
        project: createArgs.projectId,
      };
      delete converted.projectId;
      return { data: converted };
    } catch (dateError) {
      const isDefer = dateError instanceof Error && dateError.message.includes('defer');
      const isPlanned = dateError instanceof Error && dateError.message.includes('planned');
      const plannedOrDue = isPlanned ? 'plannedDate' : 'dueDate';
      const fieldName = isDefer ? 'deferDate' : plannedOrDue;
      const fieldValues: Record<string, string | undefined> = {
        deferDate: createArgs.deferDate,
        plannedDate: createArgs.plannedDate,
        dueDate: createArgs.dueDate,
      };
      const providedValue = fieldValues[fieldName];
      const errorDetails = invalidDateError(fieldName, providedValue || '');
      return {
        isError: true,
        response: createErrorResponseV2(
          'omnifocus_write',
          'INVALID_DATE_FORMAT',
          errorDetails.message,
          formatErrorWithRecovery(errorDetails),
          { recovery: errorDetails.recovery, providedValue },
          timer.toMetadata(),
        ),
      };
    }
  }

  /**
   * Build and execute the task creation script.
   * Returns the raw result data or an error response.
   */
  private async executeCreateScript(
    convertedTaskData: Record<string, unknown>,
    timer: OperationTimerV2,
  ): Promise<{ data: unknown } | { isError: true; response: unknown }> {
    const script = (await buildCreateTaskScript(convertedTaskData as unknown as TaskCreateData)).script;

    let createResult: unknown;
    try {
      const scriptResult = await this.execJson(script);
      this.logger.debug('execJson returned result', { scriptResult });

      if (isScriptError(scriptResult)) {
        return {
          isError: true,
          response: createErrorResponseV2(
            'omnifocus_write',
            'SCRIPT_ERROR',
            scriptResult.error || 'Script execution failed',
            undefined,
            scriptResult.details,
            timer.toMetadata(),
          ),
        };
      }
      createResult = (scriptResult as ScriptExecutionResult).data;
    } catch (e) {
      this.logger.error('Script execution threw error', { error: e });
      return { isError: true, response: this.handleErrorV2<TaskOperationDataV2>(e) };
    }

    this.logger.debug('Processing script result', { createResult });

    // Check for error in result object
    if (
      createResult &&
      typeof createResult === 'object' &&
      'error' in createResult &&
      (createResult as { error: unknown }).error
    ) {
      const errorMessage = (createResult as { message?: string }).message || 'Failed to create task';
      const recovery = buildCreateErrorRecovery(errorMessage);
      return {
        isError: true,
        response: createErrorResponseV2(
          'omnifocus_write',
          'SCRIPT_ERROR',
          errorMessage,
          'Verify the inputs and OmniFocus state',
          { rawResult: createResult as unknown, recovery },
          timer.toMetadata(),
        ),
      };
    }

    return { data: createResult };
  }

  /**
   * Parse raw create result, unwrap v3 envelope, and validate structure.
   * Returns the parsed result and task ID, or an error response.
   */
  private parseAndValidateCreateResult(
    createResult: unknown,
    timer: OperationTimerV2,
  ): { parsedResult: unknown; createdTaskId: string | null } | { isError: true; response: unknown } {
    let parsedResult: unknown;
    try {
      parsedResult = typeof createResult === 'string' ? JSON.parse(createResult) : createResult;
    } catch (parseError) {
      this.logger.error(`Failed to parse create task result: ${String(createResult)}`);
      const errorDetails = parsingError('task creation', String(createResult), 'valid JSON');
      return {
        isError: true,
        response: createErrorResponseV2(
          'omnifocus_write',
          'INTERNAL_ERROR',
          errorDetails.message,
          'Ensure script returns valid JSON',
          {
            received: createResult,
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            recovery: errorDetails.recovery,
          },
          timer.toMetadata(),
        ),
      };
    }

    // Unwrap v3 envelope if present
    const unwrapped = unwrapV3Envelope(parsedResult);
    if (unwrapped !== parsedResult) {
      this.logger.debug('Unwrapping v3 envelope', { envelope: parsedResult });
      parsedResult = unwrapped;
    }

    // Validate structure
    if (
      !parsedResult ||
      typeof parsedResult !== 'object' ||
      (!(parsedResult as Record<string, unknown>).taskId && !(parsedResult as Record<string, unknown>).id)
    ) {
      return {
        isError: true,
        response: createErrorResponseV2(
          'omnifocus_write',
          'INTERNAL_ERROR',
          'Invalid response from create task script',
          'Have the script return an object with id/taskId',
          { received: parsedResult as unknown },
          timer.toMetadata(),
        ),
      };
    }

    const createdTaskId =
      (parsedResult as { taskId?: string; id?: string }).taskId || (parsedResult as { id?: string }).id || null;
    this.logger.debug('Post-create task ID', { createdTaskId });

    return { parsedResult, createdTaskId };
  }

  /**
   * Apply a repetition rule to a newly created task via an update script.
   */
  private async applyRepetitionRulePostCreate(
    repetitionRule: RepetitionRule | undefined,
    taskId: string | null,
  ): Promise<void> {
    if (!repetitionRule || !taskId) return;

    try {
      this.logger.debug('Applying repeat rule via update', { repetitionRule });
      const repeatOnlyScript = (await buildUpdateTaskScript(taskId, { repetitionRule })).script;
      const repeatUpdateResult = await this.execJson(repeatOnlyScript);
      this.logger.debug('Repeat rule update result', { repeatUpdateResult });
      if (isScriptError(repeatUpdateResult)) {
        this.logger.warn('Failed to apply repeat rule during task creation', repeatUpdateResult.error);
      } else {
        this.logger.info('Repeat rule applied post-creation for task', { taskId });
      }
    } catch (repeatError) {
      this.logger.warn('Exception applying repeat rule post-creation', repeatError);
    }
  }

  // ─── Task Update ────────────────────────────────────────────────────

  private async handleTaskUpdate(compiled: Extract<CompiledMutation, { operation: 'update' }>): Promise<unknown> {
    const timer = new OperationTimerV2();
    const taskId = compiled.taskId!;

    if (!taskId) {
      return createErrorResponseV2(
        'omnifocus_write',
        'MISSING_PARAMETER',
        'taskId is required',
        'Provide a valid task ID',
        undefined,
        timer.toMetadata(),
      );
    }

    const minimalResponse = compiled.minimalResponse ?? false;

    // Sanitize and validate updates using shared utility
    const safeUpdates = sanitizeTaskUpdates(compiled.changes as Record<string, unknown>);

    // If no valid updates, return early
    if (Object.keys(safeUpdates).length === 0) {
      return createSuccessResponseV2(
        'omnifocus_write',
        { task: { id: taskId, name: '', updated: false as const, changes: {} } },
        undefined,
        { ...timer.toMetadata(), input_params: { taskId }, message: 'No valid updates provided' },
      );
    }

    this.logger.debug('Sending to update script:', {
      taskId,
      safeUpdates,
      safeUpdatesKeys: Object.keys(safeUpdates),
    });

    // Use AST-powered mutation builder
    const updateScript = (await buildUpdateTaskScript(taskId, safeUpdates)).script;
    const updateResult = await this.execJson(updateScript);
    if (isScriptError(updateResult)) {
      this.logger.error(`Update task script error: ${updateResult.error}`);
      return createErrorResponseV2(
        'omnifocus_write',
        'SCRIPT_ERROR',
        updateResult.error || 'Script execution failed',
        'Verify task exists and params are valid',
        updateResult.details,
        timer.toMetadata(),
      );
    }

    const embeddedError = this.extractEmbeddedScriptError(updateResult);
    if (embeddedError) {
      return createErrorResponseV2(
        'omnifocus_write',
        'SCRIPT_ERROR',
        embeddedError.message,
        'Verify task exists and params are valid',
        embeddedError.rawData,
        timer.toMetadata(),
      );
    }

    const parsedUpdateResult = this.unwrapUpdateResult(updateResult);

    this.invalidateCacheForTaskUpdate(safeUpdates);
    this.logger.info(`Updated task: ${taskId}`);

    if (minimalResponse) {
      return {
        success: true,
        id: taskId,
        operation: 'update_task',
        task_id: taskId, // Keep for backwards compatibility
        fields_updated: Object.keys(safeUpdates),
      };
    }

    return this.buildTaskUpdateResponse(taskId, safeUpdates, parsedUpdateResult, timer);
  }

  /**
   * Check if a script success result contains an embedded error in its data payload.
   */
  private extractEmbeddedScriptError(result: ScriptExecutionResult): { message: string; rawData: unknown } | null {
    if (!result.success) return null;

    const rawData = result.data as { success?: unknown; error?: unknown; message?: unknown } | undefined;
    if (!rawData || typeof rawData !== 'object') return null;

    const { error: errorValue, success: subSuccess } = rawData;
    if (!errorValue && subSuccess !== false) return null;

    const errorFallback = typeof errorValue === 'string' ? errorValue : 'Script execution failed';
    const message = typeof rawData.message === 'string' ? rawData.message : errorFallback;
    return { message, rawData };
  }

  /**
   * Unwrap the update result, handling v3 envelope format.
   */
  private unwrapUpdateResult(updateResult: ScriptExecutionResult): unknown {
    let parsedUpdateResult = updateResult.data;

    const unwrappedUpdate = unwrapV3Envelope(parsedUpdateResult);
    if (unwrappedUpdate !== parsedUpdateResult) {
      this.logger.debug('Unwrapping v3 envelope for update', { envelope: parsedUpdateResult });
      parsedUpdateResult = unwrappedUpdate;
    }

    return parsedUpdateResult;
  }

  /**
   * Invalidate caches affected by a task update.
   */
  private invalidateCacheForTaskUpdate(safeUpdates: Record<string, unknown>): void {
    const affectedTags: string[] = [];
    if (isStringArray(safeUpdates.tags)) affectedTags.push(...safeUpdates.tags);
    if (isStringArray(safeUpdates.addTags)) affectedTags.push(...safeUpdates.addTags);
    if (isStringArray(safeUpdates.removeTags)) affectedTags.push(...safeUpdates.removeTags);

    this.cache.invalidateForTaskChange({
      operation: 'update',
      projectId: typeof safeUpdates.project === 'string' ? safeUpdates.project : undefined,
      tags: affectedTags.length > 0 ? affectedTags : undefined,
      affectsToday: typeof safeUpdates.dueDate === 'string' ? this.isDueSoon(safeUpdates.dueDate) : false,
      affectsOverdue: false, // Updates don't automatically make things overdue
    });
  }

  /**
   * Build the full success response for a task update.
   */
  private buildTaskUpdateResponse(
    taskId: string,
    safeUpdates: Record<string, unknown>,
    parsedUpdateResult: unknown,
    timer: OperationTimerV2,
  ): unknown {
    const taskData = (parsedUpdateResult as { task?: Record<string, unknown> })?.task ||
      parsedUpdateResult || { id: taskId, name: 'Unknown' };
    const transformedResult = {
      id: (taskData as { id?: string }).id || taskId,
      name: (taskData as { name?: string }).name || 'Unknown',
      updated: true,
      changes: Object.keys(safeUpdates).reduce(
        (acc, key) => {
          acc[key] = safeUpdates[key];
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    };

    return createSuccessResponseV2('omnifocus_write', { task: transformedResult }, undefined, {
      ...timer.toMetadata(),
      updated_id: taskId,
      input_params: {
        taskId,
        fields_updated: Object.keys(safeUpdates),
        has_date_changes: !!(
          safeUpdates.dueDate ||
          safeUpdates.deferDate ||
          safeUpdates.clearDueDate ||
          safeUpdates.clearDeferDate
        ),
        has_project_change: safeUpdates.project !== undefined,
      },
    });
  }

  // ─── Task Complete ──────────────────────────────────────────────────

  private async handleTaskComplete(compiled: Extract<CompiledMutation, { operation: 'complete' }>): Promise<unknown> {
    const timer = new OperationTimerV2();
    const taskId = compiled.taskId!;

    if (!taskId) {
      return createErrorResponseV2(
        'omnifocus_write',
        'MISSING_PARAMETER',
        'taskId is required',
        'Provide a valid task ID',
        undefined,
        timer.toMetadata(),
      );
    }

    // Convert completionDate if provided
    const processedArgs = {
      taskId,
      completionDate: compiled.completionDate ? localToUTC(compiled.completionDate, 'completion') : undefined,
    };

    try {
      const completeScript = this.omniAutomation.buildScript(
        COMPLETE_TASK_SCRIPT,
        processedArgs as unknown as Record<string, unknown>,
      );
      const res = await this.execJson(completeScript);
      const completeResult =
        res && typeof res === 'object' && 'success' in res
          ? (res as TaskOperationResult)
          : { success: true, data: res };

      if (typeof completeResult === 'object' && 'success' in completeResult && !completeResult.success) {
        const error = (completeResult as { error?: string }).error;
        if (error && typeof error === 'string' && this.isJxaAccessDenied(error)) {
          this.logger.info('JXA access denied for task completion');
          return this.jxaAccessDeniedError(timer);
        }
        const errorMsg = error || 'Unknown error';
        const details = (completeResult as { details?: unknown }).details;
        return createErrorResponseV2(
          'omnifocus_write',
          'SCRIPT_ERROR',
          errorMsg,
          'Verify task ID and OmniFocus state',
          details,
          timer.toMetadata(),
        );
      }

      this.logger.info(`Completed task via JXA: ${taskId}`);

      const parsedCompleteResult = (completeResult as { data?: unknown }).data;

      this.cache.invalidateForTaskChange({
        operation: 'complete',
        affectsToday: true,
        affectsOverdue: true,
      });

      return createSuccessResponseV2('omnifocus_write', { task: parsedCompleteResult }, undefined, {
        ...timer.toMetadata(),
        completed_id: taskId,
        method: 'jxa',
        input_params: { taskId },
      });
    } catch (jxaError: unknown) {
      const errorMessage = jxaError instanceof Error ? jxaError.message : String(jxaError);
      if (this.isJxaAccessDenied(errorMessage)) {
        this.logger.info('JXA failed for task completion');
        return this.jxaAccessDeniedError(timer);
      }
      return this.handleErrorV2<TaskOperationDataV2>(jxaError);
    }
  }

  // ─── Task Delete ────────────────────────────────────────────────────

  private async handleTaskDelete(compiled: Extract<CompiledMutation, { operation: 'delete' }>): Promise<unknown> {
    const timer = new OperationTimerV2();
    const taskId = compiled.taskId!;

    if (!taskId) {
      return createErrorResponseV2(
        'omnifocus_write',
        'MISSING_PARAMETER',
        'taskId is required',
        'Provide a valid task ID',
        undefined,
        timer.toMetadata(),
      );
    }

    try {
      const deleteScript = this.omniAutomation.buildScript(DELETE_TASK_SCRIPT, {
        taskId,
      } as unknown as Record<string, unknown>);
      const res = await this.execJson(deleteScript);
      const deleteResult =
        res && typeof res === 'object' && 'success' in res
          ? (res as TaskOperationResult)
          : { success: true, data: res };

      if (typeof deleteResult === 'object' && 'success' in deleteResult && !deleteResult.success) {
        const error = (deleteResult as { error?: string }).error;
        if (error && typeof error === 'string' && this.isJxaAccessDenied(error)) {
          this.logger.info('JXA failed for task deletion');
          return this.jxaAccessDeniedError(timer);
        }
        const errorMsg = error || 'Unknown error';
        const details = (deleteResult as { details?: unknown }).details;
        return createErrorResponseV2(
          'omnifocus_write',
          'SCRIPT_ERROR',
          errorMsg,
          'Verify task ID and permissions',
          details,
          timer.toMetadata(),
        );
      }

      const parsedDeleteResult = (deleteResult as { data?: unknown }).data;

      // Conservative cache invalidation — we don't know which project/tags were affected
      this.cache.invalidateForTaskChange({
        operation: 'delete',
        affectsToday: true,
        affectsOverdue: true,
      });
      this.cache.invalidate('projects');
      this.cache.invalidate('tags');

      this.logger.info(`Deleted task via JXA: ${taskId}`);
      return createSuccessResponseV2('omnifocus_write', { task: parsedDeleteResult }, undefined, {
        ...timer.toMetadata(),
        deleted_id: taskId,
        method: 'jxa',
        input_params: { taskId },
      });
    } catch (jxaError: unknown) {
      const errorMessage = jxaError instanceof Error ? jxaError.message : String(jxaError);
      if (this.isJxaAccessDenied(errorMessage)) {
        this.logger.info('JXA failed for task deletion');
        return this.jxaAccessDeniedError(timer);
      }
      return this.handleErrorV2<TaskOperationDataV2>(jxaError);
    }
  }

  // ─── Bulk Delete ────────────────────────────────────────────────────

  private async handleBulkDelete(compiled: Extract<CompiledMutation, { operation: 'bulk_delete' }>): Promise<unknown> {
    const timer = new OperationTimerV2();

    if (compiled.target === 'project') {
      return this.handleBulkDeleteProjects(compiled.ids, timer);
    }

    return this.handleBulkDeleteTasks(compiled.ids, timer);
  }

  /**
   * Bulk delete projects by iterating through individual delete operations.
   */
  private async handleBulkDeleteProjects(ids: string[], timer: OperationTimerV2): Promise<unknown> {
    const deleteResults: Array<{ projectId: string; status: string }> = [];
    const deleteErrors: unknown[] = [];

    for (const id of ids) {
      try {
        const deleteResult = await this.handleProjectDelete(id);
        const success =
          deleteResult && typeof deleteResult === 'object' && (deleteResult as { success?: boolean }).success;
        if (success) {
          deleteResults.push({ projectId: id, status: 'deleted' });
        } else {
          deleteErrors.push({ projectId: id, error: 'Delete failed' });
        }
      } catch (err) {
        deleteErrors.push({ projectId: id, error: String(err) });
      }
    }

    return createSuccessResponseV2(
      'omnifocus_write',
      {
        operation: 'bulk_delete',
        successCount: deleteResults.length,
        errorCount: deleteErrors.length,
        results: deleteResults,
        errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      },
      undefined,
      timer.toMetadata(),
    );
  }

  /**
   * Bulk delete tasks via direct script execution.
   */
  private async handleBulkDeleteTasks(ids: string[], timer: OperationTimerV2): Promise<unknown> {
    const taskIds = ids.map((id) => convertToTaskId(id));
    const results: Array<{ taskId: string; status: string }> = [];
    const errors: unknown[] = [];

    try {
      const script = this.omniAutomation.buildScript(BULK_DELETE_TASKS_SCRIPT, {
        taskIds: taskIds.map((id) => id as string),
      });
      const result = await this.execJson(script);

      if (isScriptError(result)) {
        errors.push({ error: result.error || 'Bulk delete failed' });
      } else {
        this.collectBulkDeleteResults(result, results, errors);
      }

      // Invalidate task cache after bulk operation
      this.cache.clear('tasks');
    } catch (error) {
      errors.push({ error: String(error) });
    }

    const responseData = {
      operation: 'bulk_delete',
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };

    return createSuccessResponseV2('omnifocus_write', responseData, undefined, timer.toMetadata());
  }

  /**
   * Extract deleted items and errors from a bulk delete script result.
   */
  private collectBulkDeleteResults(
    result: ScriptExecutionResult,
    results: Array<{ taskId: string; status: string }>,
    errors: unknown[],
  ): void {
    if (!result.data || typeof result.data !== 'object') return;

    const bulkResult = result.data as {
      deleted?: Array<{ id: string; name: string }>;
      errors?: Array<{ taskId: string; error: string }>;
    };

    if (Array.isArray(bulkResult.deleted)) {
      for (const item of bulkResult.deleted) {
        results.push({ taskId: item.id, status: 'deleted' });
      }
    }

    if (Array.isArray(bulkResult.errors)) {
      errors.push(...bulkResult.errors);
    }
  }

  // ─── Project operations (inline) ────────────────────────────────────

  private async handleProjectOperation(
    compiled: Exclude<CompiledMutation, { operation: 'batch' | 'bulk_delete' }>,
  ): Promise<unknown> {
    // Route by operation type
    switch (compiled.operation) {
      case 'update':
        if ('projectId' in compiled && compiled.projectId) {
          return this.handleProjectUpdateDirect(compiled.projectId, compiled.changes as ProjectUpdateData);
        }
        return createErrorResponseV2(
          'omnifocus_write',
          'MISSING_PARAMETER',
          'Project ID is required for update',
          'Use omnifocus_read to find the project ID first',
          undefined,
          new OperationTimerV2().toMetadata(),
        );
      case 'create':
        return this.handleProjectCreate(compiled as Extract<CompiledMutation, { operation: 'create' }>);
      case 'complete':
        if ('projectId' in compiled && compiled.projectId) {
          return this.handleProjectComplete(compiled.projectId);
        }
        return createErrorResponseV2(
          'omnifocus_write',
          'MISSING_PARAMETER',
          'Project ID is required for complete',
          'Use omnifocus_read to find the project ID first',
          undefined,
          new OperationTimerV2().toMetadata(),
        );
      case 'delete':
        if ('projectId' in compiled && compiled.projectId) {
          return this.handleProjectDelete(compiled.projectId);
        }
        return createErrorResponseV2(
          'omnifocus_write',
          'MISSING_PARAMETER',
          'Project ID is required for delete',
          'Use omnifocus_read to find the project ID first',
          undefined,
          new OperationTimerV2().toMetadata(),
        );
      default:
        return createErrorResponseV2(
          'omnifocus_write',
          'INVALID_OPERATION',
          `Invalid project operation: ${String((compiled as { operation: string }).operation)}`,
          undefined,
          undefined,
          new OperationTimerV2().toMetadata(),
        );
    }
  }

  /**
   * Create a new project via buildCreateProjectScript (AST mutation builder).
   */
  private async handleProjectCreate(compiled: Extract<CompiledMutation, { operation: 'create' }>): Promise<unknown> {
    const timer = new OperationTimerV2();
    const data = compiled.data;

    if (!data.name) {
      return createErrorResponseV2(
        'omnifocus_write',
        'MISSING_PARAMETER',
        'Project name is required',
        'Add a name parameter with the project name',
        undefined,
        timer.toMetadata(),
      );
    }

    const projectData: ProjectCreateData = {
      name: data.name,
      note: data.note,
      dueDate: data.dueDate ? localToUTC(data.dueDate, 'due') : undefined,
      deferDate: data.deferDate ? localToUTC(data.deferDate, 'defer') : undefined,
      plannedDate: data.plannedDate ? localToUTC(data.plannedDate, 'planned') : undefined,
      flagged: data.flagged,
      tags: data.tags,
      sequential: data.sequential ?? false,
      folder: data.folder,
      status: data.status,
      reviewInterval: data.reviewInterval,
    };

    const generatedScript = buildCreateProjectScript(projectData);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      const errorMessage = result.error || 'Failed to create project';
      if (typeof errorMessage === 'string' && this.isJxaAccessDenied(errorMessage)) {
        return this.jxaAccessDeniedError(timer);
      }
      return createErrorResponseV2(
        'omnifocus_write',
        'CREATE_FAILED',
        typeof errorMessage === 'string' ? errorMessage : 'Script execution failed',
        'Check the project name and try again',
        result.details,
        timer.toMetadata(),
      );
    }

    // Invalidate cache
    this.cache.invalidate('projects');

    return createSuccessResponseV2('omnifocus_write', { project: result.data, operation: 'create' }, undefined, {
      ...timer.toMetadata(),
      operation: 'create',
    });
  }

  /**
   * Complete a project via buildCompleteScript (AST mutation builder).
   */
  private async handleProjectComplete(projectId: string): Promise<unknown> {
    const timer = new OperationTimerV2();

    const generatedScript = await buildCompleteScript('project', projectId);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      const errorMessage = result.error || 'Failed to complete project';
      if (typeof errorMessage === 'string' && this.isJxaAccessDenied(errorMessage)) {
        return this.jxaAccessDeniedError(timer);
      }
      return createErrorResponseV2(
        'omnifocus_write',
        'COMPLETE_FAILED',
        typeof errorMessage === 'string' ? errorMessage : 'Script execution failed',
        "Check the project ID and ensure it's not already completed",
        result.details,
        timer.toMetadata(),
      );
    }

    // Smart cache invalidation
    this.cache.invalidateProject(projectId);
    this.cache.invalidate('analytics');

    return createSuccessResponseV2('omnifocus_write', { project: result.data, operation: 'complete' }, undefined, {
      ...timer.toMetadata(),
      operation: 'complete',
    });
  }

  /**
   * Delete a project via buildDeleteScript (AST mutation builder).
   */
  private async handleProjectDelete(projectId: string): Promise<unknown> {
    const timer = new OperationTimerV2();

    const generatedScript = await buildDeleteScript('project', projectId);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      const errorMessage = result.error || 'Failed to delete project';
      if (typeof errorMessage === 'string' && this.isJxaAccessDenied(errorMessage)) {
        return this.jxaAccessDeniedError(timer);
      }
      return createErrorResponseV2(
        'omnifocus_write',
        'DELETE_FAILED',
        typeof errorMessage === 'string' ? errorMessage : 'Script execution failed',
        'Check the project ID and permissions',
        result.details,
        timer.toMetadata(),
      );
    }

    // Smart cache invalidation
    this.cache.invalidateProject(projectId);
    this.cache.invalidate('analytics');

    return createSuccessResponseV2('omnifocus_write', { project: { deleted: true }, operation: 'delete' }, undefined, {
      ...timer.toMetadata(),
      operation: 'delete',
    });
  }

  // ─── Folder operations (inline) ─────────────────────────────────────

  /**
   * Create a new folder via buildCreateFolderScript (AST mutation builder).
   */
  private async handleFolderCreate(
    compiled: Extract<CompiledMutation, { operation: 'create_folder' }>,
  ): Promise<unknown> {
    const timer = new OperationTimerV2();
    const data = compiled.data;

    if (!data.name) {
      return createErrorResponseV2(
        'omnifocus_write',
        'MISSING_PARAMETER',
        'Folder name is required',
        'Add a name parameter with the folder name',
        undefined,
        timer.toMetadata(),
      );
    }

    const folderData: FolderCreateData = {
      name: data.name,
      parentFolder: data.parentFolder,
    };

    const generatedScript = buildCreateFolderScript(folderData);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      const errorMessage = result.error || 'Failed to create folder';
      if (typeof errorMessage === 'string' && this.isJxaAccessDenied(errorMessage)) {
        return this.jxaAccessDeniedError(timer);
      }
      return createErrorResponseV2(
        'omnifocus_write',
        'CREATE_FAILED',
        typeof errorMessage === 'string' ? errorMessage : 'Script execution failed',
        'Check the folder name and parent folder, then try again',
        result.details,
        timer.toMetadata(),
      );
    }

    // Invalidate cache — folders affect project/folder listings
    this.cache.invalidate('projects');
    this.cache.invalidate('folders');

    return createSuccessResponseV2('omnifocus_write', { folder: result.data, operation: 'create_folder' }, undefined, {
      ...timer.toMetadata(),
      operation: 'create_folder',
    });
  }

  /**
   * Handle project updates directly via buildUpdateProjectScript.
   * This ensures all ProjectUpdateData fields are passed through without stripping.
   */
  private async handleProjectUpdateDirect(projectId: string, changes: ProjectUpdateData): Promise<unknown> {
    const timer = new OperationTimerV2();

    // Convert date strings to UTC (same as task path); preserve null (= clear date)
    const convertedChanges = { ...changes };
    if (typeof changes.dueDate === 'string') convertedChanges.dueDate = localToUTC(changes.dueDate, 'due');
    if (typeof changes.deferDate === 'string') convertedChanges.deferDate = localToUTC(changes.deferDate, 'defer');
    if (typeof changes.plannedDate === 'string')
      convertedChanges.plannedDate = localToUTC(changes.plannedDate, 'planned');

    const script = (await buildUpdateProjectScript(projectId, convertedChanges)).script;
    const result = await this.execJson(script);

    if (isScriptError(result)) {
      return createErrorResponseV2(
        'omnifocus_write',
        'UPDATE_FAILED',
        result.error || 'Failed to update project',
        'Check the project ID and try again',
        result.details,
        timer.toMetadata(),
      );
    }

    // Smart cache invalidation
    this.cache.invalidateProject(projectId);

    return createSuccessResponseV2(
      'omnifocus_write',
      {
        operation: 'update',
        target: 'project',
        ...(result.data as Record<string, unknown>),
      },
      undefined,
      timer.toMetadata(),
    );
  }

  // ─── Batch routing ─────────────────────────────────────────────────

  private async routeToBatch(compiled: Extract<CompiledMutation, { operation: 'batch' }>): Promise<unknown> {
    const batchTimer = new OperationTimerV2();

    // Partition operations by type
    const createOps = compiled.operations.filter((op) => op.operation === 'create');
    const updateOps = compiled.operations.filter((op) => op.operation === 'update');
    const completeOps = compiled.operations.filter((op) => op.operation === 'complete');
    const deleteOps = compiled.operations.filter((op) => op.operation === 'delete');

    const results: {
      created: unknown[];
      updated: unknown[];
      completed: unknown[];
      deleted: unknown[];
      errors: unknown[];
    } = { created: [], updated: [], completed: [], deleted: [], errors: [] };

    let tempIdMapping: Record<string, string> = {};
    let createdCount = 0;
    let hadError = false;

    // Phase 1: Creates (inline batch create with hierarchy support)
    if (createOps.length > 0 && !hadError) {
      const createPhase = await this.executeBatchCreatePhase(createOps, compiled, results);
      createdCount = createPhase.createdCount;
      tempIdMapping = createPhase.tempIdMapping;
      hadError = createPhase.hadError;
    }

    // Phase 2-4: Updates, completes, deletes — route through inline handlers
    const phases: Array<{
      name: string;
      ops: typeof updateOps;
      resultKey: 'updated' | 'completed' | 'deleted';
    }> = [
      { name: 'update', ops: updateOps, resultKey: 'updated' },
      { name: 'complete', ops: completeOps, resultKey: 'completed' },
      { name: 'delete', ops: deleteOps, resultKey: 'deleted' },
    ];

    for (const phase of phases) {
      if (hadError || phase.ops.length === 0) continue;

      for (const op of phase.ops) {
        try {
          const resolvedId = op.id && tempIdMapping[op.id] ? tempIdMapping[op.id] : op.id;
          const result = await this.dispatchBatchOp(op, resolvedId);
          results[phase.resultKey].push(result);
        } catch (err) {
          results.errors.push({ phase: phase.name, id: op.id, error: String(err) });
          if (compiled.stopOnError) {
            hadError = true;
            break;
          }
        }
      }
    }

    return {
      success: results.errors.length === 0,
      data: {
        operation: 'batch',
        summary: {
          created: createdCount,
          updated: results.updated.length,
          completed: results.completed.length,
          deleted: results.deleted.length,
          errors: results.errors.length,
        },
        results: flattenBatchResults(results),
        ...(Object.keys(tempIdMapping).length > 0 ? { tempIdMapping } : {}),
      },
      metadata: {
        operation: 'batch',
        timestamp: new Date().toISOString(),
        ...batchTimer.toMetadata(),
      },
    };
  }

  /**
   * Build a CompiledMutation-compatible object from a batch operation for inline dispatch.
   */
  private buildTaskCompiledForBatch(
    op: { operation: string; id?: string; changes?: unknown; completionDate?: string },
    resolvedId?: string,
  ): CompiledMutation {
    switch (op.operation) {
      case 'update':
        return {
          operation: 'update',
          target: 'task',
          taskId: resolvedId,
          changes: (op.changes || {}) as Record<string, unknown>,
        };
      case 'complete':
        return {
          operation: 'complete',
          target: 'task',
          taskId: resolvedId,
          completionDate: op.completionDate,
        };
      case 'delete':
        return {
          operation: 'delete',
          target: 'task',
          taskId: resolvedId,
        };
      default:
        throw new Error(`Unexpected batch task operation: ${op.operation}`);
    }
  }

  private async executeBatchCreatePhase(
    createOps: Extract<CompiledMutation, { operation: 'batch' }>['operations'],
    compiled: Extract<CompiledMutation, { operation: 'batch' }>,
    results: { created: unknown[]; errors: unknown[] },
  ): Promise<{ createdCount: number; tempIdMapping: Record<string, string>; hadError: boolean }> {
    let tempIdMapping: Record<string, string> = {};
    let createdCount = 0;
    let hadError = false;

    try {
      let autoTempIdCounter = 0;
      const items: BatchItem[] = createOps.map((op) => {
        const item = { type: op.target as 'task' | 'project', ...op.data } as BatchItem;
        // Accept tempId/parentTempId at operation level too (LLMs may place them here)
        if ((op as Record<string, unknown>).tempId && !item.tempId) {
          item.tempId = (op as Record<string, unknown>).tempId as string;
        }
        if ((op as Record<string, unknown>).parentTempId && !item.parentTempId) {
          item.parentTempId = (op as Record<string, unknown>).parentTempId as string;
        }
        if (!item.tempId) {
          item.tempId = `auto_temp_${++autoTempIdCounter}`;
        }
        return item;
      });

      const createResult = await this.executeBatchCreates(items, {
        createSequentially: compiled.createSequentially ?? true,
        atomicOperation: compiled.atomicOperation ?? false,
        returnMapping: compiled.returnMapping ?? true,
        stopOnError: compiled.stopOnError ?? true,
      });

      if (createResult.success === false && createResult.rolledBack) {
        results.errors.push(createResult);
        if (compiled.stopOnError) hadError = true;
      } else if (createResult.failed > 0 && compiled.stopOnError) {
        results.errors.push(createResult);
        hadError = true;
      } else {
        results.created.push(createResult);
      }

      createdCount = createResult.created;
      if (createResult.mapping) {
        tempIdMapping = createResult.mapping;
      }
    } catch (err) {
      if (err instanceof DependencyGraphError) {
        results.errors.push({
          phase: 'create',
          error: { code: 'VALIDATION_ERROR', message: err.message },
          details: err.details,
        });
      } else {
        results.errors.push({ phase: 'create', error: { code: 'INTERNAL_ERROR', message: String(err) } });
      }
      if (compiled.stopOnError) hadError = true;
    }

    return { createdCount, tempIdMapping, hadError };
  }

  /**
   * Dispatch a task operation to the correct inline handler.
   */
  private async dispatchTaskOperation(compiled: CompiledMutation): Promise<unknown> {
    switch (compiled.operation) {
      case 'update':
        return this.handleTaskUpdate(compiled as Extract<CompiledMutation, { operation: 'update' }>);
      case 'complete':
        return this.handleTaskComplete(compiled as Extract<CompiledMutation, { operation: 'complete' }>);
      case 'delete':
        return this.handleTaskDelete(compiled as Extract<CompiledMutation, { operation: 'delete' }>);
      default:
        throw new Error(`Unexpected task operation for dispatch: ${(compiled as { operation: string }).operation}`);
    }
  }

  /**
   * Dispatch a single batch operation (project or task) to the correct handler.
   */
  private async dispatchBatchOp(
    op: { operation: string; target: string; id?: string; changes?: unknown; completionDate?: string },
    resolvedId?: string,
  ): Promise<unknown> {
    if (op.target === 'project') {
      switch (op.operation) {
        case 'update':
          return this.handleProjectUpdateDirect(resolvedId!, op.changes as ProjectUpdateData);
        case 'complete':
          return this.handleProjectComplete(resolvedId!);
        case 'delete':
          return this.handleProjectDelete(resolvedId!);
        default:
          throw new Error(`Unsupported batch project operation: ${op.operation}`);
      }
    }
    const taskCompiled = this.buildTaskCompiledForBatch(op, resolvedId);
    return this.dispatchTaskOperation(taskCompiled);
  }

  // ─── Batch create (inlined from BatchCreateTool) ────────────────────

  /**
   * Execute batch creates with dependency ordering, tempId resolution,
   * atomic rollback, and smart cache invalidation.
   */
  private async executeBatchCreates(
    items: BatchItem[],
    options: {
      createSequentially: boolean;
      atomicOperation: boolean;
      returnMapping: boolean;
      stopOnError: boolean;
    },
  ): Promise<{
    success: boolean;
    created: number;
    failed: number;
    totalItems: number;
    results: BatchItemCreationResult[];
    mapping?: Record<string, string>;
    rolledBack?: boolean;
  }> {
    const resolver = new TempIdResolver();
    const batchResults: BatchItemCreationResult[] = [];

    // Step 1: Validate and build dependency graph
    const graph = new DependencyGraph(items as BatchItem[]);
    const stats = graph.getStats();

    this.logger.info('Batch create initiated', {
      itemCount: stats.totalItems,
      projects: stats.projects,
      tasks: stats.tasks,
      maxDepth: stats.maxDepth,
      atomic: options.atomicOperation,
    });

    // Step 2: Register all temporary IDs
    for (const item of items) {
      resolver.register(item.tempId, item.type);
    }

    // Step 3: Get creation order (respects dependencies)
    const orderedItems = options.createSequentially ? graph.getCreationOrder() : items;

    // Step 4: Create items in order
    for (let i = 0; i < orderedItems.length; i++) {
      const item = orderedItems[i];
      const result = await this.executeSingleBatchCreate(item, resolver);
      batchResults.push(result);

      if (!result.success && options.stopOnError) {
        break;
      }
    }

    // Step 5: Handle atomic operation rollback if needed
    const failedCount = resolver.getFailedCount();
    if (options.atomicOperation && failedCount > 0) {
      await this.rollbackBatchCreations(resolver);
      return {
        success: false,
        created: 0,
        failed: failedCount,
        totalItems: items.length,
        results: batchResults,
        rolledBack: true,
      };
    }

    // Step 6: Smart cache invalidation after successful batch creations
    const createdCount = resolver.getCreatedCount();
    if (createdCount > 0) {
      this.invalidateBatchCaches(items, batchResults, resolver);
    }

    // Step 7: Build response
    const response: {
      success: boolean;
      created: number;
      failed: number;
      totalItems: number;
      results: BatchItemCreationResult[];
      mapping?: Record<string, string>;
    } = {
      success: createdCount > 0,
      created: createdCount,
      failed: failedCount,
      totalItems: items.length,
      results: batchResults,
    };

    if (options.returnMapping) {
      response.mapping = resolver.getMappings();
    }

    return response;
  }

  /**
   * Execute a single batch create, resolving or marking failed in the resolver.
   */
  private async executeSingleBatchCreate(item: BatchItem, resolver: TempIdResolver): Promise<BatchItemCreationResult> {
    try {
      const result = await this.createBatchItem(item, resolver);

      if (result.success && result.realId) {
        resolver.resolve(item.tempId, result.realId);
      } else {
        resolver.markFailed(item.tempId, result.error || 'Creation failed');
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      resolver.markFailed(item.tempId, errorMsg);
      return {
        tempId: item.tempId,
        realId: null,
        success: false,
        error: errorMsg,
        type: item.type,
      };
    }
  }

  private invalidateBatchCaches(
    items: BatchItem[],
    batchResults: BatchItemCreationResult[],
    resolver: TempIdResolver,
  ): void {
    this.cache.invalidate('projects');

    const projectIds = new Set<string>();
    const tags = new Set<string>();

    for (const item of items) {
      if (item.type === 'project' && batchResults.find((r) => r.tempId === item.tempId)?.success) {
        const realId = resolver.getRealId(item.tempId);
        if (realId) projectIds.add(realId);
      }
      if (item.tags) {
        item.tags.forEach((tag: string) => tags.add(tag));
      }
    }

    projectIds.forEach((id) => this.cache.invalidateProject(id));
    tags.forEach((tag) => this.cache.invalidateTag(tag));
    this.cache.invalidateTaskQueries(['today', 'inbox']);
    this.cache.invalidate('analytics');
  }

  /**
   * Create a single batch item (project or task).
   */
  private async createBatchItem(item: BatchItem, resolver: TempIdResolver): Promise<BatchItemCreationResult> {
    this.logger.debug(`Creating ${item.type}: ${item.name}`, { tempId: item.tempId });

    try {
      if (item.type === 'project') {
        return await this.createBatchProject(item, resolver);
      } else {
        return await this.createBatchTask(item, resolver);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        tempId: item.tempId,
        realId: null,
        success: false,
        error: errorMsg,
        type: item.type,
      };
    }
  }

  /**
   * Create a project within a batch operation.
   */
  private async createBatchProject(item: BatchItem, _resolver: TempIdResolver): Promise<BatchItemCreationResult> {
    const projectData: ProjectCreateData = {
      name: item.name,
      note: item.note || '',
      flagged: item.flagged || false,
      status: (item.status as ProjectCreateData['status']) || 'active',
      sequential: item.sequential || false,
      tags: item.tags || [],
      folder: item.folder,
      dueDate: item.dueDate ? localToUTC(item.dueDate, 'due') : undefined,
      deferDate: item.deferDate ? localToUTC(item.deferDate, 'defer') : undefined,
      plannedDate: item.plannedDate ? localToUTC(item.plannedDate, 'planned') : undefined,
      reviewInterval: item.reviewInterval,
    };

    const generatedScript = buildCreateProjectScript(projectData);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      return {
        tempId: item.tempId,
        realId: null,
        success: false,
        error: result.error,
        type: 'project',
      };
    }

    if (isScriptSuccess(result) && result.data) {
      const data = result.data as { projectId?: string; project?: { id: string } };
      const realId = data.projectId || data.project?.id;

      if (realId) {
        markProjectAsValidated(realId);

        return {
          tempId: item.tempId,
          realId,
          success: true,
          type: 'project',
        };
      }
    }

    return {
      tempId: item.tempId,
      realId: null,
      success: false,
      error: 'No project ID returned from script',
      type: 'project',
    };
  }

  /**
   * Create a task within a batch operation.
   */
  private async createBatchTask(item: BatchItem, resolver: TempIdResolver): Promise<BatchItemCreationResult> {
    const parentIds = this.resolveBatchTaskParent(item, resolver);
    if ('isError' in parentIds) {
      return parentIds.response;
    }

    const { projectId, parentTaskId } = parentIds;

    this.logger.info('Batch task create resolved IDs', {
      tempId: item.tempId,
      projectId,
      parentTaskId,
      taskName: item.name,
    });

    const repetitionRuleForBatch = item.repetitionRule as RepetitionRule | undefined;

    const taskData: TaskCreateData = {
      name: item.name,
      note: item.note || '',
      flagged: item.flagged || false,
      project: projectId || undefined,
      parentTaskId: parentTaskId || undefined,
      tags: item.tags || [],
      dueDate: item.dueDate ? localToUTC(item.dueDate, 'due') : undefined,
      deferDate: item.deferDate ? localToUTC(item.deferDate, 'defer') : undefined,
      plannedDate: item.plannedDate ? localToUTC(item.plannedDate, 'planned') : undefined,
      estimatedMinutes: item.estimatedMinutes,
      // repetitionRule applied post-create below (same pattern as handleTaskCreate)
    };

    const generatedScript = await buildCreateTaskScript(taskData);
    const result = await this.execJson(generatedScript.script);

    if (isScriptError(result)) {
      return { tempId: item.tempId, realId: null, success: false, error: result.error, type: 'task' };
    }

    const realId = this.extractCreatedTaskId(result);
    if (!realId) {
      return {
        tempId: item.tempId,
        realId: null,
        success: false,
        error: 'No task ID returned from script',
        type: 'task',
      };
    }

    await this.applyRepetitionRuleSilently(realId, repetitionRuleForBatch);
    markTaskAsValidated(realId);

    return { tempId: item.tempId, realId, success: true, type: 'task' };
  }

  /**
   * Resolve parent project/task IDs for a batch task item.
   * Returns either resolved IDs or an early-exit error response.
   */
  private resolveBatchTaskParent(
    item: BatchItem,
    resolver: TempIdResolver,
  ): { projectId: string | null; parentTaskId: string | null } | { isError: true; response: BatchItemCreationResult } {
    let projectId: string | null = null;
    let parentTaskId: string | null = null;

    if (item.parentTempId) {
      const parentRealId = resolver.getRealId(item.parentTempId);
      if (!parentRealId) {
        return {
          isError: true,
          response: {
            tempId: item.tempId,
            realId: null,
            success: false,
            error: `Parent not yet created: ${item.parentTempId}`,
            type: 'task',
          },
        };
      }

      const parentMapping = resolver.getDetailedStatus().find((m) => m.tempId === item.parentTempId);
      this.logger.info('Batch parentTempId resolution', {
        tempId: item.tempId,
        parentTempId: item.parentTempId,
        parentRealId,
        parentType: parentMapping?.type,
        willSetProjectId: parentMapping?.type === 'project',
        willSetParentTaskId: parentMapping?.type !== 'project',
      });

      if (parentMapping?.type === 'project') {
        projectId = parentRealId;
      } else {
        parentTaskId = parentRealId;
      }

      return { projectId, parentTaskId };
    }

    // Fall back to direct project assignment when parentTempId wasn't used
    if (item.parentTaskId && typeof item.parentTaskId === 'string') {
      parentTaskId = item.parentTaskId;
    } else if (item.project) {
      projectId = item.project;
    }

    return { projectId, parentTaskId };
  }

  /**
   * Extract taskId from a successful script result, or null if not present.
   */
  private extractCreatedTaskId(result: ScriptExecutionResult): string | null {
    if (!result.success || !result.data) return null;
    const data = result.data as { taskId?: string };
    return data.taskId || null;
  }

  /**
   * Apply a repetition rule post-create, logging warnings on failure.
   */
  private async applyRepetitionRuleSilently(taskId: string, repetitionRule: RepetitionRule | undefined): Promise<void> {
    if (!repetitionRule) return;

    try {
      const repeatScript = (await buildUpdateTaskScript(taskId, { repetitionRule })).script;
      await this.execJson(repeatScript);
    } catch {
      this.logger.warn('Failed to apply repeat rule in batch task creation', { taskId });
    }
  }

  /**
   * Rollback all created items in reverse order (children first, parents last).
   */
  private async rollbackBatchCreations(resolver: TempIdResolver): Promise<void> {
    const createdItems = resolver.getCreatedIds();
    this.logger.warn(`Rolling back ${createdItems.length} created items`);

    for (let i = createdItems.length - 1; i >= 0; i--) {
      const item = createdItems[i];
      try {
        const generatedScript = await buildDeleteScript(item.type, item.realId);
        await this.execJson(generatedScript.script);
        this.logger.debug(`Rolled back ${item.type}: ${item.realId}`);
      } catch (error) {
        this.logger.error(`Failed to rollback ${item.type} ${item.realId}:`, error);
      }
    }
  }

  private async handleTagManage(compiled: Extract<CompiledMutation, { operation: 'tag_manage' }>): Promise<unknown> {
    const timer = new OperationTimerV2();

    // Map unified API action to script action
    // 'unnest' in unified API maps to 'unparent' in manage script
    const action = compiled.action === 'unnest' ? 'unparent' : compiled.action;
    const tagName = compiled.tagName;
    const newName = compiled.newName;
    const targetTag = compiled.targetTag;
    const parentTagName = compiled.parentTag;

    // Validate required parameters
    if (!action) {
      return createErrorResponseV2(
        'tags',
        'MISSING_PARAMETER',
        'action is required for manage operation',
        undefined,
        { operation: 'manage' },
        timer.toMetadata(),
      );
    }

    if (!tagName) {
      return createErrorResponseV2(
        'tags',
        'MISSING_PARAMETER',
        'tagName is required for manage operation',
        undefined,
        { operation: 'manage', action },
        timer.toMetadata(),
      );
    }

    // Validate action-specific requirements
    if (action === 'rename' && !newName) {
      return createErrorResponseV2(
        'tags',
        'MISSING_PARAMETER',
        'newName is required for rename action',
        undefined,
        { operation: 'manage', action },
        timer.toMetadata(),
      );
    }

    if (action === 'merge' && !targetTag) {
      return createErrorResponseV2(
        'tags',
        'MISSING_PARAMETER',
        'targetTag is required for merge action',
        undefined,
        { operation: 'manage', action },
        timer.toMetadata(),
      );
    }

    // Execute manage tags script
    const script = this.omniAutomation.buildScript(MANAGE_TAGS_SCRIPT, {
      action,
      tagName,
      newName,
      targetTag,
      parentTagName,
      parentTagId: undefined,
      mutuallyExclusive: undefined,
    });
    const result = await this.execJson(script);

    if (!isScriptSuccess(result)) {
      return createErrorResponseV2(
        'tags',
        'SCRIPT_ERROR',
        (isScriptError(result) ? result.error : null) || 'Tag management failed',
        'Verify tag names and hierarchy constraints',
        isScriptError(result) ? { operation: 'manage', action, tagName, details: result.details } : undefined,
        timer.toMetadata(),
      );
    }

    // Unwrap double-wrapped data structure
    const envelope = result.data as unknown;
    const parsedResult =
      envelope && typeof envelope === 'object' && 'data' in envelope && (envelope as { data?: unknown }).data
        ? (envelope as { data: unknown }).data
        : envelope;

    // Smart cache invalidation for tag changes
    this.cache.invalidateTag(tagName);
    if (action === 'rename' && newName) {
      this.cache.invalidateTag(newName);
    }
    if (action === 'merge' && targetTag) {
      this.cache.invalidateTag(targetTag);
    }

    return createSuccessResponseV2(
      'tags',
      {
        action,
        tagName,
        ...(newName && { newName }),
        ...(targetTag && { targetTag }),
        result: parsedResult as { success: boolean; message?: string; data?: unknown },
      },
      undefined,
      { ...timer.toMetadata(), operation: 'manage', action },
    );
  }

  // ─── Preview methods (unchanged) ───────────────────────────────────

  /**
   * Preview batch operation without executing
   * Returns what would be created, with validation results
   */
  private previewBatch(compiled: Extract<CompiledMutation, { operation: 'batch' }>): unknown {
    const timer = new OperationTimerV2();

    // Partition operations
    const createOps = compiled.operations.filter((op) => op.operation === 'create');
    const updateOps = compiled.operations.filter((op) => op.operation === 'update');
    const completeOps = compiled.operations.filter((op) => op.operation === 'complete');
    const deleteOps = compiled.operations.filter((op) => op.operation === 'delete');

    // Build preview items for each type
    const createPreviewItems = createOps.map((op, index) => ({
      tempId: op.data?.tempId || `auto_temp_${index + 1}`,
      type: op.target,
      name: op.data?.name || 'Unnamed',
      action: 'create' as const,
      details: {
        project: op.data?.project,
        tags: op.data?.tags,
        dueDate: op.data?.dueDate,
        deferDate: op.data?.deferDate,
        flagged: op.data?.flagged,
        parentTempId: op.data?.parentTempId,
      },
    }));

    const updatePreviewItems = updateOps.map((op) => ({
      id: op.id,
      type: op.target,
      name: op.changes?.name || `[Update to ${op.id}]`,
      action: 'update' as const,
      details: op.changes,
    }));

    const completePreviewItems = completeOps.map((op) => ({
      id: op.id,
      type: op.target,
      action: 'complete' as const,
      details: { completionDate: op.completionDate },
    }));

    const deletePreviewItems = deleteOps.map((op) => ({
      id: op.id,
      type: op.target,
      action: 'delete' as const,
    }));

    // Validation checks
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for duplicate tempIds
    const tempIds = createPreviewItems.map((item) => item.tempId);
    const duplicates = tempIds.filter((id, idx) => tempIds.indexOf(id) !== idx);
    if (duplicates.length > 0) {
      errors.push(`Duplicate tempIds found: ${duplicates.join(', ')}`);
    }

    // Check for orphan parentTempIds
    const parentRefs = createPreviewItems
      .filter((item) => item.details.parentTempId)
      .map((item) => item.details.parentTempId);
    const orphanRefs = parentRefs.filter((ref) => !tempIds.includes(ref as string));
    if (orphanRefs.length > 0) {
      errors.push(`Parent references not found in batch: ${orphanRefs.join(', ')}`);
    }

    // Warning for large batches
    const totalOps = createOps.length + updateOps.length + completeOps.length + deleteOps.length;
    if (totalOps > 50) {
      warnings.push(`Large batch (${totalOps} operations) may take 30+ seconds to execute`);
    }

    // Warning for deletes
    if (deleteOps.length > 0) {
      warnings.push(`${deleteOps.length} item(s) will be permanently deleted`);
    }

    return createSuccessResponseV2(
      'omnifocus_write',
      {
        dryRun: true,
        operation: 'batch',
        wouldAffect: {
          count: totalOps,
          creates: createPreviewItems.length,
          updates: updatePreviewItems.length,
          completes: completePreviewItems.length,
          deletes: deletePreviewItems.length,
          items: [...createPreviewItems, ...updatePreviewItems, ...completePreviewItems, ...deletePreviewItems],
        },
        validation: {
          passed: errors.length === 0,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      },
      undefined,
      {
        ...timer.toMetadata(),
        message: `DRY RUN: No changes made. ${createOps.length} create, ${updateOps.length} update, ${completeOps.length} complete, ${deleteOps.length} delete.`,
      },
    );
  }

  /**
   * Preview bulk delete operation without executing
   * Returns the IDs that would be deleted
   *
   * Note: Does not verify if IDs exist (that would require expensive lookups).
   * Verification happens at execution time.
   */
  private previewBulkDelete(compiled: Extract<CompiledMutation, { operation: 'bulk_delete' }>): unknown {
    const timer = new OperationTimerV2();

    // Build preview items from the IDs provided
    const previewItems = compiled.ids.map((id) => ({
      id,
      action: 'delete' as const,
    }));

    const warnings: string[] = [];

    // Warning for large deletes
    if (compiled.ids.length > 20) {
      warnings.push(`Large bulk delete (${compiled.ids.length} items). Double-check IDs before executing.`);
    }

    return createSuccessResponseV2(
      'omnifocus_write',
      {
        dryRun: true,
        operation: 'bulk_delete',
        target: compiled.target,
        wouldAffect: {
          count: compiled.ids.length,
          items: previewItems,
        },
        validation: {
          passed: true,
          warnings: warnings.length > 0 ? warnings : undefined,
          note: 'ID existence not verified in dry-run. Invalid IDs will fail silently at execution.',
        },
      },
      undefined,
      {
        ...timer.toMetadata(),
        message: `DRY RUN: No changes made. ${compiled.ids.length} ${compiled.target}(s) would be permanently deleted.`,
      },
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /** Check if an error message indicates JXA access was denied. */
  private isJxaAccessDenied(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('parameter is missing') || lower.includes('access not allowed');
  }

  /** Build a standard access-denied error response. */
  private jxaAccessDeniedError(timer: OperationTimerV2): unknown {
    return createErrorResponseV2(
      'omnifocus_write',
      'SCRIPT_ERROR',
      'Access denied and URL scheme not implemented',
      'Grant OmniFocus automation access',
      {},
      timer.toMetadata(),
    );
  }

  /**
   * Check if a date is due soon (within next 3 days, matching OmniFocus "today" perspective).
   */
  private isDueSoon(dueDateStr: string): boolean {
    try {
      const dueDate = new Date(dueDateStr);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return dueDate <= threeDaysFromNow;
    } catch {
      return false;
    }
  }

  /**
   * Format response for CLI testing when MCP_CLI_TESTING environment variable is set.
   * This makes responses easier to parse in bash scripts.
   */
  private formatForCLI<T>(result: T, operation: string, type: 'success' | 'error'): T {
    // Only modify output if in CLI testing mode
    if (!process.env.MCP_CLI_TESTING) {
      return result;
    }

    // Add CLI-friendly debug output to stderr (won't interfere with JSON)
    if (type === 'success') {
      console.error(`[CLI_DEBUG] omnifocus_write ${operation} operation: SUCCESS`);

      const resultData = result as { data?: { task?: { taskId?: string; id?: string; name?: string } } };
      if (resultData?.data?.task?.taskId || resultData?.data?.task?.id) {
        const taskId = resultData.data.task.taskId || resultData.data.task.id;
        console.error(`[CLI_DEBUG] Task ID: ${taskId}`);
      }

      if (resultData?.data?.task?.name) {
        console.error(`[CLI_DEBUG] Task name: ${resultData.data.task.name}`);
      }

      console.error(
        `[CLI_DEBUG] Operation completed in ${(result as { metadata?: { query_time_ms?: number } })?.metadata?.query_time_ms || 'unknown'}ms`,
      );
    } else {
      console.error(`[CLI_DEBUG] omnifocus_write ${operation} operation: ERROR`);
      console.error(
        `[CLI_DEBUG] Error: ${(result as { error?: { message?: string } })?.error?.message || 'Unknown error'}`,
      );
    }

    return result;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
