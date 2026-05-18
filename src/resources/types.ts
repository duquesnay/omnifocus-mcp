/**
 * Resource type definitions for MCP resources feature
 */

export interface ResourceMetadata {
  uri: string;
  name: string;
  description?: string;
  mimeType: string;
}

export interface TagsResource {
  tags: Array<{
    id: string;
    name: string;
    available: boolean;
    allowsNextAction: boolean;
  }>;
  summary: {
    total: number;
    available: number;
    hidden: number;
  };
}

export interface ProjectsResource {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    folder?: string;
    flagged: boolean;
    note?: string;
    dueDate?: Date;
    deferDate?: Date;
    completionDate?: Date;
    lastReviewDate?: Date;
  }>;
  total: number;
}

export interface ResourceData {
  tags?: TagsResource;
  projects?: ProjectsResource;
  lastRefresh?: number;
}
