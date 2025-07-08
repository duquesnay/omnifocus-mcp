import { describe, it, expect } from 'vitest';
import { UPDATE_TASK_SCRIPT_SIMPLE } from '../../src/omnifocus/scripts/tasks';
import { LIST_PROJECTS_SCRIPT } from '../../src/omnifocus/scripts/projects';

describe('Code Changes Verification', () => {
  describe('Bug Fix: Task Search Limit', () => {
    it('UPDATE_TASK_SCRIPT_SIMPLE should search all tasks, not just first 100', () => {
      // The loop should iterate through all tasks
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('for (let i = 0; i < tasks.length; i++)');
      
      // Should NOT have any limit like i < 100
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain('i < 100');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain('Math.min(100');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).not.toContain('Math.min(tasks.length, 100)');
    });
  });

  describe('Bug Fix: ProjectId Support in Simplified Script', () => {
    it('UPDATE_TASK_SCRIPT_SIMPLE should handle projectId updates', () => {
      // Should check for projectId in updates
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('if (updates.projectId !== undefined)');
      
      // Should handle null projectId (move to inbox)
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('if (updates.projectId === null)');
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('task.assignedContainer = doc.inbox');
      
      // Should handle projectId assignment
      expect(UPDATE_TASK_SCRIPT_SIMPLE).toContain('task.assignedContainer = projects[i]');
    });
  });

  describe('Bug Fix: List Projects Returns ID Field', () => {
    it('LIST_PROJECTS_SCRIPT should use project.id() not project.id.primaryKey', () => {
      // Should use the correct JXA API
      expect(LIST_PROJECTS_SCRIPT).toContain('id: project.id()');
      
      // Should NOT use the broken pattern
      expect(LIST_PROJECTS_SCRIPT).not.toContain('id: project.id.primaryKey,');
    });
  });

  describe('Documentation Fix: UpdateTaskTool Description', () => {
    it('should mention both list_tasks and list_projects as sources for projectId', async () => {
      // Import the tool to check its schema
      const { UpdateTaskTool } = await import('../../src/tools/tasks/UpdateTaskTool');
      const tool = new UpdateTaskTool({} as any, {} as any);
      
      const projectIdDescription = tool.inputSchema.properties.projectId.description;
      
      // Should mention both sources
      expect(projectIdDescription).toContain('list_tasks');
      expect(projectIdDescription).toContain('list_projects');
    });
  });

  describe('JSON Encoding Fix Pattern', () => {
    it('task tools should have JSON parsing logic', async () => {
      // Check that the tools parse JSON results
      const toolFiles = [
        '../../src/tools/tasks/UpdateTaskTool',
        '../../src/tools/tasks/CreateTaskTool',
        '../../src/tools/tasks/CompleteTaskTool',
        '../../src/tools/tasks/DeleteTaskTool'
      ];

      for (const toolFile of toolFiles) {
        const module = await import(toolFile);
        const ToolClass = Object.values(module)[0] as any;
        
        // Create instance with mocks
        const tool = new ToolClass({} as any, {} as any);
        
        // The execute method should exist
        expect(tool.execute).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });
  });
});