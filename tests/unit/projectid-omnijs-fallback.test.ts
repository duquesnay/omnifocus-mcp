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
  });
});
