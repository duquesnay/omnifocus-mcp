import { BaseTool } from '../base.js';
import { EXPORT_TASKS_SCRIPT } from '../../omnifocus/scripts/export.js';

export class ExportTasksTool extends BaseTool {
  name = 'export_tasks';
  description = 'Export tasks in JSON or CSV format with filtering options';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      format: {
        type: 'string',
        enum: ['json', 'csv'],
        description: 'Export format (default: json)',
        default: 'json',
      },
      filter: {
        type: 'object',
        description: 'Filter criteria',
        properties: {
          search: {
            type: 'string',
            description: 'Search in task names and notes',
          },
          project: {
            type: 'string',
            description: 'Filter by project name',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID - use full alphanumeric ID from list_projects (e.g., "az5Ieo4ip7K", not "547"). Claude Desktop may incorrectly extract numbers from IDs.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (requires all specified tags)',
          },
          available: {
            type: 'boolean',
            description: 'Only available tasks (not deferred/blocked)',
          },
          completed: {
            type: 'boolean',
            description: 'Filter by completion status',
          },
          flagged: {
            type: 'boolean',
            description: 'Only flagged tasks',
          },
        },
      },
      fields: {
        type: 'array',
        items: { 
          type: 'string',
          enum: ['id', 'name', 'note', 'project', 'tags', 'deferDate', 'dueDate', 'completed', 'flagged', 'estimated', 'created', 'modified']
        },
        description: 'Fields to include in export (default: all common fields)',
      },
    },
  };

  async execute(args: { 
    format?: 'json' | 'csv'; 
    filter?: any; 
    fields?: string[] 
  }): Promise<any> {
    try {
      const { format = 'json', filter = {}, fields } = args;
      
      // Execute export script
      const script = this.omniAutomation.buildScript(EXPORT_TASKS_SCRIPT, { 
        format,
        filter,
        fields
      });
      const result = await this.omniAutomation.execute<{
        format: string;
        data: any;
        count: number;
        error?: boolean;
        message?: string;
      }>(script);
      
      if (result.error) {
        return {
          error: true,
          message: result.message,
        };
      }
      
      return {
        format: result.format,
        count: result.count,
        data: result.data,
        metadata: {
          exportedAt: new Date().toISOString(),
          filters: filter,
          fields: fields || 'default',
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}