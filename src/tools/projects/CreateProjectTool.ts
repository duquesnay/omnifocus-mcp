import { BaseTool } from '../base.js';
import { CREATE_PROJECT_SCRIPT } from '../../omnifocus/scripts/projects.js';

export class CreateProjectTool extends BaseTool {
  name = 'create_project';
  description = 'Create a new project in OmniFocus with optional folder placement (creates folder if needed)';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Name of the new project',
      },
      note: {
        type: 'string',
        description: 'Optional note for the project',
      },
      deferDate: {
        type: 'string',
        description: 'Defer date in ISO format',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in ISO format',
      },
      flagged: {
        type: 'boolean',
        description: 'Whether the project is flagged',
      },
      folder: {
        type: 'string',
        description: 'Name of folder to place project in (creates it if it doesn\'t exist)',
      },
    },
    required: ['name'],
  };

  async execute(args: { 
    name: string;
    note?: string;
    deferDate?: string;
    dueDate?: string;
    flagged?: boolean;
    folder?: string;
  }): Promise<any> {
    try {
      const { name, ...options } = args;
      
      // Clear project cache since we're creating
      this.cache.clear('projects');
      
      // Execute create script
      const script = this.omniAutomation.buildScript(CREATE_PROJECT_SCRIPT, { 
        name,
        options
      });
      const result = await this.omniAutomation.execute<any>(script);
      
      return result;
    } catch (error) {
      return this.handleError(error);
    }
  }
}