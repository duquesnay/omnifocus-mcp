import { BaseTool } from '../base.js';
import { DELETE_TASK_SCRIPT, DELETE_TASK_OMNI_SCRIPT } from '../../omnifocus/scripts/tasks.js';

export class DeleteTaskTool extends BaseTool {
  name = 'delete_task';
  description = 'Delete (drop) a task in OmniFocus';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to delete',
      },
    },
    required: ['taskId'],
  };

  async execute(args: { taskId: string }): Promise<any> {
    try {
      // Invalidate task cache
      this.cache.invalidate('tasks');
      
      // Try JXA first, fall back to URL scheme if access denied
      try {
        const script = this.omniAutomation.buildScript(DELETE_TASK_SCRIPT, args);
        const result = await this.omniAutomation.execute(script);
        
        if (result.error) {
          // If error contains "parameter is missing" or "access not allowed", use URL scheme
          if (result.message && 
              (result.message.toLowerCase().includes('parameter is missing') ||
               result.message.toLowerCase().includes('access not allowed'))) {
            this.logger.info('JXA failed, falling back to URL scheme for task deletion');
            return await this.executeViaUrlScheme(args);
          }
          return result;
        }
        
        // Parse the JSON result since the script returns a JSON string
        let parsedResult;
        try {
          parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
        } catch (parseError) {
          this.logger.error(`Failed to parse delete task result: ${result}`);
          return {
            error: true,
            message: 'Failed to parse task deletion response'
          };
        }
        
        this.logger.info(`Deleted task via JXA: ${parsedResult.name} (${args.taskId})`);
        return {
          success: true,
          task: parsedResult,
        };
      } catch (jxaError: any) {
        // If JXA fails with permission error, use URL scheme
        if (jxaError.message && 
            (jxaError.message.toLowerCase().includes('parameter is missing') ||
             jxaError.message.toLowerCase().includes('access not allowed'))) {
          this.logger.info('JXA failed, falling back to URL scheme for task deletion');
          return await this.executeViaUrlScheme(args);
        }
        throw jxaError;
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async executeViaUrlScheme(args: { taskId: string }): Promise<any> {
    const omniScript = this.omniAutomation.buildScript(DELETE_TASK_OMNI_SCRIPT, args);
    await this.omniAutomation.executeViaUrlScheme(omniScript);
    
    this.logger.info(`Deleted task via URL scheme: ${args.taskId}`);
    
    // Return expected format since URL scheme doesn't return detailed results
    return {
      success: true,
      id: args.taskId,
      deleted: true,
      name: 'Task deleted successfully'
    };
  }
}