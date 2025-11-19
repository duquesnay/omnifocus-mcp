# OmniFocus MCP Resources - User Stories

## Epic: Provide Ergonomic Read-Only Data Access for AI Assistants

### Overview
AI assistants need efficient, cached, and well-structured access to OmniFocus data to provide intelligent task management assistance without the overhead of multiple tool calls or data modification risks.

---

## User Story 1: Access Today's Agenda Instantly

**As an** AI assistant helping with daily planning  
**I want to** fetch today's complete agenda in a single resource call  
**So that** I can provide immediate, comprehensive daily overviews without multiple tool invocations

### Acceptance Criteria
- [ ] Single resource returns all relevant tasks: due today, overdue, and flagged
- [ ] Data is pre-sorted by priority (overdue → due today → flagged)
- [ ] Response includes full context (project, tags) without additional lookups
- [ ] Cache provides sub-100ms responses for instant user feedback
- [ ] Format is optimized for AI parsing with clear structure

### Resource Design
- URI: `omnifocus://agenda/today`
- Cache TTL: 30 seconds (high volatility)
- Format: JSON with summary statistics and task array

---

## User Story 2: Handle Large Task Lists Gracefully

**As an** AI assistant analyzing hundreds of tasks  
**I want to** paginate through task lists without memory overflow  
**So that** I can process large datasets while maintaining conversation context

### Acceptance Criteria
- [ ] Pagination with configurable page size (50-200 items)
- [ ] Total count included for progress tracking
- [ ] Consistent ordering across pages for reliable iteration
- [ ] Filter parameters to reduce dataset size upfront
- [ ] Stateless pagination (no session management needed)

### Resource Design
- URI: `omnifocus://tasks?page=1&limit=50&filter=available`
- Cache TTL: 60 seconds
- Supports: available, completed, flagged filters

---

## User Story 3: Navigate Project Hierarchies

**As an** AI assistant providing project insights  
**I want to** understand the complete project structure in one call  
**So that** I can give context-aware advice without recursive lookups

### Acceptance Criteria
- [ ] Flat list includes parent-child relationships
- [ ] Each project includes task statistics (total, completed, remaining)
- [ ] Status clearly indicated (active, on-hold, dropped, completed)
- [ ] Folder structure preserved for organizational context
- [ ] Sufficient data to avoid per-project detail calls for overviews

### Resource Design
- URI: `omnifocus://projects`
- Cache TTL: 5 minutes (low volatility)
- Includes nested structure and metadata

---

## User Story 4: Retrieve Task Details Efficiently

**As an** AI assistant answering specific task questions  
**I want to** fetch complete task information by ID  
**So that** I can provide detailed responses without searching

### Acceptance Criteria
- [ ] Direct ID-based access without list filtering
- [ ] Complete metadata in single response (dates, notes, tags, project)
- [ ] Clear 404 errors for deleted/invalid IDs
- [ ] ID format accepts both short and full variants
- [ ] Granular cache invalidation per task

### Resource Design
- URI: `omnifocus://task/{taskId}`
- Cache TTL: 2 minutes per task
- Individual cache keys for targeted invalidation

---

## User Story 5: Analyze Project Progress

**As an** AI assistant helping with project reviews  
**I want to** access rich project data including task lists  
**So that** I can provide meaningful progress analysis

### Acceptance Criteria
- [ ] Project metadata with calculated statistics
- [ ] First 100 tasks included to avoid additional calls
- [ ] Progress percentages and completion trends
- [ ] Review dates and project health indicators
- [ ] Overdue task highlighting within project context

### Resource Design
- URI: `omnifocus://project/{projectId}`
- Cache TTL: 5 minutes per project
- Includes embedded task list

---

## User Story 6: Search by Tag Efficiently

**As an** AI assistant filtering tasks by context  
**I want to** retrieve all tasks with a specific tag  
**So that** I can provide context-specific recommendations

### Acceptance Criteria
- [ ] Case-insensitive tag matching
- [ ] Clear empty vs non-existent tag distinction
- [ ] Result count for quick assessment
- [ ] Consistent with tag format used in task creation
- [ ] Cached per tag for repeated queries

### Resource Design
- URI: `omnifocus://tag/{tagName}`
- Cache TTL: 2 minutes per tag
- URL-encoded tag names supported

---

## User Story 7: Prioritize Overdue Tasks

**As an** AI assistant helping users catch up  
**I want to** access a pre-sorted overdue task list  
**So that** I can guide urgency-based prioritization

### Acceptance Criteria
- [ ] Pre-sorted by days overdue (most overdue first)
- [ ] Calculated "days overdue" field included
- [ ] Grouped by project for context
- [ ] Excludes completed/dropped tasks automatically
- [ ] High-frequency cache updates for accuracy

### Resource Design
- URI: `omnifocus://overdue`
- Cache TTL: 30 seconds (critical data)
- Includes overdue calculations

---

## User Story 8: Support Weekly Planning

**As an** AI assistant facilitating weekly reviews  
**I want to** see a structured week-ahead view  
**So that** I can help balance workload distribution

### Acceptance Criteria
- [ ] Tasks grouped by day for the next 7 days
- [ ] Includes deferred tasks becoming available
- [ ] Daily task counts for load assessment
- [ ] Optional date range customization
- [ ] Summary statistics per day

### Resource Design
- URI: `omnifocus://week-ahead`
- Cache TTL: 5 minutes
- Structured by day with summaries

---

## User Story 9: Perform Semantic Search

**As an** AI assistant finding mentioned tasks  
**I want to** search tasks based on conversation context  
**So that** I can locate items from natural language references

### Acceptance Criteria
- [ ] Full-text search in task names and notes
- [ ] Context snippets around matches
- [ ] Result limit (100) to prevent overwhelming responses
- [ ] URL-encoded query support
- [ ] Brief caching for follow-up questions

### Resource Design
- URI: `omnifocus://search/{query}`
- Cache TTL: 1 minute per unique query
- Includes match highlighting

---

## User Story 10: Subscribe to Data Changes

**As an** AI assistant in long conversations  
**I want to** receive notifications when data changes  
**So that** I can maintain accuracy without polling

### Acceptance Criteria
- [ ] Subscribe to specific resource URIs
- [ ] Receive only relevant change notifications
- [ ] Efficient diff-based updates when possible
- [ ] Rate limiting prevents notification floods
- [ ] Graceful degradation if subscription fails

### Resource Design
- WebSocket or SSE for push updates
- Granular subscription management
- Automatic resubscription on disconnect

---

## User Story 11: Discover Available Resources

**As an** AI assistant learning the system  
**I want to** list all available resources and patterns  
**So that** I can utilize the full API surface effectively

### Acceptance Criteria
- [ ] Complete resource list with descriptions
- [ ] URI templates with parameter documentation
- [ ] Examples for each resource type
- [ ] Self-documenting parameter constraints
- [ ] Version information for compatibility

### Resource Design
- Standard MCP resource discovery
- Template system for dynamic resources
- Rich descriptions with examples

---

## User Story 12: Consume Human-Readable Formats

**As an** AI assistant presenting information  
**I want to** receive markdown-formatted responses  
**So that** I can display information naturally in conversations

### Acceptance Criteria
- [ ] Optional markdown format for applicable resources
- [ ] Task lists with checkboxes
- [ ] Projects as hierarchical documents
- [ ] Natural date and metadata formatting
- [ ] Consistent styling across resources

### Resource Design
- Query parameter: `?format=markdown`
- Same cache key as JSON version
- Presentation-ready output

---

## Bug Reports

### Bug 1: Empty Results for Active Project Filter

**As an** AI assistant listing active projects  
**I want to** receive all active projects when using status filter  
**So that** I can help users manage their current work

**Current State**: `status: ["active"]` returns empty array despite 60+ active projects
**Expected**: All active projects returned
**Impact**: Cannot assist with active project management

### Root Cause Analysis Needed
- JXA script status property accessor
- Status enum vs string comparison
- Case sensitivity in filtering
- Performance timeout with large datasets

---

### Bug 2: List Tasks Timeout with Large Databases

**As an** AI assistant listing tasks
**I want to** receive task list results within timeout limits
**So that** I can help users manage their tasks in Claude Desktop

**Current State**: `list_tasks` script times out (>30 seconds) when user has thousands of tasks
**Root Cause**: Double-loop anti-pattern - script iterates through ALL tasks twice (first to build results up to limit, second to count total matching tasks)
**Expected**: Results returned within 1 second regardless of total task count
**Impact**: P0 - MCP completely non-functional in Claude Desktop for users with large task databases

### Technical Details
- **Performance Impact**: With 5,000 tasks: ~10,000 operations (2 full passes × 5,000 tasks)
- **Bottleneck**: Second loop (lines 136-213) re-applies same filters just to count `total_items`
- **Timeout**: OmniFocus JXA script execution limit (~30 seconds) exceeded
- **Solution**: Remove second loop, replace `total_items` with `has_more` boolean (industry standard pagination pattern)

### Acceptance Criteria
- [ ] list_tasks completes within 1 second for databases with 5,000+ tasks
- [ ] Metadata returns `has_more` boolean instead of exact `total_items` count
- [ ] First loop exits immediately when limit reached (early exit optimization)
- [ ] No performance degradation for typical queries (100-500 tasks)
- [ ] Cache behavior unchanged

---

### Bug 3: Systematic Timeout Issues Across All Collection Tools

**As an** AI assistant using any MCP tool
**I want to** receive results within timeout limits for all operations
**So that** I can help users regardless of their database size

**Current State**: Multiple tools timeout (>30 seconds) on large databases:
- `list_projects` - iterates all projects with task counts
- `list_tags` - iterates all tasks to count usage stats
- `analytics` tools - iterate all tasks for statistics
- `export` tools - iterate all items for export
- `recurring` tools - iterate all tasks for pattern analysis

**Root Cause**: Systematic pattern - all tools iterate entire collections without:
1. Early exit optimization
2. Native JXA filtering (`.whose()` API)
3. Optional expensive operations (stats, counts)

**Impact**: P0 - MCP unusable for users with 2,000+ tasks/projects

### Technical Details

**Affected Scripts** (9 total):
- `src/omnifocus/scripts/projects.ts` - list_projects
- `src/omnifocus/scripts/tags.ts` - list_tags (counts all tasks per tag)
- `src/omnifocus/scripts/analytics.ts` - all analytics tools
- `src/omnifocus/scripts/export.ts` - all export tools
- `src/omnifocus/scripts/recurring.ts` - recurring pattern analysis

**Available Solutions**:
- File `tasks-fix.ts` contains `.whose()` examples (never integrated!)
- Native JXA filtering: `doc.flattenedTasks.whose({tags: {_contains: tag}})`
- Much faster than manual iteration

**Solution Pattern**:
1. Use `.whose()` for filtering when possible (OmniFocus native)
2. Make expensive operations optional (usage stats, counts)
3. Add early exit when limit reached
4. Apply BUG2 pattern to all affected scripts

### Acceptance Criteria
- [ ] All tools complete within 1 second for databases with 5,000+ items
- [ ] Use `.whose()` API for filtering where applicable
- [ ] Make expensive stats/counts optional (default: false)
- [ ] Integrate solutions from `tasks-fix.ts`
- [ ] No tool causes timeout on large databases

### Subtasks
- [x] Fix list_projects timeout (apply early exit pattern) ✅ 2025-11-19
- [x] Fix list_tags timeout (use `.whose()` from tasks-fix.ts) ✅ 2025-11-19
- [x] Fix analytics tools (switched to availableTasks()) ✅ 2025-11-19
- [ ] Fix export tools (add pagination/streaming)
- [ ] Fix recurring tools (use `.whose()` for pattern filtering)
- [ ] Remove unused `tasks-fix.ts` after integration

### Implementation Notes
**Core tools fixed (2025-11-19)**:
- Commit bf87ff8: Fix list_tasks timeout (BUG2) - removed double-loop anti-pattern
- Commit 64b0fa5: Fix list_projects timeout - applied early exit pattern
- Commit c78b99a: Fix list_tags timeout - made usage stats optional
- Commit bde6485: Fix analytics timeout - switched to availableTasks()

**Performance Impact**: All four core tool categories now complete within 1 second for databases with 5,000+ items

**Remaining Work**: Export and recurring tools still use `flattenedTasks()` and may timeout on very large databases (10,000+ tasks). These represent lower-priority operations (less frequently used). Will address as needed.

---

## Performance Requirements

**As an** AI assistant providing real-time help  
**I need** consistent sub-second response times  
**So that** conversations feel natural and responsive

### Performance Targets
- Cached responses: <100ms (p95)
- Fresh data fetch: <500ms (p95)
- Cache hit rate: >90%
- Memory usage: <100MB for cache
- Concurrent request handling: 10+ requests

---

## Error Handling

**As an** AI assistant encountering errors  
**I want** clear, actionable error messages  
**So that** I can provide helpful fallback responses

### Error Response Standards
- HTTP status codes for REST-like familiarity
- Descriptive error messages
- Suggested alternatives when applicable
- Retry-after headers for rate limits
- Correlation IDs for debugging

---

## User Story 13: Export to TaskPaper Format

**As an** AI assistant sharing task data  
**I want to** export tasks and projects in TaskPaper format  
**So that** I can share human-readable task lists with users working in plain text

### Acceptance Criteria
- [ ] Export individual projects or task selections to TaskPaper format
- [ ] Preserve task hierarchy and indentation
- [ ] Include task metadata (tags, due dates) in TaskPaper syntax
- [ ] Support both single task and bulk export
- [ ] Format follows official TaskPaper specification

### Resource Design
- URI: `omnifocus://export/taskpaper?project={projectId}` or `omnifocus://tasks?format=taskpaper`
- Returns: text/plain with TaskPaper formatted content
- Cache: Same as underlying data resource

---

## User Story 14: Import from TaskPaper Format

**As an** AI assistant receiving task lists  
**I want to** import TaskPaper formatted text to create tasks  
**So that** I can help users quickly add structured task lists from plain text

### Acceptance Criteria
- [ ] Parse valid TaskPaper format text
- [ ] Create tasks with proper hierarchy
- [ ] Apply tags and metadata from TaskPaper syntax
- [ ] Handle errors gracefully with clear feedback
- [ ] Support project creation from TaskPaper headers

### Tool Design
- Tool: `import_taskpaper` (not a resource - this modifies data)
- Input: TaskPaper formatted text
- Output: Created task/project IDs

---

## User Story 15: Present Tasks in TaskPaper Format

**As an** AI assistant displaying task structures  
**I want to** present task hierarchies in TaskPaper format  
**So that** I can show clean, scannable task lists in conversations

### Acceptance Criteria
- [ ] Any task resource can return TaskPaper format
- [ ] Consistent formatting with tabs for hierarchy
- [ ] Include relevant metadata in TaskPaper syntax
- [ ] Readable without special rendering
- [ ] Copy-paste friendly for user workflows

### Resource Design
- Query parameter: `?format=taskpaper` on any task resource
- Example: `omnifocus://agenda/today?format=taskpaper`
- Returns: text/plain MIME type

---

## Success Metrics

- **Performance**: 95% cache hit rate, <100ms cached responses
- **Reliability**: 99.9% uptime, <0.1% error rate
- **Efficiency**: 80% reduction in tool calls for read operations
- **Adoption**: Resources become primary data access method
- **Developer Experience**: Clear docs enable quick integration