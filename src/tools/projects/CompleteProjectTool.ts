import { BaseTool } from '../base.js';
import { COMPLETE_PROJECT_SCRIPT } from '../../omnifocus/scripts/projects.js';

export class CompleteProjectTool extends BaseTool {
  name = 'complete_project';
  description = 'Mark a project as completed in OmniFocus';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      projectId: {
        type: 'string',
        description: 'ID of the project to complete',
      },
      completeAllTasks: {
        type: 'boolean',
        description: 'Complete all incomplete tasks in the project',
        default: false,
      },
    },
    required: ['projectId'],
  };

  async execute(args: { 
    projectId: string;
    completeAllTasks?: boolean;
  }): Promise<any> {
    try {
      const { projectId, completeAllTasks = false } = args;
      
      // Clear project cache since we're completing
      this.cache.clear('projects');
      
      // Execute complete script
      const script = this.omniAutomation.buildScript(COMPLETE_PROJECT_SCRIPT, { 
        projectId,
        completeAllTasks
      });
      const result = await this.omniAutomation.execute<any>(script);
      
      return result;
    } catch (error) {
      return this.handleError(error);
    }
  }
}