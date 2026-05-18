# OmniFocus MCP - User Stories

## Overview
This document contains detailed user stories for all OmniFocus MCP capabilities, organized by epic and implementation phase.

---

## Epic 1: Core Task Management Operations

### User Story: TOOL1 - Create Tasks
**As a** user managing my work
**I want to** create new tasks with complete metadata (name, notes, dates, project, tags)
**So that** I can capture actionable items with all necessary context

**Acceptance Criteria**:
- [x] Create task with name only (minimal viable task)
- [x] Optionally specify due date, defer date
- [x] Attach to project via project name or ID
- [x] Apply multiple tags during creation
- [x] Add notes for additional context
- [x] Return created task ID for reference
- [x] Validate date formats and project/tag existence

**Status**: ✅ Completed v1.0

---

### User Story: TOOL2 - Update Tasks
**As a** user refining my task list
**I want to** update any task property without recreation
**So that** I can keep tasks current as priorities change

**Acceptance Criteria**:
- [x] Update name, notes independently
- [x] Modify due date, defer date
- [x] Reassign to different project
- [x] Replace or append tags
- [x] Clear optional fields (dates, project)
- [x] Preserve unchanged properties
- [x] Return confirmation of changes

**Status**: ✅ Completed v1.0

---

### User Story: TOOL3 - Complete Tasks
**As a** user finishing work
**I want to** mark tasks complete with single operation
**So that** I can track progress efficiently

**Acceptance Criteria**:
- [x] Complete task by ID
- [x] Set completion timestamp
- [x] Remove from available task list
- [x] Preserve in completed history
- [x] Return confirmation
- [x] Handle already-completed tasks gracefully

**Status**: ✅ Completed v1.0

---

### User Story: TOOL4 - Delete Tasks
**As a** user managing irrelevant items
**I want to** permanently delete tasks
**So that** I can remove clutter from my system

**Acceptance Criteria**:
- [x] Delete task by ID
- [x] Confirm deletion irreversibility
- [x] Return success confirmation
- [x] Handle missing task IDs gracefully
- [x] No cascading project deletion

**Status**: ✅ Completed v1.0

---

### User Story: TOOL5 - List Tasks
**As a** user reviewing my workload
**I want to** view filtered task lists with rich metadata
**So that** I can understand current commitments

**Acceptance Criteria**:
- [x] List all available tasks
- [x] Filter by project, tag, status
- [x] Include full task metadata
- [x] Support pagination for large lists
- [x] Sort by due date, creation date
- [x] Return task counts with results

**Status**: ✅ Completed v1.0

---

### User Story: TOOL6 - Today's Agenda
**As a** user planning my day
**I want to** see consolidated agenda (due/overdue/flagged)
**So that** I can prioritize immediate work

**Acceptance Criteria**:
- [x] Return tasks due today
- [x] Include overdue tasks prominently
- [x] Show flagged tasks for attention
- [x] Pre-sorted by priority
- [x] Single-call efficiency
- [x] Full context per task

**Status**: ✅ Completed v1.0

---

### User Story: TOOL7 - Task Count
**As a** user assessing workload
**I want to** get quick task counts by status
**So that** I can gauge overall progress

**Acceptance Criteria**:
- [x] Count available tasks
- [x] Count completed tasks
- [x] Count overdue tasks
- [x] Count flagged tasks
- [x] Sub-second response time
- [x] No detailed data overhead

**Status**: ✅ Completed v1.0

---

## Epic 2: Project Management Operations

### User Story: PROJ1 - Create Projects
**As a** user organizing work
**I want to** create projects with hierarchy and metadata
**So that** I can structure complex initiatives

**Acceptance Criteria**:
- [x] Create project with name
- [x] Nest under parent project
- [x] Set project status (active/on-hold/dropped)
- [x] Add project notes
- [x] Return project ID
- [x] Support sequential/parallel task ordering

**Status**: ✅ Completed v1.0

---

### User Story: PROJ2 - Update Projects
**As a** user managing project lifecycle
**I want to** update project properties independently
**So that** I can reflect changing priorities

**Acceptance Criteria**:
- [x] Update name, notes
- [x] Change status (active ↔ on-hold ↔ dropped)
- [x] Reassign parent project
- [x] Modify review dates
- [x] Preserve unchanged properties
- [x] Return confirmation

**Status**: ✅ Completed v1.0

---

### User Story: PROJ3 - Complete Projects
**As a** user finishing initiatives
**I want to** mark entire projects complete
**So that** I can close completed work

**Acceptance Criteria**:
- [x] Complete project by ID
- [x] Set completion timestamp
- [x] Handle incomplete tasks appropriately
- [x] Remove from active list
- [x] Preserve in history
- [x] Return confirmation

**Status**: ✅ Completed v1.0

---

### User Story: PROJ4 - Delete Projects
**As a** user managing obsolete projects
**I want to** permanently delete projects
**So that** I can remove abandoned initiatives

**Acceptance Criteria**:
- [x] Delete project by ID
- [x] Handle contained tasks (delete or orphan)
- [x] Confirm irreversibility
- [x] Return success confirmation
- [x] Handle missing project IDs gracefully

**Status**: ✅ Completed v1.0

---

### User Story: PROJ5 - List Projects
**As a** user reviewing initiatives
**I want to** view filtered project lists with metadata
**So that** I can assess organizational structure

**Acceptance Criteria**:
- [x] List all projects
- [x] Filter by status (active/on-hold/dropped/completed)
- [x] Include task counts per project
- [x] Show hierarchy relationships
- [x] Include review dates
- [x] Support pagination

**Status**: ✅ Completed v1.0

---

## Epic 3: Tag and Context Management

### User Story: TAG1 - List Tags
**As a** user working with contexts
**I want to** see all available tags with usage statistics
**So that** I can understand tag taxonomy

**Acceptance Criteria**:
- [x] List all tags in system
- [x] Include task counts per tag
- [x] Show active vs total tasks
- [x] Fast retrieval (<1 second)
- [x] Alphabetical sorting
- [x] Handle empty tag list

**Status**: ✅ Completed v1.0

---

### User Story: TAG2 - Manage Tags
**As a** user organizing tasks by context
**I want to** add/remove tags from tasks
**So that** I can categorize work flexibly

**Acceptance Criteria**:
- [x] Add tags to task
- [x] Remove tags from task
- [x] Replace all tags
- [x] Create tags implicitly during add
- [x] Return updated tag list
- [x] Handle non-existent tags gracefully

**Status**: ✅ Completed v1.0

---

## Epic 4: Analytics and Insights

### User Story: ANAL1 - Overdue Analysis
**As a** user managing delays
**I want to** analyze overdue tasks by age and project
**So that** I can prioritize catch-up work

**Acceptance Criteria**:
- [x] Calculate days overdue per task
- [x] Group by project for context
- [x] Sort by urgency (most overdue first)
- [x] Include task metadata
- [x] Filter out completed/dropped
- [x] Fast computation (<1 second)

**Status**: ✅ Completed v1.0

---

### User Story: ANAL2 - Productivity Statistics
**As a** user reviewing performance
**I want to** see productivity stats across time periods
**So that** I can identify trends

**Acceptance Criteria**:
- [x] Calculate completion rate
- [x] Track tasks completed per day/week/month
- [x] Compare periods (this week vs last)
- [x] Include task velocity
- [x] Generate summary statistics
- [x] Fast computation with caching

**Status**: ✅ Completed v1.0

---

### User Story: ANAL3 - Task Velocity
**As a** user optimizing workflow
**I want to** track task completion velocity over time
**So that** I can forecast capacity

**Acceptance Criteria**:
- [x] Calculate tasks completed per time unit
- [x] Show trending (up/down/stable)
- [x] Include moving averages
- [x] Break down by project/tag
- [x] Identify bottlenecks
- [x] Export velocity data

**Status**: ✅ Completed v1.0

---

## Epic 5: Data Export and Integration

### User Story: EXPORT1 - Bulk Export
**As a** user backing up data
**I want to** export all OmniFocus data in JSON format
**So that** I can archive or process externally

**Acceptance Criteria**:
- [x] Export all tasks, projects, tags
- [x] Include complete metadata
- [x] Generate valid JSON
- [x] Handle large datasets (streaming if needed)
- [x] Return download link or file
- [x] Preserve relationships (task → project)

**Status**: ✅ Completed v1.0

---

### User Story: EXPORT2 - Export Projects
**As a** user sharing project data
**I want to** export specific projects with tasks
**So that** I can collaborate or archive selectively

**Acceptance Criteria**:
- [x] Export project by ID
- [x] Include all contained tasks
- [x] Preserve hierarchy
- [x] Include metadata
- [x] JSON format
- [x] Handle empty projects

**Status**: ✅ Completed v1.0

---

### User Story: EXPORT3 - Export Tasks
**As a** user extracting filtered data
**I want to** export task lists matching criteria
**So that** I can analyze subsets externally

**Acceptance Criteria**:
- [x] Export with same filters as list_tasks
- [x] Include full task metadata
- [x] JSON format
- [x] Handle large result sets
- [x] Preserve sort order
- [x] Return task count with export

**Status**: ✅ Completed v1.0

---

## Epic 6: Recurring Task Intelligence

### User Story: RECUR1 - Analyze Patterns
**As a** user optimizing recurring work
**I want to** analyze recurring task patterns
**So that** I can identify optimization opportunities

**Acceptance Criteria**:
- [x] Identify repeat cycles (daily/weekly/monthly)
- [x] Calculate repeat frequency
- [x] Group by pattern type
- [x] Show pattern health (on-time vs late)
- [x] Suggest optimizations
- [x] Fast analysis (<2 seconds)

**Status**: ✅ Completed v1.0

---

### User Story: RECUR2 - Identify Cycles
**As a** user managing repeated work
**I want to** see all recurring patterns in database
**So that** I can understand regular commitments

**Acceptance Criteria**:
- [x] List all recurring task rules
- [x] Show next occurrence dates
- [x] Include pattern metadata
- [x] Count occurrences completed
- [x] Identify broken patterns
- [x] Return structured data

**Status**: ✅ Completed v1.0

---

## Epic 7: Performance and Caching

### User Story: CACHE1 - Concurrent Sessions
**As a** system serving multiple AI conversations
**I want to** maintain fresh data across 5+ concurrent sessions
**So that** all conversations see consistent state

**Acceptance Criteria**:
- [x] Support 10+ concurrent requests
- [x] Thread-safe cache operations
- [x] No cache collision between sessions
- [x] Shared cache for efficiency
- [x] Memory limit enforcement (<100MB)
- [x] Graceful degradation under load

**Status**: ✅ Completed v1.1

---

### User Story: CACHE2 - Write Invalidation
**As a** system maintaining data consistency
**I want to** invalidate stale cache after write operations
**So that** reads never return outdated data

**Acceptance Criteria**:
- [x] Invalidate on task create/update/delete
- [x] Invalidate on project create/update/delete
- [x] Selective invalidation (not full flush)
- [x] Immediate invalidation (no delay)
- [x] Cascade invalidation (task → project list)
- [x] No race conditions

**Status**: ✅ Completed v1.1

---

### User Story: CACHE3 - Memory Management
**As a** system running long-term
**I want to** prevent memory leaks via TTL-based cleanup
**So that** server remains stable over days/weeks

**Acceptance Criteria**:
- [x] TTL-based entry expiration (30s - 1h)
- [x] Automatic cleanup of expired entries
- [x] Memory monitoring
- [x] Configurable TTL per cache type
- [x] Cleanup runs every 5 minutes
- [x] No memory growth over time

**Status**: ✅ Completed v1.1

---

### User Story: CACHE4 - Metrics Monitoring
**As a** developer optimizing performance
**I want to** track cache hit/miss rates and memory usage
**So that** I can tune cache parameters

**Acceptance Criteria**:
- [x] Expose hit/miss counters
- [x] Track memory usage per cache
- [x] Calculate hit rate percentage
- [x] Log metrics periodically
- [x] Expose via debug endpoint
- [x] Include cache size statistics

**Status**: ✅ Completed v1.1

---

## Epic 8: Infrastructure and Error Handling

### User Story: INFRA1 - Permission Handling
**As a** server dealing with macOS security
**I want to** handle missing OmniFocus permissions gracefully
**So that** users receive actionable guidance

**Acceptance Criteria**:
- [x] Detect permission errors (code -1743)
- [x] Check permissions on startup (non-blocking)
- [x] Return clear error messages
- [x] Continue running without permissions
- [x] Cache permission status
- [x] Guide users to System Settings

**Status**: ✅ Completed v1.2

---

### User Story: INFRA2 - Error Messages
**As a** user encountering configuration issues
**I want to** receive actionable error messages
**So that** I can resolve problems independently

**Acceptance Criteria**:
- [x] Clear error descriptions (no jargon)
- [x] Include resolution steps
- [x] Link to documentation
- [x] Appropriate error codes (MCP standard)
- [x] Contextual help based on error type
- [x] Log errors for debugging

**Status**: ✅ Completed v1.2

---

## Epic 9: Provide Ergonomic Read-Only Data Access for AI Assistants

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

## Epic 10: Link-Based Task Discovery

### User Story: FEAT2 - Find Task by OmniFocus Link

**As a** user sharing task context with Claude
**I want to** paste an OmniFocus task link and have Claude locate the specific task
**So that** I can quickly reference tasks from OmniFocus without manual searching

**Acceptance Criteria**:
- [ ] Parse OmniFocus URL scheme links (omnifocus:///task/{taskId})
- [ ] Extract task ID from link format
- [ ] Retrieve task details using extracted ID
- [ ] Handle invalid/malformed links with clear error messages
- [ ] Support both conversation paste and future iOS/desktop share workflows
- [ ] Return full task context (name, notes, project, tags, dates)
- [ ] Cache task data per standard caching rules

**Technical Notes**:
- OmniFocus link format: `omnifocus:///task/{taskId}` (URL-encoded)
- May need to handle multiple link formats (v3 vs v4, macOS vs iOS)
- Consider adding tool: `find_task_by_link` in addition to ID-based lookup
- Future enhancement: Support project links (`omnifocus:///project/{projectId}`)

**Status**: ⏳ Planned

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

---

## Bug Fixes

### BUG5: User creates new tags successfully

**User**: Task manager organizing tasks with custom tags
**Outcome**: Tag creation completes without errors and tag becomes immediately available
**Context**: Current `app.Tag({name: tagName})` API call fails with "Can't convert types" error, preventing any tag creation

**Acceptance Criteria**:
- Tag creation request returns success (not error JSON)
- Created tag appears in list_tags results immediately
- Created tag can be applied to tasks without errors
- Error message displays clearly if tag name already exists
- Cache invalidates only after successful creation

**Implementation Notes**:
- Research correct OmniFocus JXA API for tag creation
- Likely `doc.tags.push(Tag.make({name: tagName}))` or similar
- Test with MCP Inspector to verify protocol-level success

**Source**: USER_REPORT (2025-11-19) - "Error adding tags: Error: Can't convert types"

---

## Technical Capabilities

### QUAL1: Developer trusts operations fail visibly (not silently)

**User**: Developer implementing or debugging MCP tools
**Outcome**: Failed operations throw exceptions immediately rather than returning error JSON that gets ignored
**Context**: Current pattern allows operations to "succeed" with error JSON payload, leading to cache invalidation before validation, silent failures, and half-completed operations

**Acceptance Criteria**:
- All tool operations validate `result.success === true` before returning
- Failed operations throw `McpError` with appropriate error codes
- Cache invalidation happens ONLY after operation success validation
- Integration tests verify operations fail fast on error conditions
- No tool returns `{error: true, message: "..."}` without throwing exception

**Implementation Notes**:
- Pattern to enforce in all tools:
  ```typescript
  const result = await this.omniAutomation.execute(script);
  if (result.error || !result.success) {
    throw new McpError(ErrorCode.InternalError, result.message);
  }
  // Only invalidate cache AFTER validation
  this.cache.clear('tags');
  return result;
  ```
- Review all 15+ tools for this pattern
- Add integration tests for failure scenarios
- Applies to: tasks, projects, tags, analytics tools

**Source**: QUALITY_REVIEW (2025-11-19) - Systemic pattern of silent failures across all tool operations

---