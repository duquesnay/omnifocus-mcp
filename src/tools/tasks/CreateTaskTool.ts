import { BaseTool } from '../base.js';
import { CREATE_TASK_SCRIPT } from '../../omnifocus/scripts/tasks.js';

export class CreateTaskTool extends BaseTool {
  name = 'create_task';
  description = 'Create a new task in OmniFocus (can be assigned to a project using projectId from list_projects)';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Task name',
      },
      note: {
        type: 'string',
        description: 'Task note/description',
      },
      projectId: {
        type: 'string',
        description: 'Project ID to add task to - get this from list_projects tool (if not provided, task goes to inbox)',
      },
      flagged: {
        type: 'boolean',
        description: 'Whether task is flagged',
        default: false,
      },
      dueDate: {
        type: 'string',
        format: 'date-time',
        description: 'Due date for the task',
      },
      deferDate: {
        type: 'string',
        format: 'date-time',
        description: 'Defer date for the task',
      },
      estimatedMinutes: {
        type: 'number',
        description: 'Estimated time in minutes',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to apply to the task',
      },
    },
    required: ['name'],
  };

  async execute(args: any): Promise<any> {
    try {
      // Invalidate task cache on create
      this.cache.invalidate('tasks');
      
      const script = this.omniAutomation.buildScript(CREATE_TASK_SCRIPT, { taskData: args });
      const result = await this.omniAutomation.execute(script);
      
      if (result.error) {
        return result;
      }
      
      // Parse the JSON result since the script returns a JSON string
      try {
        return typeof result === 'string' ? JSON.parse(result) : result;
      } catch (parseError) {
        this.logger.error(`Failed to parse create task result: ${result}`);
        return {
          error: true,
          message: 'Failed to parse task creation response'
        };
      }
    } catch (error) {
      return this.handleError(error);
    }
  }
}