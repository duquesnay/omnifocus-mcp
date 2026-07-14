import { describe, it, expect } from 'vitest';
import { CREATE_TASK_SCRIPT, UPDATE_TASK_SCRIPT } from '../../src/omnifocus/scripts/tasks';

describe('projectId OmniJS moveTasks() Fallback', () => {
  describe('CREATE_TASK_SCRIPT', () => {
    it('should fall back to OmniJS moveTasks via evaluateJavascript', () => {
      expect(CREATE_TASK_SCRIPT).toContain('app.evaluateJavascript(omniJs)');
      expect(CREATE_TASK_SCRIPT).toContain('moveTasks([t], p);');
      expect(CREATE_TASK_SCRIPT).toContain('Project.byIdentifier(');
      expect(CREATE_TASK_SCRIPT).toContain('flattenedProjects.find(function(pr) { return pr.id.primaryKey === ');
    });

    it('should interpolate IDs injection-safe via JSON.stringify', () => {
      expect(CREATE_TASK_SCRIPT).toContain('Task.byIdentifier(" + JSON.stringify(taskId) + ")');
      expect(CREATE_TASK_SCRIPT).toContain('Project.byIdentifier(" + JSON.stringify(taskData.projectId) + ")');
    });

    it('should re-verify via the already-held task reference, not fresh byId', () => {
      // byId can be stale directly after moveTasks() (CLAUDE.md JXA gotchas)
      expect(CREATE_TASK_SCRIPT).toContain('ALREADY HELD task reference');
      expect(CREATE_TASK_SCRIPT).toContain('projAfter = task.containingProject();');
    });

    it('should keep the fail-fast error as the last layer', () => {
      expect(CREATE_TASK_SCRIPT).toContain('Task created but project assignment did not persist');
      expect(CREATE_TASK_SCRIPT).toContain('OmniJS moveTasks() fallback did not verify either');
    });

    it('should bound-retry with a fresh re-fetch by ID after the held-handle re-verify', () => {
      // Concurrent writers can leave the moveTasks() fallback mid-commit when
      // the held-handle re-read runs. A bounded retry with a short sleep and
      // a FRESH re-fetch (Task.byIdentifier) reflects committed document
      // state instead of a possibly-stale JXA object graph.
      expect(CREATE_TASK_SCRIPT).toContain('Bounded retry for concurrent writers');
      expect(CREATE_TASK_SCRIPT).toContain('sleepForTimeInterval(0.2)');
      expect(CREATE_TASK_SCRIPT).toContain('freshProjectId');
      expect(CREATE_TASK_SCRIPT).toContain('cp.id.primaryKey');
    });

    it('should accept success from either the held handle or the fresh re-fetch', () => {
      expect(CREATE_TASK_SCRIPT).toContain(
        'if (!(projAfter && projAfterId === taskData.projectId) && freshProjectId !== taskData.projectId) {'
      );
    });
  });

  describe('UPDATE_TASK_SCRIPT', () => {
    it('should fall back to OmniJS moveTasks via evaluateJavascript', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('app.evaluateJavascript(omniJs)');
      expect(UPDATE_TASK_SCRIPT).toContain('moveTasks([t], p);');
      expect(UPDATE_TASK_SCRIPT).toContain('Project.byIdentifier(');
      expect(UPDATE_TASK_SCRIPT).toContain('flattenedProjects.find(function(pr) { return pr.id.primaryKey === ');
    });

    it('should interpolate IDs injection-safe via JSON.stringify', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('Task.byIdentifier(" + JSON.stringify(taskId) + ")');
      expect(UPDATE_TASK_SCRIPT).toContain('Project.byIdentifier(" + JSON.stringify(updates.projectId) + ")');
    });

    it('should re-verify via the already-held task reference, not fresh byId', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('ALREADY HELD task reference');
      expect(UPDATE_TASK_SCRIPT).toContain('projAfter = task.containingProject();');
    });

    it('should keep the fail-fast verification error as the last layer', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('Update verification failed for: ');
      expect(UPDATE_TASK_SCRIPT).toContain('OmniJS moveTasks fallback did not verify either');
    });

    it('should bound-retry with a fresh re-fetch by ID after the held-handle re-verify', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('Bounded retry for concurrent writers');
      expect(UPDATE_TASK_SCRIPT).toContain('sleepForTimeInterval(0.2)');
      expect(UPDATE_TASK_SCRIPT).toContain('freshProjectId');
      expect(UPDATE_TASK_SCRIPT).toContain('cp.id.primaryKey');
    });

    it('should accept success from either the held handle or the fresh re-fetch', () => {
      expect(UPDATE_TASK_SCRIPT).toContain('if (projAfter && projAfterId === updates.projectId) {');
      expect(UPDATE_TASK_SCRIPT).toContain('} else if (freshProjectId === updates.projectId) {');
    });
  });
});
