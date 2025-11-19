# OmniFocus MCP - Story Map

## Overview
This story map visualizes the complete feature landscape of OmniFocus MCP, including implemented capabilities (v1.0-v1.3) and planned enhancements (Resources, TaskPaper, QA infrastructure).

**Legend**:
- ✅ Completed features
- 🔄 Planned features
- 🔧 Technical capabilities

---

## Epic 1: Core Task Management (✅ Completed v1.0)

### Theme 1.1: Task CRUD Operations
Foundation for all task manipulation.

```
✅ TOOL1: Create Tasks
│   ├── Name, notes, dates
│   ├── Project assignment
│   └── Tag application
│
✅ TOOL2: Update Tasks
│   ├── Modify all properties
│   ├── Reassign project
│   └── Update tags
│
✅ TOOL3: Complete Tasks
│   └── Mark done with timestamp
│
✅ TOOL4: Delete Tasks
│   └── Permanent removal
```

### Theme 1.2: Task Discovery
Finding and viewing tasks efficiently.

```
✅ TOOL5: List Tasks
│   ├── Filter by project/tag/status
│   ├── Pagination support
│   └── Rich metadata
│
✅ TOOL6: Today's Agenda
│   ├── Due today tasks
│   ├── Overdue tasks
│   └── Flagged tasks
│
✅ TOOL7: Task Counts
│   └── Quick status overview
```

---

## Epic 2: Project Management (✅ Completed v1.0)

### Theme 2.1: Project Lifecycle
Complete project management operations.

```
✅ PROJ1: Create Projects
│   ├── Hierarchy support
│   ├── Status configuration
│   └── Metadata
│
✅ PROJ2: Update Projects
│   ├── Name, notes
│   ├── Status changes
│   └── Parent reassignment
│
✅ PROJ3: Complete Projects
│   └── Mark done
│
✅ PROJ4: Delete Projects
│   └── Permanent removal
│
✅ PROJ5: List Projects
│   ├── Filter by status
│   ├── Task counts
│   └── Hierarchy view
```

---

## Epic 3: Tag & Context Management (✅ Completed v1.0)

```
✅ TAG1: List Tags
│   ├── All tags in system
│   ├── Usage statistics
│   └── Fast retrieval
│
✅ TAG2: Manage Tags
│   ├── Add tags to tasks
│   ├── Remove tags
│   └── Replace all tags
│
🔄 FEAT1: Incremental Tag Management (Planned)
    ├── Add without replace
    └── Remove without replace
```

---

## Epic 4: Analytics & Insights (✅ Completed v1.0)

```
✅ ANAL1: Overdue Analysis
│   ├── Days overdue calculation
│   ├── Project grouping
│   └── Urgency sorting
│
✅ ANAL2: Productivity Statistics
│   ├── Completion rates
│   ├── Time period comparisons
│   └── Velocity tracking
│
✅ ANAL3: Task Velocity
│   ├── Completion trends
│   ├── Moving averages
│   └── Bottleneck identification
```

---

## Epic 5: Data Export & Integration (✅ Completed v1.0)

```
✅ EXPORT1: Bulk Export
│   ├── All data to JSON
│   ├── Complete metadata
│   └── Relationship preservation
│
✅ EXPORT2: Export Projects
│   ├── Project + tasks
│   ├── Hierarchy preservation
│   └── Selective export
│
✅ EXPORT3: Export Tasks
│   ├── Filtered exports
│   └── Same filters as list
```

---

## Epic 6: Recurring Task Intelligence (✅ Completed v1.0)

```
✅ RECUR1: Analyze Patterns
│   ├── Cycle identification
│   ├── Frequency analysis
│   ├── Pattern health
│   └── Optimization suggestions
│
✅ RECUR2: Identify Cycles
│   ├── List recurring rules
│   ├── Next occurrences
│   └── Completion tracking
```

---

## Epic 7: Performance & Caching (✅ Completed v1.1)

### Theme 7.1: Cache Infrastructure
Smart caching for sub-second responses.

```
✅ CACHE1: Concurrent Sessions
│   ├── 10+ concurrent requests
│   ├── Thread-safe operations
│   ├── Shared cache efficiency
│   └── Memory limits (<100MB)
│
✅ CACHE2: Write Invalidation
│   ├── Selective invalidation
│   ├── Immediate updates
│   ├── Cascade logic
│   └── No race conditions
│
✅ CACHE3: Memory Management
│   ├── TTL-based expiration
│   ├── Automatic cleanup
│   ├── No memory leaks
│   └── Configurable per cache
│
✅ CACHE4: Metrics Monitoring
│   ├── Hit/miss tracking
│   ├── Memory usage stats
│   └── Performance tuning data
```

---

## Epic 8: Infrastructure & Error Handling (✅ Completed v1.2)

```
✅ INFRA1: Permission Handling
│   ├── Detect macOS permission errors
│   ├── Non-blocking checks
│   ├── Graceful degradation
│   └── User guidance
│
✅ INFRA2: Error Messages
│   ├── Clear descriptions
│   ├── Resolution steps
│   ├── MCP standard codes
│   └── Contextual help
```

---

## Epic 9: Provide Ergonomic Read-Only Data Access for AI Assistants

### Theme 9.1: Core Resource Infrastructure (🔄 Planned)
Foundation for all other resources - caching, discovery, and access patterns.

```
🔄 RES1: Access Resource Infrastructure
│   ├── <100ms cached responses
│   ├── MCP resource protocol
│   └── Foundation for all resources
│
🔄 RES2: Resource Discovery
│   ├── List available resources
│   ├── URI templates
│   └── Self-documenting API
```

### Theme 9.2: Daily Task Management (🔄 Planned)
Resources focused on immediate, daily task workflows.

```
🔄 RES3: Today's Agenda Resource
│   ├── Single-call agenda fetch
│   ├── Due/overdue/flagged
│   └── Pre-sorted by priority
│
🔄 RES9: Overdue Priority Resource
│   ├── Urgency-sorted overdue tasks
│   ├── Days overdue calculation
│   └── Project context grouping
│
🔄 RES10: Week-Ahead Planning Resource
│   ├── 7-day structured view
│   ├── Deferred task emergence
│   └── Daily workload balance
```

### Theme 9.3: Task Navigation & Search (🔄 Planned)
Resources for finding and accessing specific tasks.

```
🔄 RES4: Paginated Task List Resource
│   ├── Large list handling
│   ├── Configurable page sizes
│   ├── Stateless pagination
│   └── Memory-efficient
│
🔄 RES6: Task Detail by ID Resource
│   ├── Direct ID lookup
│   ├── Complete metadata
│   └── Granular cache invalidation
│
🔄 RES8: Tag-Based Search Resource
│   ├── Tag filtering
│   ├── Case-insensitive matching
│   └── Per-tag caching
│
🔄 RES11: Semantic Search Resource
│   ├── Full-text search
│   ├── Context snippets
│   └── Natural language queries
```

### Theme 9.4: Project Management Resources (🔄 Planned)
Resources for project-level views and analysis.

```
🔄 RES5: Project Hierarchy Resource
│   ├── Parent-child relationships
│   ├── Task statistics embedded
│   ├── Status indicators
│   └── Folder structure
│
🔄 RES7: Project Progress Analysis Resource
│   ├── Progress calculations
│   ├── First 100 tasks embedded
│   ├── Review date tracking
│   └── Health indicators
```

### Theme 9.5: Format & Export Options (🔄 Planned)
Resources for different output formats and interoperability.

```
🔄 RES12: Markdown Format Resource
│   ├── Human-readable output
│   ├── Presentation-ready
│   └── Consistent styling
│
🔄 TaskPaper Integration
    ├── TPF1: TaskPaper Export Resource
    │   ├── Preserve hierarchy
    │   ├── Include metadata
    │   └── Plain text output
    │
    ├── TPF2: TaskPaper Import Tool (write operation)
    │   ├── Parse TaskPaper syntax
    │   ├── Create tasks/projects
    │   └── Apply tags/metadata
    │
    └── TPF3: TaskPaper Format Option
        ├── Query parameter on resources
        ├── Copy-paste friendly
        └── Clean indentation
```

### Theme 9.6: Real-time Updates (🔄 Planned)
Advanced capability for long-running conversations.

```
🔄 RES13: Data Change Subscription
│   ├── WebSocket/SSE updates
│   ├── Granular subscriptions
│   ├── Diff-based updates
│   └── Rate limiting protection
```

---

## Epic 10: Quality Assurance Infrastructure (🔄 Planned)

```
🔄 QA1: Integration Test Suite
│   ├── Tool behavior verification
│   ├── Real OmniFocus integration
│   ├── Comprehensive coverage
│   └── CI/CD integration
│
🔄 QA2: E2E Protocol Tests
│   ├── MCP protocol compliance
│   ├── Claude Desktop simulation
│   ├── Error handling verification
│   └── Performance benchmarks
```

## Story Relationships & Dependencies

### Foundation Dependencies (✅ Complete)
**Epic 1-8** provide the complete foundation:
- All CRUD operations (TOOL1-7, PROJ1-5, TAG1-2)
- Analytics and insights (ANAL1-3)
- Export capabilities (EXPORT1-3)
- Recurring intelligence (RECUR1-2)
- Performance infrastructure (CACHE1-4)
- Error handling (INFRA1-2)

### Planned Feature Dependencies (🔄 Future)

**Resource Infrastructure** (Must implement first):
- **RES1** (Infrastructure) → Foundation for all resources
- **RES2** (Discovery) → Enables resource exploration

**Data Access Resources** (Build on foundation):
- **RES3** (Today's Agenda) → Uses existing TOOL6 logic
- **RES4** (Paginated Lists) → Uses existing TOOL5 logic
- **RES6** (Task by ID) → Direct lookup capability
- **RES5** (Project Hierarchy) → Uses existing PROJ5 logic
- **RES7** (Project Progress) → Extends RES5 with analytics

**Search Resources** (Independent):
- **RES8** (Tag Search) → Tag-based filtering
- **RES11** (Semantic Search) → Full-text capabilities

**Format Options** (Cross-cutting):
- **RES12** (Markdown) → Applies to all resources
- **TPF3** (TaskPaper format) → Applies to task/project resources
- **TPF1** (TaskPaper export) → Standalone export
- **TPF2** (TaskPaper import) → Standalone import

**Advanced Features** (Long-term):
- **RES9** (Overdue Priority) → Enhanced ANAL1
- **RES10** (Week Ahead) → Extended planning view
- **RES13** (Subscriptions) → Real-time updates

### Tool vs Resource Architecture

**Implemented (Tools - Write Operations)**:
- All v1.0-v1.3 features use MCP **Tools** (can modify data)
- Proper for CRUD operations

**Planned (Resources - Read-Only)**:
- Epic 9 features use MCP **Resources** (read-only, cacheable)
- Better for AI assistant data access patterns
- Reduces token overhead from tool descriptions

### Quality Assurance Blockers

**QA1-2** are blocked by:
- Need stable resource implementation first
- Integration tests require resource endpoints
- E2E tests validate protocol compliance

## Implementation Priority Suggested by Relationships

### Phase 1: Foundation Complete ✅ (v1.0-v1.3)
All essential CRUD operations, analytics, caching, and error handling implemented.

### Phase 2: Resource Infrastructure 🔄 (Next)
1. **RES1**: Resource infrastructure (enables everything)
2. **RES2**: Discovery mechanism (enables AI learning)
3. **FEAT1**: Incremental tag management (closes gap in TAG2)

### Phase 3: Core Resources 🔄
4. **RES3**: Today's agenda resource (highest daily value)
5. **RES4**: Paginated task lists (handles scale)
6. **RES6**: Task by ID (direct lookup)
7. **RES5**: Project hierarchy (essential structure)

### Phase 4: Enhanced Resources 🔄
8. **RES7**: Project progress analysis
9. **RES8**: Tag-based search
10. **RES9**: Overdue prioritization
11. **RES10**: Week-ahead planning

### Phase 5: Format Options 🔄
12. **RES12**: Markdown formats
13. **TPF1**: TaskPaper export
14. **TPF2**: TaskPaper import
15. **TPF3**: TaskPaper presentation

### Phase 6: Advanced Features 🔄
16. **RES11**: Semantic search
17. **RES13**: Real-time subscriptions

### Phase 7: Quality Infrastructure 🔄
18. **QA1**: Integration test suite
19. **QA2**: E2E protocol tests

---

## Success Indicators

### Achieved (v1.0-v1.3) ✅
- ✅ Complete CRUD operations for tasks, projects, tags
- ✅ Rich analytics and insights
- ✅ Smart caching with <100ms responses
- ✅ Concurrent session support
- ✅ Graceful error handling
- ✅ Export capabilities

### Target (Resources Implementation) 🎯
- 🎯 Ergonomic read-only data access for AI
- 🎯 Single-call resource efficiency
- 🎯 Multiple format options (JSON/Markdown/TaskPaper)
- 🎯 Comprehensive test coverage (integration + E2E)
- 🎯 Resource discovery and self-documentation
- 🎯 Real-time update subscriptions

### Key Architectural Shift
**From**: Tool-based (write-capable) data access
**To**: Resource-based (read-only, cacheable) + Tools for writes
**Why**: Better token efficiency, caching, and AI assistant UX