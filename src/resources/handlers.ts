/**
 * MCP resource request handlers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceManager } from './ResourceManager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('resource-handlers');

export interface ResourceListRequest {
  method: 'resources/list';
}

export interface ResourceReadRequest {
  method: 'resources/read';
  params: {
    uri: string;
  };
}

export type ResourceRequest = ResourceListRequest | ResourceReadRequest;

export class ResourceHandlers {
  constructor(private resourceManager: ResourceManager) {}

  /**
   * Handle resources/list request
   */
  async handleResourceList(): Promise<any> {
    try {
      const resources = this.resourceManager.getResourceList();
      logger.debug(`Returning ${resources.length} resources`);
      return {
        resources: resources.map(r => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      };
    } catch (error) {
      logger.error('Error handling resources/list', error);
      throw error;
    }
  }

  /**
   * Handle resources/read request
   */
  async handleResourceRead(uri: string): Promise<any> {
    try {
      logger.debug(`Reading resource: ${uri}`);
      const content = await this.resourceManager.getResource(uri);

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: content,
        }],
      };
    } catch (error) {
      logger.error(`Error reading resource ${uri}`, error);
      throw error;
    }
  }
}

/**
 * Register resource handlers with the MCP server
 */
export function registerResourceHandlers(
  server: Server,
  resourceManager: ResourceManager
): void {
  const handlers = new ResourceHandlers(resourceManager);

  // Register resources/list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Handling resources/list request');
    return await handlers.handleResourceList();
  });

  // Register resources/read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.debug(`Handling resources/read request for ${uri}`);
    return await handlers.handleResourceRead(uri);
  });

  logger.info('Resource handlers registered');
}
