# Completed Bug Fixes - Details

This document contains detailed information about completed bug fixes. The backlog only tracks one-line outcomes; full implementation details are here.

---

## BUG3: AI receives tool results within timeout limits ✅ 2025-11-19

**Problem**: Tools timing out on large OmniFocus databases (15+ minutes)

**Root Cause**: Expensive O(n*m) operations always executed, even when statistics not needed

**Solution Pattern**: Make expensive operations optional with parameters

**Tools Optimized**:
- **list_tasks** (BUG2): Removed double-loop anti-pattern, 100x faster (30s → <1s)
- **list_projects** (BUG1): Added `includeStats` parameter (default: false)
- **list_tags**: Added `includeUsageStats` parameter (default: false)
- **analyze_recurring_tasks**: Use `availableTasks()` when `activeOnly=true` (default)
- **export_projects**: Already had `includeStats` parameter
- **bulk_export**: Uses optimized sub-tools

**Performance Impact**:
- Default behavior: <5 seconds for all core tools
- With stats enabled: User explicitly opts-in to slower operations
- Pattern: `availableTasks()` instead of `flattenedTasks()` when filtering active items

**Commits**:
- bf87ff8: list_tasks optimization
- c5ba037: list_projects with includeStats
- 7c19bd1: analyze_recurring_tasks uses availableTasks()

**Documentation**: See BUG3-RESOLUTION.md for complete technical details

---

## BUG4: User creates tasks with specified project and tags ✅ 2025-11-19

**Problem**: Tasks created with `projectId` and `tags` parameters ended up in inbox without project or tags

**Root Cause**: CREATE_TASK_SCRIPT accepted parameters but never used them
- `projectId` parameter completely ignored
- Tag assignment failures silently swallowed

**Solution**:
1. **Project assignment logic**: Find project by ID and assign via `task.assignedContainer`
2. **Tag error reporting**: Track missing tags and report in `warnings` array
3. **Enhanced response**: Return `projectName`, `tagsAdded`, `tagsRequested` fields

**Implementation Details**:
```typescript
// After task creation, find and assign project
if (taskData.projectId) {
  const projects = doc.flattenedProjects();
  for (let j = 0; j < projects.length; j++) {
    if (projects[j].id() === taskData.projectId) {
      task.assignedContainer = projects[j];
      assignedProjectName = projects[j].name();
      break;
    }
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "taskId": "xyz",
  "task": {
    "id": "xyz",
    "name": "Task name",
    "inInbox": false,
    "projectName": "My Project",
    "tagsAdded": 2,
    "tagsRequested": 2
  },
  "warnings": ["Tags not found: tag1, tag2"]
}
```

**Commit**: e89dd09

**Test**: test-create-with-project-tags.ts validates project and tag assignment

---

## BUG1: AI filters projects by status correctly ✅ 2025-11-19

**Problem**: Filtering by `status: "active"` returned zero results

**Root Cause**: OmniFocus JXA returns "active status" instead of "active"

**Solution**: Normalize status values by removing " status" suffix

**Implementation**:
```typescript
status: project.status().replace(/ status$/, '')
```

**Impact**: Status filtering now works correctly for active/on-hold/dropped/completed

**Commit**: c5ba037

---

## BUG2: AI lists tasks in <1 second ✅ 2025-11-18

**Problem**: list_tasks taking 30+ seconds on large databases

**Root Cause**: Double-loop anti-pattern - iterating all tasks twice

**Solution**:
1. Removed second iteration for counting
2. Replaced `total_items` with `has_more` boolean
3. Single pass through paginated results

**Performance**: 100x faster (30+ seconds → <1 second)

**Commit**: bf87ff8

---

## Summary Statistics

**Total bugs fixed**: 4
**Date range**: 2025-11-18 to 2025-11-19
**Performance improvements**: 100x speedup on list_tasks, <5s for all tools
**Pattern discovered**: Make expensive operations optional, use availableTasks() when appropriate
