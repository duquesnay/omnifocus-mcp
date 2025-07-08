import { describe, it, expect } from 'vitest';
import { UPDATE_TASK_SCRIPT_SIMPLE, UPDATE_TASK_SCRIPT } from '../../src/omnifocus/scripts/tasks';

describe('Bug 2: Inbox Assignment Fix', () => {
  describe('UPDATE_TASK_SCRIPT_SIMPLE', () => {
    it('should set assignedContainer to null when projectId is null', () => {
      // Setting assignedContainer to null moves task to inbox in JXA
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('if (updates.projectId === null)');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('task.assignedContainer = null;');
      
      // Should NOT use the broken doc.inbox assignment
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain('task.assignedContainer = doc.inbox');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain('doc.inboxTasks');
    });
  });

  describe('UPDATE_TASK_SCRIPT', () => {
    it('should set assignedContainer to null when projectId is null', () => {
      // Full script should also use null assignment
      expect(UPDATE_TASK_SCRIPT).toContain('if (updates.projectId === null)');
      expect(UPDATE_TASK_SCRIPT).toContain('task.assignedContainer = null;');
      
      // Should NOT use the broken doc.inbox assignment
      expect(UPDATE_TASK_SCRIPT).not.toContain('task.assignedContainer = doc.inbox');
    });
  });

  describe('Documentation', () => {
    it('should document the JXA pattern for moving tasks to inbox', () => {
      // In OmniFocus JXA:
      // - task.assignedContainer = null moves task to inbox
      // - task.assignedContainer = project assigns to project
      // - doc.inbox cannot be directly assigned due to type conversion issues
      
      // This test documents the correct pattern
      const correctPattern = 'task.assignedContainer = null;';
      const brokenPattern = 'task.assignedContainer = doc.inbox;';
      
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain(correctPattern);
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain(brokenPattern);
    });
  });
});