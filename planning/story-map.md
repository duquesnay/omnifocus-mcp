# OmniFocus MCP Resources - Story Map

## Overview
This story map visualizes the hierarchical structure and relationships between user stories for the OmniFocus MCP Resources project. The goal is to provide ergonomic read-only data access for AI assistants.

## Epic: Provide Ergonomic Read-Only Data Access for AI Assistants

### Theme 1: Core Resource Infrastructure
Foundation for all other resources - caching, discovery, and access patterns.

```
├── RES1: Access resource infrastructure with caching capabilities
│   └── (Foundation for all other resources)
│
└── RES2: Discover available resources and their usage patterns
    └── (Enables AI to learn and utilize full API surface)
```

### Theme 2: Daily Task Management
Resources focused on immediate, daily task workflows.

```
├── RES3: Fetch today's complete agenda in a single call
│   ├── Due today tasks
│   ├── Overdue tasks
│   └── Flagged tasks
│
├── RES9: Prioritize overdue tasks with urgency sorting
│   ├── Days overdue calculation
│   ├── Project grouping
│   └── Urgency-based ordering
│
└── RES10: View structured week-ahead planning data
    ├── Tasks by day (next 7 days)
    ├── Deferred tasks becoming available
    └── Daily load assessment
```

### Theme 3: Task Navigation & Search
Resources for finding and accessing specific tasks.

```
├── RES4: Paginate through large task lists without overflow
│   ├── Configurable page sizes
│   ├── Filter parameters
│   └── Stateless pagination
│
├── RES6: Retrieve detailed task information by ID
│   ├── Direct ID access
│   ├── Complete metadata
│   └── Granular cache invalidation
│
├── RES8: Search tasks by tag with efficient caching
│   ├── Tag-based filtering
│   ├── Case-insensitive matching
│   └── Per-tag caching
│
└── RES11: Perform semantic search across task content
    ├── Full-text search
    ├── Context snippets
    └── Natural language queries
```

### Theme 4: Project Management
Resources for project-level views and analysis.

```
├── RES5: Navigate complete project hierarchy with statistics
│   ├── Parent-child relationships
│   ├── Task statistics
│   ├── Status indicators
│   └── Folder structure
│
├── RES7: Analyze project progress with embedded task data
│   ├── Progress calculations
│   ├── First 100 tasks included
│   ├── Review dates
│   └── Health indicators
│
└── BUG1: Receive active projects when filtering by status
    └── (Bug fix needed for status filtering)
```

### Theme 5: Format & Export Options
Resources for different output formats and interoperability.

```
├── RES12: Consume human-readable markdown formats
│   ├── Optional markdown responses
│   ├── Presentation-ready output
│   └── Consistent styling
│
└── TaskPaper Integration
    ├── TPF1: Export tasks and projects in TaskPaper format
    │   ├── Preserve hierarchy
    │   ├── Include metadata
    │   └── Plain text output
    │
    ├── TPF2: Import TaskPaper formatted text (Tool, not resource)
    │   ├── Parse TaskPaper syntax
    │   ├── Create tasks/projects
    │   └── Apply tags/metadata
    │
    └── TPF3: Present task hierarchies in TaskPaper format
        ├── Query parameter option
        ├── Copy-paste friendly
        └── Clean formatting
```

### Theme 6: Real-time Updates
Advanced capability for long-running conversations.

```
└── RES13: Subscribe to data changes for long conversations
    ├── WebSocket/SSE updates
    ├── Granular subscriptions
    ├── Diff-based updates
    └── Rate limiting protection
```

## Story Relationships & Dependencies

### Core Dependencies
- **RES1** (Infrastructure) → All other resources depend on this
- **RES2** (Discovery) → Enables AI to learn about other resources

### Data Flow Relationships
- **RES3** (Today's Agenda) combines data from:
  - **RES9** (Overdue tasks)
  - **RES8** (Tag filtering for flagged)
  
- **RES7** (Project Progress) extends:
  - **RES5** (Project Hierarchy)
  - Includes embedded task data
  
- **RES11** (Semantic Search) complements:
  - **RES4** (Task Lists)
  - **RES8** (Tag Search)

### Format Relationships
- **RES12** (Markdown) + **TPF3** (TaskPaper) provide format options for:
  - **RES3** (Today's Agenda)
  - **RES4** (Task Lists)
  - **RES5** (Projects)
  - **RES7** (Project Progress)
  - **RES10** (Week Ahead)

### Bug Impact
- **BUG1** (Active project filter) blocks full functionality of:
  - **RES5** (Project Hierarchy)
  - **RES7** (Project Progress)

## Implementation Priority Suggested by Relationships

1. **Foundation Layer**
   - RES1: Infrastructure (enables everything)
   - RES2: Discovery (enables AI learning)

2. **Core Daily Use**
   - BUG1: Fix active project filtering (unblocks project features)
   - RES3: Today's agenda (highest daily value)
   - RES4: Task pagination (handles scale)

3. **Essential Navigation**
   - RES5: Project hierarchy
   - RES6: Task details by ID
   - RES8: Tag search

4. **Enhanced Analysis**
   - RES7: Project progress
   - RES9: Overdue prioritization
   - RES10: Week planning

5. **Advanced Features**
   - RES11: Semantic search
   - RES12: Markdown formats
   - TPF1-3: TaskPaper integration

6. **Future Enhancement**
   - RES13: Real-time subscriptions

## Success Indicators

The story map reveals these key success factors:
- **Complete daily workflow** coverage (agenda → tasks → projects)
- **Multiple access patterns** (ID, tag, search, pagination)
- **Format flexibility** (JSON, Markdown, TaskPaper)
- **Performance optimization** through caching at every level
- **Natural conversation flow** with single-call resources