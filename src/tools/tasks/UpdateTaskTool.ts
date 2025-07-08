import { BaseTool } from '../base.js';
import { TaskUpdate } from '../../omnifocus/types.js';
import { UPDATE_TASK_SCRIPT_SIMPLE } from '../../omnifocus/scripts/tasks.js';

export class UpdateTaskTool extends BaseTool {
  name = 'update_task';
  description = 'Update an existing task in OmniFocus (can move between projects using projectId)';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to update',
      },
      name: {
        type: 'string',
        description: 'New task name',
      },
      note: {
        type: 'string',
        description: 'New task note',
      },
      flagged: {
        type: 'boolean',
        description: 'New flagged status',
      },
      dueDate: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'New due date (null to clear)',
      },
      deferDate: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'New defer date (null to clear)',
      },
      estimatedMinutes: {
        type: ['number', 'null'],
        description: 'New estimated time (null to clear)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tags (replaces all existing tags)',
      },
      projectId: {
        type: ['string', 'null'],
        description: 'Move task to different project - use projectId from list_tasks tool or get from list_projects (null to move to inbox - may have JXA limitations)',
      },
    },
    required: ['taskId'],
  };

  async execute(args: { taskId: string } & TaskUpdate): Promise<any> {
    try {
      const { taskId, ...updates } = args;
      
      // Temporarily disable cache invalidation to test freeze issue
      // this.cache.invalidate('tasks');
      
      // Filter updates to only include what the simplified script can handle
      const safeUpdates = {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.note !== undefined && { note: updates.note }),
        ...(updates.flagged !== undefined && { flagged: updates.flagged }),
        ...(updates.projectId !== undefined && { projectId: updates.projectId })
      };
      
      const script = this.omniAutomation.buildScript(UPDATE_TASK_SCRIPT_SIMPLE, { 
        taskId,
        updates: safeUpdates,
      });
      
      const result = await this.omniAutomation.execute(script);
      
      if (result.error) {
        return result;
      }
      
      // Temporarily disable logging to test freeze issue
      // this.logger.info(`Updated task: ${taskId}`);
      
      // Parse the JSON result since the script returns a JSON string
      let parsedResult;
      try {
        parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
      } catch (parseError) {
        this.logger.error(`Failed to parse update task result: ${result}`);
        return {
          error: true,
          message: 'Failed to parse task update response'
        };
      }
      
      return {
        success: true,
        task: parsedResult,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}