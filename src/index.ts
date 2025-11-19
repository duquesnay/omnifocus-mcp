#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { CacheManager } from './cache/CacheManager.js';
import { PermissionChecker } from './utils/permissions.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('server');

// Create server instance
const server = new Server(
  {
    name: 'omnifocus-mcp-cached',
    version: '1.0.0',
    description: 'OmniFocus task and project management. All tools interact with your local OmniFocus database. Project IDs are alphanumeric (e.g., "az5Ieo4ip7K"), not numeric indices.',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Start server
async function runServer() {
  // Initialize cache manager
  const cacheManager = new CacheManager();
  
  // Perform initial permission check (non-blocking)
  const permissionChecker = PermissionChecker.getInstance();
  permissionChecker.checkPermissions()
    .then(result => {
      if (!result.hasPermission) {
        logger.warn('OmniFocus permissions not granted. Tools will provide instructions when used.');
        if (result.instructions) {
          logger.info('Permission instructions:', result.instructions);
        }
      } else {
        logger.info('OmniFocus permissions verified');
      }
    })
    .catch(error => {
      logger.error('Failed to check permissions:', error);
    });
  
  // Register all tools AFTER server creation but BEFORE connection
  await registerTools(server, cacheManager);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});