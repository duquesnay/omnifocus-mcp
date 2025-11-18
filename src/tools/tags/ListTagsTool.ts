import { BaseTool } from '../base.js';
import { LIST_TAGS_SCRIPT } from '../../omnifocus/scripts/tags.js';

export class ListTagsTool extends BaseTool {
  name = 'list_tags';
  description = 'List all tags/contexts. Usage statistics are optional (expensive on large databases)';

  inputSchema = {
    type: 'object' as const,
    properties: {
      sortBy: {
        type: 'string',
        enum: ['name', 'usage', 'tasks'],
        description: 'How to sort the tags',
        default: 'name',
      },
      includeEmpty: {
        type: 'boolean',
        description: 'Include tags with no tasks (only when includeUsageStats is true)',
        default: true,
      },
      includeUsageStats: {
        type: 'boolean',
        description: 'Calculate usage statistics (expensive operation on large databases - may take 15+ minutes)',
        default: false,
      },
    },
  };

  async execute(args: { sortBy?: string; includeEmpty?: boolean; includeUsageStats?: boolean }): Promise<any> {
    try {
      const { sortBy = 'name', includeEmpty = true, includeUsageStats = false } = args;

      // Create cache key
      const cacheKey = `list_${sortBy}_${includeEmpty}_${includeUsageStats}`;

      // Check cache
      const cached = this.cache.get<any>('tags', cacheKey);
      if (cached) {
        this.logger.debug('Returning cached tags');
        return {
          ...cached,
          from_cache: true,
        };
      }

      // Execute script
      const script = this.omniAutomation.buildScript(LIST_TAGS_SCRIPT, {
        options: { sortBy, includeEmpty, includeUsageStats }
      });
      const result = await this.omniAutomation.execute<any>(script);

      if (result.error) {
        return result;
      }

      const finalResult = {
        tags: result.tags,
        summary: result.summary,
        from_cache: false,
      };

      // Cache results
      this.cache.set('tags', cacheKey, finalResult);

      return finalResult;
    } catch (error) {
      return this.handleError(error);
    }
  }
}