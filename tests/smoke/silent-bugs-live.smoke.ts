#!/usr/bin/env bun
/**
 * LIVE smoke test against OmniFocus.app — DO NOT RUN IN CI.
 *
 * Run manually:  bun tests/smoke/silent-bugs-live.smoke.ts
 *
 * Creates a throwaway inbox task, then exercises:
 *   - update_task with dueDate         (was: silent no-op)
 *   - update_task with deferDate       (was: silent no-op)
 *   - update_task with projectId       (was: sometimes silent no-op)
 *   - cross-reads each value back via list_tasks to prove persistence
 *   - cleans up the throwaway task at the end
 *
 * Prerequisites: OmniFocus.app running, automation permission granted.
 */

import { OmniAutomation } from '../../src/omnifocus/OmniAutomation';
import {
  CREATE_TASK_SCRIPT,
  UPDATE_TASK_SCRIPT,
  DELETE_TASK_SCRIPT,
} from '../../src/omnifocus/scripts/tasks';

// list_tasks with `search` containing brackets/umlauts triggers a known
// JXA bug (see ~/.claude/.../feedback_omnifocus-list-tasks-jxa-search-bug.md).
// We bypass it here with a direct ID-lookup using `whose`, which is far
// faster than iterating flattenedTasks() on a 1500+ task database.
const READ_TASK_BY_ID_SCRIPT = `
  const taskId = {{taskId}};
  try {
    const matches = doc.flattenedTasks.whose({id: taskId})();
    if (!matches || matches.length === 0) {
      return JSON.stringify({ error: true, message: 'not found' });
    }
    const t = matches[0];
    let dueDate = null, deferDate = null, projectId = null, projectName = null;
    try { const d = t.dueDate(); if (d) dueDate = d.toISOString(); } catch (e) {}
    try { const d = t.deferDate(); if (d) deferDate = d.toISOString(); } catch (e) {}
    try { const p = t.containingProject(); if (p) { projectId = p.id(); projectName = p.name(); } } catch (e) {}
    return JSON.stringify({ id: t.id(), name: t.name(), dueDate, deferDate, projectId, projectName });
  } catch (error) {
    return JSON.stringify({ error: true, message: error.toString() });
  }
`;

const oa = new OmniAutomation();
const TAG = '[smoke-silent-bugs-' + Date.now() + ']';
const THROWAWAY_NAME = TAG + ' throwaway';

function log(label: string, value: unknown) {
  console.log('  ' + label + ':', JSON.stringify(value, null, 2));
}

async function exec<T = any>(template: string, params: Record<string, any>): Promise<T> {
  const script = oa.buildScript(template, params);
  const raw = await oa.execute<string>(script);
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('\n  FAILED: ' + msg);
    process.exitCode = 1;
  } else {
    console.log('  OK: ' + msg);
  }
}

async function readTaskById(taskId: string): Promise<any | null> {
  const result: any = await exec(READ_TASK_BY_ID_SCRIPT, { taskId });
  if (result.error) return null;
  return result;
}

async function main() {
  console.log('SMOKE TEST: silent-bugs-live (' + new Date().toISOString() + ')');

  // 1. Create throwaway task in inbox
  console.log('\n1. CREATE throwaway task');
  const createRes: any = await exec(CREATE_TASK_SCRIPT, { taskData: { name: THROWAWAY_NAME } });
  log('create result', createRes);
  assert(!createRes.error, 'create_task did not error');
  const taskId = createRes.taskId || createRes.task?.id;
  assert(typeof taskId === 'string' && taskId.length > 0, 'received a task id');

  // 2. Update dueDate
  console.log('\n2. UPDATE dueDate (was silent no-op)');
  const dueDateIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const updateRes1: any = await exec(UPDATE_TASK_SCRIPT, {
    taskId,
    updates: { dueDate: dueDateIso },
  });
  log('update result', updateRes1);
  assert(!updateRes1.error, 'update_task with dueDate did not error');
  assert(updateRes1.changes && updateRes1.changes.dueDate, 'changes.dueDate populated');

  // Cross-read via direct ID lookup
  const after1 = await readTaskById(taskId);
  log('cross-read', { dueDate: after1?.dueDate });
  assert(
    after1?.dueDate != null,
    'cross-read: dueDate persisted in OmniFocus (was the original bug)'
  );

  // 3. Update deferDate
  console.log('\n3. UPDATE deferDate (was silent no-op)');
  const deferDateIso = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const updateRes2: any = await exec(UPDATE_TASK_SCRIPT, {
    taskId,
    updates: { deferDate: deferDateIso },
  });
  log('update result', updateRes2);
  assert(!updateRes2.error, 'update_task with deferDate did not error');
  const after2 = await readTaskById(taskId);
  log('cross-read', { deferDate: after2?.deferDate });
  assert(after2?.deferDate != null, 'cross-read: deferDate persisted in OmniFocus');

  // 4. Cleanup
  console.log('\n4. CLEANUP delete throwaway task');
  const delRes: any = await exec(DELETE_TASK_SCRIPT, { taskId });
  log('delete result', delRes);

  console.log('\nDONE. ' + (process.exitCode === 1 ? 'WITH FAILURES' : 'all assertions passed'));
}

main().catch((err) => {
  console.error('SMOKE TEST CRASH:', err);
  process.exit(2);
});
