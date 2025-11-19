# OmniFocus MCP Resources Backlog

## Overview
This backlog tracks the implementation of read-only MCP resources for OmniFocus data access, providing the AI assistant with efficient, cached access to task management data.

## Current Status
Project is in planning phase - user stories have been defined but implementation has not begun.

## Backlog Items

- [ ] BUG4: Tasks created with project and tags end up in inbox without project or tags
- [⏳] BUG3: Receive results from all tools within timeout limits (P0 - Performance)
  - Core tools fixed: list_tasks, list_projects, list_tags, analytics
  - Remaining: export, recurring tools (lower priority - less frequently used)
- [ ] RES1: Access resource infrastructure with caching capabilities
- [ ] RES2: Discover available resources and their usage patterns
- [ ] RES3: Fetch today's complete agenda in a single call
- [ ] RES4: Paginate through large task lists without overflow
- [ ] RES5: Navigate complete project hierarchy with statistics
- [ ] RES6: Retrieve detailed task information by ID
- [ ] RES7: Analyze project progress with embedded task data
- [ ] RES8: Search tasks by tag with efficient caching
- [ ] RES9: Prioritize overdue tasks with urgency sorting
- [ ] RES10: View structured week-ahead planning data
- [ ] RES11: Perform semantic search across task content
- [ ] RES12: Consume human-readable markdown formats
- [ ] TPF1: Export tasks and projects in TaskPaper format for sharing
- [ ] TPF2: Import TaskPaper formatted text to create tasks and projects
- [ ] TPF3: Present task hierarchies in TaskPaper plain text format
- [ ] RES13: Subscribe to data changes for long conversations

---

## Completed

- [x] BUG1: Receive active projects when filtering by status ✅ 2025-11-19
  - OmniFocus JXA returns "active status" instead of "active"
  - Normalized status values by removing " status" suffix
  - Fixed filtering and API response consistency
  - Commit: c5ba037
- [x] BUG2: Receive task list results within timeout limits (P0 - Performance) ✅ 2025-11-18
  - Fixed double-loop anti-pattern in list_tasks
  - Replaced total_items with has_more boolean
  - Performance: 100x faster (30+ seconds → <1 second)
  - Commit: bf87ff8