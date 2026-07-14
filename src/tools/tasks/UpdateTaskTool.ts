import { BaseTool } from '../base.js';
import { TaskUpdate } from '../../omnifocus/types.js';
import { UPDATE_TASK_SCRIPT } from '../../omnifocus/scripts/tasks.js';

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
        description: 'Move task to different project - use full alphanumeric projectId from list_projects tool (e.g., "az5Ieo4ip7K", not just "547"). Use empty string "" to move task to inbox.',
      },
    },
    required: ['taskId'],
  };

  async execute(args: { taskId: string } & TaskUpdate): Promise<any> {
    try {
      const { taskId, ...updates } = args;

      // Invalidate cache so reads after the update see fresh state
      this.cache.invalidate('tasks');

      // Pass ALL update fields through. The full UPDATE_TASK_SCRIPT handles
      // name/note/flagged/dueDate/deferDate/estimatedMinutes/tags/projectId
      // and verifies via cross-read so silent JXA no-ops surface as errors.
      const script = this.omniAutomation.buildScript(UPDATE_TASK_SCRIPT, {
        taskId,
        updates,
      });

      const result = await this.omniAutomation.executeWrite(script);

      if (result && result.error) {
        return result;
      }

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

      // Surface verification failures from the script as errors instead of fake success
      if (parsedResult && parsedResult.error) {
        return parsedResult;
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