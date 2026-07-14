# BUG: Concurrent `update_task` projectId-moves silently race and drop most writes

## Status: ✅ RESOLVED — fixed 2026-07-14, verified (uncommitted, awaiting review)

## Resolution

Both fix directions implemented as designed:

- **Write serialization** (`src/omnifocus/OmniAutomation.ts`): a static
  `writeQueue`/`enqueueWrite()` promise chain now funnels every mutating call
  (`executeWrite()` and `executeViaUrlScheme()`) through a single
  process-global queue, so only one `osascript` write process runs against
  OmniFocus at a time — regardless of how many tool calls arrive
  concurrently, and regardless of which tool instance issues them. Made
  **static** (not instance-level) after confirming each tool class
  constructs its own `OmniAutomation` instance (`src/tools/base.ts:12`) —
  instance-level state would only have serialized writes within a single
  tool, not across e.g. a concurrent `update_task` + `delete_task`. Plain
  reads (`execute()` — list/get/count/analytics/export) are untouched and
  remain concurrent.
- **Hardened projectId-move verification** (`src/omnifocus/scripts/tasks.ts`):
  after the existing held-handle re-check (kept verbatim), a bounded
  2-attempt retry (~200ms sleep) re-fetches the task fresh by ID via a
  second `evaluateJavascript` OmniJS call and accepts success if either the
  held handle or the fresh fetch confirms the destination project.

All 9 mutating tools (Create/Update/Delete/Complete for tasks and projects,
plus ManageTags) switched from `execute` to `executeWrite`. The existing
`tests/unit/projectid-omnijs-fallback.test.ts` literal-string assertions
were preserved unmodified (verified via diff) with 4 new test cases
appended (12/12 pass). New `tests/unit/concurrent-write-serialization.test.ts`
(5/5 pass) mocks `child_process.spawn` to verify: max 1 active write process
at a time, FIFO completion order, a rejected write doesn't poison the queue,
and reads still overlap freely. `npm run typecheck` clean. Independently
re-verified (not just agent self-report) 2026-07-14 21:32.

Net diff: 12 files, +143/-13 lines. Scoped exactly to this fix — no
unrelated changes. Not yet committed; working tree left for Arne's review.

---

## Original report (as filed, superseded by the resolution above)

Status when filed: OPEN — reproduced live 2026-07-14, session evidence attached below

## Summary

The projectId-move fix merged 2026-07-04 (`5bb54f9 merge: projectId-Echtfix`,
OmniJS `moveTasks()` fallback + read-back verification in
`src/omnifocus/scripts/tasks.ts`) works correctly for **isolated** calls, but
breaks down when **multiple `update_task` calls targeting the same
destination project are fired concurrently** (i.e. as a parallel tool-call
batch from an MCP client). Symptom:

- Of N concurrent moves to the same project, typically only 1 succeeds.
- The other N-1 report `error: true, "Update verification failed for:
  projectId (containingProject id is <old>, expected <new>)"` — and in this
  case the error is **accurate**: the task genuinely never moved.
- Confusingly, the *same* error message is also produced as a **false
  negative** on isolated (non-concurrent) calls that actually succeeded — see
  reproduction case 3 below. So the verification step itself has two
  independent problems: (a) it doesn't hold up under concurrent writers, and
  (b) even in isolation it sometimes misreports success as failure.

## Root cause hypothesis

`OmniAutomation.execute()` (`src/omnifocus/OmniAutomation.ts:31`) spawns a
brand-new `osascript -l JavaScript` child process per call with **no queue,
mutex, or serialization** across calls:

```ts
const proc = spawn('osascript', ['-l', 'JavaScript'], { ... });
```

When an MCP client (e.g. Claude Code) issues several `update_task` calls in
one batch, they are dispatched concurrently, so N independent `osascript`
processes hit the same running OmniFocus.app simultaneously via Apple
Events / JXA. The move logic itself
(`src/omnifocus/scripts/tasks.ts:616-646`) does:

1. `task.assignedContainer = project` (JXA setter — proven unreliable on OF
   4.6, silently no-ops per the 04.07. fix's own comment)
2. Fallback: build an OmniJS snippet and run it via
   `app.evaluateJavascript(omniJs)` calling `moveTasks([t], p)`
3. Re-read `task.containingProject()` on the **same already-held JXA task
   reference** and compare IDs to decide success/failure

None of steps 1-3 are protected against a second, concurrent `osascript`
process doing the same three steps against the same OmniFocus document at
the same time. Plausible failure modes:
- OmniFocus's OmniJS bridge (`evaluateJavascript`) appears to serialize on
  the app's main thread, so concurrent `moveTasks()` calls arriving out of
  order can end up all acting on stale document state, with only the last
  one to actually commit "winning."
- The read-back in step 3 can run before the *other* process's write has
  settled, or after a different process's write already changed the
  document — either way the comparison is against a moving target.

This is consistent with what the 04.07. fix's own comments already flag
("JXA property setter accepted but OmniFocus did not persist") — this
report extends that finding: **the OmniJS fallback the fix added has the
same class of problem under concurrency that the original JXA setter had
in isolation.**

## Reproduction (live session, 2026-07-14, this repo's `dist/index.js` v1.3.2
via Claude Code / mcp__omnifocus tools)

**Case 1 — 6 concurrent moves to the same target, 1 succeeds:**
A single tool-call batch issued `update_task` for 6 different task IDs
(`o0ih_hT3Mxm`, `oj1-tZn4py3`, `gGy13sWlc_u`, `eer6_smB6QD`, `lHy6zl9pPSc`,
`lEijlb2wB1j`), all with `projectId: "b1moX4KITK_"`. Result: 5 reported the
verification-failure error; only `lEijlb2wB1j` (last in the batch) actually
landed in the target project. Confirmed by a follow-up `list_tasks
{projectId: "b1moX4KITK_"}` — only `lEijlb2wB1j` was present.

**Case 2 — retry of the same 5, still concurrent, still fails:**
Re-issuing the identical 5 `update_task` calls as a second concurrent batch
produced the identical error for all 5, again. Not a one-off timing fluke —
deterministic under repeated concurrent load against this specific access
pattern.

**Case 3 — false negative on an isolated (low-concurrency) call:**
`update_task {taskId: "dfPAoANWjPX", projectId: "duIPD629F2W"}` and
`update_task {taskId: "lEijlb2wB1j", projectId: "b1moX4KITK_"}`, each issued
as part of a smaller batch, both reported the verification-failure error
(`containingProject id is null`). A direct follow-up `list_tasks {search:
...}` for each showed **both had actually moved to the correct project** —
the tool's own error report was wrong.

**Case 4 — 12 concurrent moves to the same target, all succeed:**
Later in the same session, 12 concurrent `update_task` calls (different
task IDs, same destination `j-rLxudJTKy`) all reported success AND were all
independently confirmed present in that project afterward. So concurrency
to the same target does not *always* fail — the failure is intermittent /
load-dependent, not deterministic per-project.

## Impact

Any MCP client that batches parallel `update_task` project-moves (which is
the natural way to call this tool — Claude Code fires independent tool
calls concurrently by default) will silently lose most of a batch when
several tasks move to the same destination project at once, while
self-reporting believable-looking errors that are sometimes accurate and
sometimes not. This makes bulk task-filing/reorganization (exactly the
inbox-processing use case this tool is built for) unreliable without a
manual re-verify pass after every batch.

## Suggested fix directions (not implemented yet)

1. **Serialize all OmniFocus-mutating calls** through a single in-process
   queue in `OmniAutomation.ts` (e.g. a promise chain / simple mutex), so
   only one `osascript` write process runs against OmniFocus at a time
   regardless of how many tool calls arrive concurrently. Reads can likely
   stay concurrent; writes should not.
2. Alternatively/additionally, batch multi-task moves into a **single**
   OmniJS `moveTasks([...tasks], project)` call per destination project
   instead of N separate osascript invocations — this is both faster and
   removes the race by construction.
3. Fix the verification race independent of (1)/(2): after the
   `evaluateJavascript` fallback, don't trust an immediate re-read on the
   same JXA task handle — re-fetch the task fresh by ID (JXA handles can be
   stale immediately after `moveTasks()`, already noted in the existing code
   comments) and/or add a short bounded retry (e.g. re-check after 200ms)
   before declaring failure.

## Evidence trail

Session transcript: Claude Code session `a8186089-4c34-4cee-b485-a575feb5e229`,
2026-07-14, OmniFocus inbox-cleanup task. Task/project IDs above are live
IDs in Arne's OmniFocus database and can be used to re-verify.
