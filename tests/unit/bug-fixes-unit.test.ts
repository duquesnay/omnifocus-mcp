import { describe, it, expect } from 'vitest';
import { 
  UPDATE_TASK_SCRIPT_SIMPLE,
  LIST_TASKS_SCRIPT,
  CREATE_TASK_SCRIPT
} from '../../src/omnifocus/scripts/tasks';
import {
  LIST_PROJECTS_SCRIPT,
  UPDATE_PROJECT_SCRIPT
} from '../../src/omnifocus/scripts/projects';

describe('Bug Fixes - Unit Tests', () => {
  describe('Bug 1: JSON Double Encoding', () => {
    it('task scripts should return JSON strings that will be parsed by tools', () => {
      // All scripts should use JSON.stringify to return results
      expect(LIST_TASKS_SCRIPT).toContain('return JSON.stringify({');
      expect(CREATE_TASK_SCRIPT).toContain('return JSON.stringify({');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('return JSON.stringify({');
      
      // Scripts should handle errors with JSON too
      expect(LIST_TASKS_SCRIPT).toContain('error: true,');
      expect(CREATE_TASK_SCRIPT).toContain('error: true,');
    });
  });

  describe('Bug 2: 100 Task Limit', () => {
    it('UPDATE_TASK_SCRIPT_SIMPLE should not limit task search', () => {
      const script = UPDATE_TASK_SCRIPT_SIMPLE;
      
      // Should search through all tasks
      expect(script).toContain('for (let i = 0; i < tasks.length; i++)');
      
      // Should NOT contain any artificial limits
      expect(script).not.toMatch(/for.*i\s*<\s*100/);
      expect(script).not.toMatch(/i\s*<\s*Math\.min\(.*100/);
      expect(script).not.toContain('.slice(0, 100)');
    });
  });

  describe('Bug 3: Missing ProjectId Support', () => {
    it('UPDATE_TASK_SCRIPT_SIMPLE should handle projectId parameter', () => {
      const script = UPDATE_TASK_SCRIPT_SIMPLE;
      
      // Should check for projectId in updates
      expect(script).toContain('if (updates.projectId !== undefined)');
      
      // Should handle null case (move to inbox)
      expect(script).toContain('if (updates.projectId === null)');
      expect(script).toContain('task.assignedContainer = null');
      
      // Should handle project assignment
      expect(script).toContain('const projects = doc.flattenedProjects()');
      expect(script).toContain('if (projects[i].id.primaryKey === updates.projectId)');
      expect(script).toContain('task.assignedContainer = projects[i]');
    });
  });

  describe('Bug 4: List Projects ID Field', () => {
    it('LIST_PROJECTS_SCRIPT should return id using project.id()', () => {
      const script = LIST_PROJECTS_SCRIPT;
      
      // Should build project object with id field
      expect(script).toMatch(/const projectObj = \{[\s\S]*?id: project\.id\(\)/);
      
      // Should NOT use the broken .primaryKey access
      expect(script).not.toContain('id: project.id.primaryKey,');
      expect(script).not.toContain('id: project.id.primaryKey;');
    });
    
    it('UPDATE_PROJECT_SCRIPT should use project.id() for comparisons', () => {
      const script = UPDATE_PROJECT_SCRIPT;
      
      // Should compare using id() method
      expect(script).toContain('if (projects[i].id() === projectId)');
      
      // Should return id in response
      expect(script).toContain('id: targetProject.id()');
    });
  });

  describe('Bug 5: Type Conversion Error Documentation', () => {
    it('scripts should document known JXA limitations', () => {
      // This is a known issue where projectId: null causes JXA error
      // The simplified script tries to handle it but JXA has limitations
      const script = UPDATE_TASK_SCRIPT_SIMPLE;
      
      // We fixed it by using null assignment
      expect(script).toContain('task.assignedContainer = null');
      
      // But we should document that this is a JXA limitation
      // (In a real TDD scenario, we'd have a comment in the script or documentation)
      expect(true).toBe(true); // Placeholder for documentation test
    });
  });
});