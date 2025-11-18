import { BaseTool } from '../base.js';
import { ProjectFilter, OmniFocusProject } from '../../omnifocus/types.js';
import { LIST_PROJECTS_SCRIPT } from '../../omnifocus/scripts/projects.js';

export class ListProjectsTool extends BaseTool {
  name = 'list_projects';
  description = 'List projects from OmniFocus with filtering options';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      status: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['active', 'onHold', 'dropped', 'completed'],
        },
        description: 'Filter by project status',
      },
      flagged: {
        type: 'boolean',
        description: 'Filter by flagged status',
      },
      folder: {
        type: 'string',
        description: 'Filter by folder name',
      },
      reviewBefore: {
        type: 'string',
        format: 'date-time',
        description: 'Filter projects needing review before this date',
      },
      search: {
        type: 'string',
        description: 'Search in project name and notes',
      },
      includeTaskCount: {
        type: 'boolean',
        description: 'Include task count for each project (default: false). Warning: Expensive operation on large databases',
        default: false,
      },
    },
  };

  async execute(args: ProjectFilter): Promise<any> {
    try {
      // Create cache key from filter
      const cacheKey = JSON.stringify(args);
      
      // Check cache
      const cached = this.cache.get<OmniFocusProject[]>('projects', cacheKey);
      if (cached) {
        this.logger.debug('Returning cached projects');
        return {
          projects: cached,
          total: cached.length,
          cached: true,
        };
      }
      
      // Execute script
      const script = this.omniAutomation.buildScript(LIST_PROJECTS_SCRIPT, { filter: args });
      const result = await this.omniAutomation.execute<any>(script);
      
      // Check if script returned an error
      if (result.error) {
        return result;
      }
      
      // Ensure projects array exists
      if (!result.projects || !Array.isArray(result.projects)) {
        return {
          error: true,
          message: 'Invalid response from OmniFocus: projects array not found',
          details: 'The script returned an unexpected format'
        };
      }
      
      // Parse dates
      const parsedProjects = result.projects.map((project: any) => ({
        ...project,
        dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
        deferDate: project.deferDate ? new Date(project.deferDate) : undefined,
        completionDate: project.completionDate ? new Date(project.completionDate) : undefined,
        lastReviewDate: project.lastReviewDate ? new Date(project.lastReviewDate) : undefined,
      }));
      
      // Cache results
      this.cache.set('projects', cacheKey, parsedProjects);
      
      return {
        projects: parsedProjects,
        total: parsedProjects.length,
        cached: false,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}