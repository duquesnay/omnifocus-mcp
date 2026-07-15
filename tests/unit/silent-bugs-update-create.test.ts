// Regression tests for the silent-no-op bugs on update_task / create_task
// for dueDate, deferDate and projectId.
//
// What was broken (confirmed 2026-05-12 via repeated MCP runs against live OmniFocus):
//   - update_task replied { success: true, changes: {} } when given dueDate/deferDate
//     because UpdateTaskTool.ts pre-filtered those fields out before passing to
//     UPDATE_TASK_SCRIPT_SIMPLE (which also ignores them).
//   - update_task replied { success: true, changes: { projectId } } even when the
//     JXA `task.assignedContainer = project` setter silently failed, because
//     the script trusted the assignment without cross-reading.
//   - create_task replied success when projectId silently did not persist.
//
// Fix:
//   1. UpdateTaskTool now uses the full UPDATE_TASK_SCRIPT and forwards ALL fields.
//   2. UPDATE_TASK_SCRIPT verifies every property write via cross-read and
//      surfaces structured errors with `partialChanges` instead of fake success.
//   3. CREATE_TASK_SCRIPT verifies project assignment via cross-read.

import { describe, it, expect } from 'vitest';
import {
  UPDATE_TASK_SCRIPT,
  CREATE_TASK_SCRIPT,
  COMPLETE_TASK_OMNI_SCRIPT,
} from '../../src/omnifocus/scripts/tasks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Silent-no-op regression: update_task / create_task', () => {
  describe('UpdateTaskTool wiring', () => {
    it('UpdateTaskTool must use the full UPDATE_TASK_SCRIPT, not the SIMPLE variant', () => {
      const tool = readFileSync(
        join(__dirname, '../../src/tools/tasks/UpdateTaskTool.ts'),
        'utf8'
      );
      expect(tool).toContain("import { UPDATE_TASK_SCRIPT }");
      expect(tool).not.toMatch(/import\s*\{\s*UPDATE_TASK_SCRIPT_SIMPLE\s*\}/);
    });

    it('UpdateTaskTool must NOT pre-filter fields out of the updates payload', () => {
      const tool = readFileSync(
        join(__dirname, '../../src/tools/tasks/UpdateTaskTool.ts'),
        'utf8'
      );
      // The bug was: a `safeUpdates = { ...(updates.name && {name}), ... }`
      // shape that dropped dueDate/deferDate/estimatedMinutes/tags. The fix
      // forwards `updates` as-is.
      expect(tool).not.toContain('safeUpdates');
      expect(tool).toMatch(/updates\s*,?\s*\}\s*\)/); // forwarded directly
    });
  });

  describe('UPDATE_TASK_SCRIPT verify-after-set', () => {
    it('reads dueDate back after writing and reports verifyFailures on mismatch', () => {
      // dueDate write must be followed by a read and an equality check
      expect(UPDATE_TASK_SCRIPT).toMatch(/task\.dueDate\s*=\s*desired/);
      expect(UPDATE_TASK_SCRIPT).toMatch(/task\.dueDate\(\)/);
      expect(UPDATE_TASK_SCRIPT).toContain("verifyFailures.push('dueDate");
    });

    it('reads deferDate back after writing and reports verifyFailures on mismatch', () => {
      expect(UPDATE_TASK_SCRIPT).toMatch(/task\.deferDate\s*=\s*desired/);
      expect(UPDATE_TASK_SCRIPT).toMatch(/task\.deferDate\(\)/);
      expect(UPDATE_TASK_SCRIPT).toContain("verifyFailures.push('deferDate");
    });

    it('reads containingProject() back after assignment and reports verifyFailures on mismatch', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('task.assignedContainer = project');
      expect(UPDATE_TASK_SCRIPT).toContain('task.containingProject()');
      expect(UPDATE_TASK_SCRIPT).toContain("verifyFailures.push('projectId");
    });

    it('returns structured error when ANY field failed verification (no fake success)', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('verifyFailures.length > 0');
      expect(UPDATE_TASK_SCRIPT).toContain('Update verification failed for:');
      expect(UPDATE_TASK_SCRIPT).toContain('partialChanges');
      // The success path must only run if no failures
      const successIdx = UPDATE_TASK_SCRIPT.indexOf('updated: true');
      const failGuardIdx = UPDATE_TASK_SCRIPT.indexOf('verifyFailures.length > 0');
      expect(failGuardIdx).toBeLessThan(successIdx);
    });

    it('uses safeId() helper that falls back from id() to id.primaryKey', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('function safeId');
      expect(UPDATE_TASK_SCRIPT).toContain('obj.id()');
      expect(UPDATE_TASK_SCRIPT).toContain('obj.id.primaryKey');
    });

    it('passes ALL listed update fields through (none are silently filtered)', () => {
      // Each of these fields must be addressed by an `if (updates.X !== undefined)` block
      const fields = ['name', 'note', 'flagged', 'dueDate', 'deferDate', 'estimatedMinutes', 'projectId', 'tags'];
      for (const f of fields) {
        const re = new RegExp(`if\\s*\\(\\s*updates\\.${f}\\s*!==\\s*undefined\\s*\\)`);
        expect(UPDATE_TASK_SCRIPT).toMatch(re);
      }
    });
  });

  describe('CREATE_TASK_SCRIPT verify-after-set for projectId', () => {
    it('reads containingProject() back after assignment', () => {
      expect(CREATE_TASK_SCRIPT).toContain('task.assignedContainer = projects[j]');
      expect(CREATE_TASK_SCRIPT).toContain('task.containingProject()');
    });

    it('returns error when project assignment did not persist', () => {
      expect(CREATE_TASK_SCRIPT).toContain('Task created but project assignment did not persist');
    });

    it('falls back from id() to id.primaryKey on JXA project lookup', () => {
      expect(CREATE_TASK_SCRIPT).toContain('projects[j].id()');
      expect(CREATE_TASK_SCRIPT).toContain('projects[j].id.primaryKey');
    });
  });

  describe('COMPLETE_TASK_OMNI_SCRIPT (URL-scheme path) — Stash-Verbesserungen übernommen', () => {
    it('is wrapped as IIFE so omnijs-run accepts the `return`', () => {
      expect(COMPLETE_TASK_OMNI_SCRIPT).toMatch(/^\s*\(\(\)\s*=>\s*\{/);
      expect(COMPLETE_TASK_OMNI_SCRIPT).toMatch(/\}\)\(\);\s*$/);
    });

    it('uses Omni Automation `task.id.primaryKey` (not JXA `task.id()`)', () => {
      expect(COMPLETE_TASK_OMNI_SCRIPT).toContain('task.id.primaryKey === taskId');
      expect(COMPLETE_TASK_OMNI_SCRIPT).not.toMatch(/task\.id\(\)\s*===\s*taskId/);
    });
  });
});
