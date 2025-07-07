import { BaseTool } from '../base.js';
import { COMPLETE_TASK_SCRIPT, COMPLETE_TASK_OMNI_SCRIPT } from '../../omnifocus/scripts/tasks.js';

export class CompleteTaskTool extends BaseTool {
  name = 'complete_task';
  description = 'Mark a task as completed in OmniFocus';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to complete',
      },
    },
    required: ['taskId'],
  };

  async execute(args: { taskId: string }): Promise<any> {
    try {
      // Invalidate task and analytics cache
      this.cache.invalidate('tasks');
      this.cache.invalidate('analytics');
      
      // Try JXA first, fall back to URL scheme if access denied
      try {
        const script = this.omniAutomation.buildScript(COMPLETE_TASK_SCRIPT, args);
        const result = await this.omniAutomation.execute(script);
        
        if (result.error) {
          // If error contains "access not allowed", use URL scheme
          if (result.message && result.message.toLowerCase().includes('access not allowed')) {
            this.logger.info('JXA access denied, falling back to URL scheme for task completion');
            return await this.executeViaUrlScheme(args);
          }
          return result;
        }
        
        this.logger.info(`Completed task via JXA: ${args.taskId}`);
        
        // Parse the JSON result since the script returns a JSON string
        let parsedResult;
        try {
          parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
        } catch (parseError) {
          this.logger.error(`Failed to parse complete task result: ${result}`);
          return {
            error: true,
            message: 'Failed to parse task completion response'
          };
        }
        
        return {
          success: true,
          task: parsedResult,
        };
      } catch (jxaError: any) {
        // If JXA fails with permission error, use URL scheme
        if (jxaError.message && jxaError.message.toLowerCase().includes('access not allowed')) {
          this.logger.info('JXA access denied, falling back to URL scheme for task completion');
          return await this.executeViaUrlScheme(args);
        }
        throw jxaError;
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async executeViaUrlScheme(args: { taskId: string }): Promise<any> {
    const omniScript = this.omniAutomation.buildScript(COMPLETE_TASK_OMNI_SCRIPT, args);
    await this.omniAutomation.executeViaUrlScheme(omniScript);
    
    this.logger.info(`Completed task via URL scheme: ${args.taskId}`);
    
    // Return expected format since URL scheme doesn't return detailed results
    return {
      success: true,
      id: args.taskId,
      completed: true,
      completionDate: new Date().toISOString()
    };
  }
}