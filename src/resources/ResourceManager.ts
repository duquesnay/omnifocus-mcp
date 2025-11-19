/**
 * Resource manager with pre-loading logic
 */

import { CacheManager } from '../cache/CacheManager.js';
import { ListTagsTool } from '../tools/tags/ListTagsTool.js';
import { ListProjectsTool } from '../tools/projects/ListProjectsTool.js';
import { ResourceData, ResourceMetadata } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('resources');

const RESOURCE_TTL = 5 * 60 * 1000; // 5 minutes

export class ResourceManager {
  private listTagsTool: ListTagsTool;
  private listProjectsTool: ListProjectsTool;
  private resourceData: ResourceData = {};
  private preloadPromise?: Promise<void>;

  constructor(cache: CacheManager) {
    this.listTagsTool = new ListTagsTool(cache);
    this.listProjectsTool = new ListProjectsTool(cache);
  }

  /**
   * Get available resource metadata
   */
  public getResourceList(): ResourceMetadata[] {
    return [
      {
        uri: 'omnifocus://tags',
        name: 'OmniFocus Tags',
        description: 'All available tags/contexts from OmniFocus',
        mimeType: 'application/json',
      },
      {
        uri: 'omnifocus://projects',
        name: 'OmniFocus Projects',
        description: 'All active projects from OmniFocus',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Pre-load resources during startup (non-blocking)
   */
  public async preloadResources(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        logger.info('Starting resource pre-load');

        // Load tags (basic mode - no usage stats)
        const tagsResult = await this.listTagsTool.execute({
          sortBy: 'name',
          includeEmpty: true,
          includeUsageStats: false,
        });

        if (!tagsResult.error) {
          this.resourceData.tags = {
            tags: tagsResult.tags,
            summary: tagsResult.summary,
          };
          this.resourceData.lastRefresh = Date.now();
          logger.info(`Pre-loaded ${tagsResult.tags?.length || 0} tags`);
        } else {
          logger.error('Failed to pre-load tags', tagsResult.error);
        }

        // Load projects (basic mode - no task count)
        const projectsResult = await this.listProjectsTool.execute({
          status: ['active'],
          includeTaskCount: false,
        });

        if (!projectsResult.error) {
          this.resourceData.projects = {
            projects: projectsResult.projects,
            total: projectsResult.total,
          };
          logger.info(`Pre-loaded ${projectsResult.total || 0} projects`);
        } else {
          logger.error('Failed to pre-load projects', projectsResult.error);
        }

        logger.info('Resource pre-load complete');
      } catch (error) {
        logger.error('Error during resource pre-load', error);
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Get resource content, auto-refresh if stale
   */
  public async getResource(uri: string): Promise<string> {
    // Check if refresh needed
    const needsRefresh = !this.resourceData.lastRefresh ||
      (Date.now() - this.resourceData.lastRefresh > RESOURCE_TTL);

    if (needsRefresh) {
      logger.debug('Resource data stale, refreshing');
      await this.preloadResources();
    }

    switch (uri) {
      case 'omnifocus://tags':
        if (!this.resourceData.tags) {
          throw new Error('Tags resource not available');
        }
        return JSON.stringify(this.resourceData.tags, null, 2);

      case 'omnifocus://projects':
        if (!this.resourceData.projects) {
          throw new Error('Projects resource not available');
        }
        return JSON.stringify(this.resourceData.projects, null, 2);

      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }
  }

  /**
   * Invalidate resource cache (called after write operations)
   */
  public invalidate(): void {
    logger.debug('Invalidating resource cache');
    this.resourceData = {};
    this.preloadPromise = undefined;
  }
}
