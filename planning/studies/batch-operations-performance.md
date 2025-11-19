# Study: Batch Operations for Performance Optimization

## Context

Task creation via MCP is currently slow due to individual osascript calls for each operation.

## Problem Statement

Each task creation requires:
1. Separate osascript invocation
2. OmniFocus automation engine startup
3. Script execution
4. Result parsing
5. Cache invalidation

When creating multiple tasks (e.g., from a todo list or project breakdown), this overhead compounds linearly.

## Research Questions

1. **Batch Creation Feasibility**
   - Can OmniAutomation handle multiple task creations in a single script execution?
   - What's the performance gain: N individual calls vs 1 batch call?
   - Error handling: partial success scenarios?

2. **Action Sequences / Transactions**
   - Would a "command queue" pattern be useful? (e.g., create project + create 5 tasks + set dependencies)
   - Can we batch heterogeneous operations (create task + update project + add tags)?
   - Transaction semantics: all-or-nothing vs best-effort?

3. **Implementation Approaches**

   **Option A: Batch-specific MCP tools**
   - `omnifocus_create_tasks_batch` (plural)
   - `omnifocus_batch_operations` (generic)

   **Option B: Automatic batching layer**
   - Detect rapid sequential calls
   - Queue and flush after timeout
   - Transparent to MCP client

   **Option C: Explicit transaction API**
   - `omnifocus_begin_transaction`
   - Multiple operations
   - `omnifocus_commit_transaction`

4. **Trade-offs to Explore**
   - Complexity vs performance gain
   - Error visibility (which operation failed in batch?)
   - Cache invalidation strategy for batches
   - Backward compatibility with existing tools

## Success Metrics

- **Performance**: Measure time for creating N tasks (N=1, 5, 10, 20)
  - Current: ~T seconds per task = N*T total
  - Target: Batch overhead + ε per task

- **Usability**: Does batching improve agent workflow?
  - Fewer round-trips to OmniFocus
  - Clearer intent (atomic operations)

- **Reliability**: Error handling acceptable?
  - Partial failures clearly reported
  - Rollback possible/necessary?

## Next Steps

1. **Spike**: Create prototype batch creation script
   - Test OmniAutomation batch capabilities
   - Measure performance delta
   - Identify error scenarios

2. **Analysis**: Profile current bottlenecks
   - osascript startup time
   - OmniFocus automation overhead
   - Network latency (if any)
   - JSON parsing time

3. **Decision**: Based on spike results
   - If 5x+ speedup: Implement batch tools
   - If 2-5x speedup: Consider for high-volume scenarios only
   - If <2x speedup: Not worth complexity

## Related Work

- Cache invalidation currently happens per-operation
- Some analytics tools already batch-process internally (e.g., productivity stats iterate over all tasks in one script)
- Export tools demonstrate successful bulk operations

## References

- `src/tools/export/BulkExportTool.ts` - existing bulk operation pattern
- `src/omnifocus/scripts/tasks.ts` - current single-task creation
- `src/cache/` - cache invalidation logic to adapt

---

**Status**: 📋 Proposed
**Priority**: TBD (depends on user pain points)
**Effort**: Medium (spike: 2-4h, full implementation: 1-2 days)
