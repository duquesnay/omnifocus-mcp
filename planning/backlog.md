# OmniFocus MCP Backlog
## Backlog
### v1.0 Foundation, recreated from python version
- [x] TOOL1: User creates new tasks with name, notes, dates, project, and tags v1.0
- [x] TOOL2: User updates task properties (name, notes, dates, project, tags) v1.0
- [x] TOOL3: User marks tasks as complete v1.0
- [x] TOOL4: User deletes unwanted tasks v1.0
- [x] TOOL5: User views all tasks with filtering options v1.0
- [x] TOOL6: User accesses today's agenda (due/overdue/flagged) v1.0
- [x] TOOL7: User checks task counts by status for quick overview v1.0
- [x] PROJ1: User creates new projects with hierarchy and metadata v1.0
- [x] PROJ2: User updates project properties (name, status, notes) v1.0
- [x] PROJ3: User completes entire projects v1.0
- [x] PROJ4: User deletes projects v1.0
- [x] PROJ5: User lists projects with filtering by status v1.0
- [x] TAG1: User lists all available tags v1.0
- [x] TAG2: User manages tags on tasks (add/remove) v1.0
- [x] ANAL1: User analyzes overdue tasks by age and project v1.0
- [x] ANAL2: User reviews productivity statistics across time periods v1.0
- [x] ANAL3: User tracks task completion velocity trends v1.0
- [x] EXPORT1: User exports all data in bulk (JSON format) v1.0
- [x] EXPORT2: User exports project data with tasks v1.0
- [x] EXPORT3: User exports filtered task lists v1.0
- [x] RECUR1: User analyzes recurring task patterns for optimization v1.0
- [x] RECUR2: User identifies repeat cycles across task database v1.0
### Current backlog
- [x] CACHE1: System maintains fresh data across concurrent AI sessions v1.1
- [x] CACHE2: System invalidates stale cache after write operations v1.1
- [x] CACHE3: System prevents memory leaks via TTL-based cleanup v1.1
- [x] CACHE4: System exposes cache metrics for monitoring v1.1
- [x] INFRA1: Server handles missing OmniFocus permissions gracefully v1.2
- [x] INFRA2: Users receive actionable errors on permission/config issues v1.2
- [x] QUAL1: Developer trusts operations fail visibly (not silently) 2025-11-19
- [x] BUG5: User assigns tags during task creation and sees tags applied to new task 2025-11-19
- [x] BUG3: AI receives tool results within timeout limits 2025-11-19
- [x] BUG4: User creates tasks with specified project and tags 2025-11-19
- [x] BUG1: AI filters projects by status correctly 2025-11-19
- [x] BUG2: AI lists tasks in <1 second 2025-11-18
- [ ] MCP1: System pre-loads static data (tags/projects) as MCP resources for instant access (90% latency reduction)
- [ ] FEAT1: User adds/removes individual tags without replacing all tags
- [ ] FEAT2: User locates specific task by pasting OmniFocus link into Claude
- [ ] MCP3: System provides intelligent auto-completion via MCP sampling for tags/projects
- [ ] MCP4: System enables real-time updates through MCP resource subscriptions
- [ ] MCP5: Tools embed related resources in responses for richer context
- [ ] QA1: Developers verify tool behavior via integration test suite
- [ ] RES1: AI assistant retrieves task data in <100ms via cached resources
- [ ] RES2: AI assistant discovers available data sources without reading documentation
- [ ] RES3: AI assistant fetches today's complete agenda in single request
- [ ] RES4: AI assistant handles large task lists without memory overflow
- [ ] RES5: AI assistant navigates project hierarchy with embedded statistics
- [ ] RES6: AI assistant retrieves detailed task information by ID efficiently
- [ ] RES7: AI assistant analyzes project progress with embedded task data
- [ ] RES8: AI assistant searches tasks by tag with efficient caching
- [ ] RES9: AI assistant prioritizes work with overdue tasks sorted by urgency
- [ ] RES10: AI assistant plans week ahead with structured data view
- [ ] RES11: AI assistant performs semantic search across task content
- [ ] RES12: AI assistant reads task data in human-readable markdown format
- [ ] RES13: AI assistant receives data change notifications during long conversations
- [ ] QA2: Developers validate protocol compliance via automated E2E tests
- [ ] TPF1: User exports tasks and projects in TaskPaper format for sharing
- [ ] TPF2: User imports TaskPaper formatted text to create tasks and projects
- [ ] TPF3: AI assistant presents task hierarchies in TaskPaper plain text format
- [ ] MCP2: System exposes GTD workflow templates as MCP prompts (weekly-review, inbox-processing)


---

## Technical Investment Ratio

**Total Items**: 52 (18 planned + 34 completed)

### Completed (34 items)
- **Feature Capabilities**: 22 items (65%)
  - Task operations: 7 (TOOL1-7)
  - Project operations: 5 (PROJ1-5)
  - Tag operations: 2 (TAG1-2)
  - Analytics: 3 (ANAL1-3)
  - Export: 3 (EXPORT1-3)
  - Recurring: 2 (RECUR1-2)
- **Technical Capabilities**: 12 items (35%)
  - Cache system: 4 (CACHE1-4)
  - Infrastructure: 2 (INFRA1-2)
  - Bug fixes: 5 (BUG1-5)
  - Quality: 1 (QUAL1)

### Planned (18 items)
- **Feature Capabilities**: 18 items (100%)
  - Resources: 13 (RES1-13)
  - TaskPaper: 3 (TPF1-3)
  - Features: 2 (FEAT1-2)
- **Technical Capabilities**: 0 items (0%)

### Overall Analysis
**Completed work**: 🟢 **Green Zone** (35% technical investment)
- Excellent balance maintained through v1.0-v1.3
- Strong quality foundation with QUAL1 completing silent failure audit
- BUG5 + QUAL1 establish best-effort pattern for operations

**Planned work**: 🔴 **Red Zone** (0% technical investment)
- Pure feature focus (Resources + TaskPaper)
- **Recommendation**: Add QA infrastructure items (QA1-2) to planned work before implementing all resources

**Combined ratio**: 23% technical investment (12/52)
- Healthy overall trajectory
- Quality foundation established (fail-fast patterns, BulkExport best-effort)
- Monitor as resource features are added