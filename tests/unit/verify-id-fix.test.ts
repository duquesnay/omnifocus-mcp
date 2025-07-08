import { describe, it, expect } from 'vitest';
import { 
  LIST_TASKS_SCRIPT, 
  CREATE_TASK_SCRIPT,
  UPDATE_TASK_SCRIPT,
  COMPLETE_TASK_SCRIPT,
  DELETE_TASK_SCRIPT
} from 'src/omnifocus/scripts/tasks';
import {
  LIST_PROJECTS_SCRIPT,
  CREATE_PROJECT_SCRIPT,
  UPDATE_PROJECT_SCRIPT,
  COMPLETE_PROJECT_SCRIPT,
  DELETE_PROJECT_SCRIPT
} from 'src/omnifocus/scripts/projects';

/**
 * Note: This test verifies the correct JXA API usage for ID extraction.
 * In OmniFocus JXA:
 * - task.id() returns the task ID (method call)
 * - project.id() returns the project ID (method call)
 * - For task scripts: project.id.primaryKey is used for projectId field
 * - For project scripts: project.id() is used for the id field
 * 
 * This test ensures we're using the correct JXA API patterns.
 */
describe('Verify ID Extraction Fix', () => {
  it('should use correct ID extraction patterns in task scripts', () => {
    // Task scripts should use task.id() for task IDs
    expect(LIST_TASKS_SCRIPT).toContain('id: task.id()');
    expect(UPDATE_TASK_SCRIPT).toContain('task.id()');
    expect(COMPLETE_TASK_SCRIPT).toContain('task.id()');
    expect(DELETE_TASK_SCRIPT).toContain('task.id()');
    
    // Task scripts should use project.id.primaryKey for project IDs
    expect(LIST_TASKS_SCRIPT).toContain('projectId: project.id.primaryKey');
    expect(UPDATE_TASK_SCRIPT).toContain('project.id.primaryKey === updates.projectId');
  });
  
  it('should use project.id() in project scripts', () => {
    // Project scripts should use project.id() for project IDs
    expect(LIST_PROJECTS_SCRIPT).toContain('id: project.id()');
    expect(CREATE_PROJECT_SCRIPT).toContain('id: newProject.id()');
    expect(UPDATE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
    expect(COMPLETE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
    expect(DELETE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
    
    // Project scripts should NOT use .id.primaryKey
    expect(LIST_PROJECTS_SCRIPT).not.toContain('.id.primaryKey');
    expect(UPDATE_PROJECT_SCRIPT).not.toContain('.id.primaryKey');
  });
  
  it('should verify ID comparison patterns', () => {
    // Task lookups use task.id()
    expect(UPDATE_TASK_SCRIPT).toContain('tasks[i].id() === taskId');
    expect(COMPLETE_TASK_SCRIPT).toContain('tasks[i].id() === taskId');
    expect(DELETE_TASK_SCRIPT).toContain('tasks[i].id() === taskId');
    
    // Project lookups use project.id()
    expect(UPDATE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
    expect(COMPLETE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
    expect(DELETE_PROJECT_SCRIPT).toContain('projects[i].id() === projectId');
  });
});