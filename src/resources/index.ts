/**
 * Export aggregator for resources module
 */

export { ResourceManager } from './ResourceManager.js';
export { ResourceHandlers, registerResourceHandlers } from './handlers.js';
export type {
  ResourceMetadata,
  TagsResource,
  ProjectsResource,
  ResourceData
} from './types.js';
export type {
  ResourceRequest,
  ResourceListRequest,
  ResourceReadRequest
} from './handlers.js';
