import { BaseTool } from '../base.js';
import { ExportTasksTool } from './ExportTasksTool.js';
import { ExportProjectsTool } from './ExportProjectsTool.js';
import { ListTagsTool } from '../tags/ListTagsTool.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class BulkExportTool extends BaseTool {
  name = 'bulk_export';
  description = 'Export all OmniFocus data (tasks, projects, tags) to files in one operation. Bulk is for performance (single osascript call per category), not transactional consistency - partial exports are possible if some categories fail.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      outputDirectory: {
        type: 'string',
        description: 'Directory to save export files',
      },
      format: {
        type: 'string',
        enum: ['json', 'csv'],
        description: 'Export format (default: json)',
        default: 'json',
      },
      includeCompleted: {
        type: 'boolean',
        description: 'Include completed tasks',
        default: true,
      },
      includeProjectStats: {
        type: 'boolean',
        description: 'Include statistics in project export',
        default: true,
      },
    },
    required: ['outputDirectory'],
  };

  async execute(args: {
    outputDirectory: string;
    format?: 'json' | 'csv';
    includeCompleted?: boolean;
    includeProjectStats?: boolean;
  }): Promise<any> {
    try {
      const {
        outputDirectory,
        format = 'json',
        includeCompleted = true,
        includeProjectStats = true
      } = args;

      // Ensure directory exists
      await fs.mkdir(outputDirectory, { recursive: true });

      const results = {
        tasks: { exported: 0, file: '' },
        projects: { exported: 0, file: '' },
        tags: { exported: 0, file: '' },
        timestamp: new Date().toISOString(),
      };

      const failures: Array<{ operation: string; error: string }> = [];

      // Best-effort approach: Continue attempting all exports even if some fail.
      // Rationale: "Bulk" is for performance (avoid multiple slow osascript calls),
      // not for transactional consistency. Partial results are acceptable and useful.

      // Export tasks (best-effort: continue even if fails)
      const taskExporter = new ExportTasksTool(this.cache);
      const taskFilter = includeCompleted ? {} : { completed: false };
      const taskResult = await taskExporter.execute({ format, filter: taskFilter });

      if (taskResult.error) {
        failures.push({ operation: 'tasks', error: taskResult.message });
      } else {
        const taskFile = path.join(outputDirectory, `tasks.${format}`);
        if (format === 'csv') {
          await fs.writeFile(taskFile, taskResult.data, 'utf-8');
        } else {
          await fs.writeFile(taskFile, JSON.stringify(taskResult.data, null, 2), 'utf-8');
        }
        results.tasks.exported = taskResult.count;
        results.tasks.file = taskFile;
      }

      // Export projects (continue even if tasks failed)
      const projectExporter = new ExportProjectsTool(this.cache);
      const projectResult = await projectExporter.execute({
        format,
        includeStats: includeProjectStats
      });

      if (projectResult.error) {
        failures.push({ operation: 'projects', error: projectResult.message });
      } else {
        const projectFile = path.join(outputDirectory, `projects.${format}`);
        if (format === 'csv') {
          await fs.writeFile(projectFile, projectResult.data, 'utf-8');
        } else {
          await fs.writeFile(projectFile, JSON.stringify(projectResult.data, null, 2), 'utf-8');
        }
        results.projects.exported = projectResult.count;
        results.projects.file = projectFile;
      }

      // Export tags (continue regardless)
      const tagExporter = new ListTagsTool(this.cache);
      const tagResult = await tagExporter.execute({ includeEmpty: true });

      if (tagResult.error) {
        failures.push({ operation: 'tags', error: tagResult.message });
      } else {
        const tagFile = path.join(outputDirectory, 'tags.json');
        await fs.writeFile(tagFile, JSON.stringify(tagResult, null, 2), 'utf-8');
        results.tags.exported = tagResult.summary.totalTags;
        results.tags.file = tagFile;
      }

      // Return partial success if ANY failed
      if (failures.length > 0) {
        const failedOps = failures.map(f => `${f.operation} (${f.error})`).join(', ');
        return {
          success: false,
          message: `Partial export: Exported ${results.tasks.exported} tasks, ${results.projects.exported} projects, ${results.tags.exported} tags. Failed: ${failedOps}`,
          partialResults: results,
          failures,
        };
      }

      // All succeeded
      return {
        success: true,
        message: `Exported ${results.tasks.exported} tasks, ${results.projects.exported} projects, and ${results.tags.exported} tags`,
        results,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}