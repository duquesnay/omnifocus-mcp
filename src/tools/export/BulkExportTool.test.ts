import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkExportTool } from './BulkExportTool.js';
import { ExportTasksTool } from './ExportTasksTool.js';
import { ExportProjectsTool } from './ExportProjectsTool.js';
import { ListTagsTool } from '../tags/ListTagsTool.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('./ExportTasksTool.js');
vi.mock('./ExportProjectsTool.js');
vi.mock('../tags/ListTagsTool.js');
vi.mock('fs/promises');

describe('BulkExportTool', () => {
  let tool: BulkExportTool;
  let mockCache: any;

  beforeEach(() => {
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      invalidate: vi.fn(),
    };
    tool = new BulkExportTool(mockCache);

    // Reset mocks
    vi.clearAllMocks();

    // Mock fs.mkdir
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  describe('full success', () => {
    it('should export all data successfully', async () => {
      // Mock successful exports
      const mockTaskResult = {
        error: false,
        count: 150,
        data: [{ id: 'task1', name: 'Test Task' }],
      };
      const mockProjectResult = {
        error: false,
        count: 10,
        data: [{ id: 'proj1', name: 'Test Project' }],
      };
      const mockTagResult = {
        error: false,
        summary: { totalTags: 25 },
        tags: [{ id: 'tag1', name: 'Test Tag' }],
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('150 tasks');
      expect(result.message).toContain('10 projects');
      expect(result.message).toContain('25 tags');
      expect(result.results.tasks.exported).toBe(150);
      expect(result.results.projects.exported).toBe(10);
      expect(result.results.tags.exported).toBe(25);
      expect(result.failures).toBeUndefined();
    });
  });

  describe('partial success - tasks fail', () => {
    it('should continue exporting projects and tags when tasks fail', async () => {
      // Mock task export failure
      const mockTaskResult = {
        error: true,
        message: 'Permission denied',
      };
      const mockProjectResult = {
        error: false,
        count: 10,
        data: [{ id: 'proj1', name: 'Test Project' }],
      };
      const mockTagResult = {
        error: false,
        summary: { totalTags: 25 },
        tags: [{ id: 'tag1', name: 'Test Tag' }],
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Partial export');
      expect(result.message).toContain('0 tasks');
      expect(result.message).toContain('10 projects');
      expect(result.message).toContain('25 tags');
      expect(result.message).toContain('Failed: tasks (Permission denied)');
      expect(result.partialResults.tasks.exported).toBe(0);
      expect(result.partialResults.projects.exported).toBe(10);
      expect(result.partialResults.tags.exported).toBe(25);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toEqual({
        operation: 'tasks',
        error: 'Permission denied',
      });

      // Verify projects and tags were still written
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('projects.json'),
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tags.json'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('partial success - projects fail', () => {
    it('should continue exporting tasks and tags when projects fail', async () => {
      const mockTaskResult = {
        error: false,
        count: 150,
        data: [{ id: 'task1', name: 'Test Task' }],
      };
      const mockProjectResult = {
        error: true,
        message: 'Database connection failed',
      };
      const mockTagResult = {
        error: false,
        summary: { totalTags: 25 },
        tags: [{ id: 'tag1', name: 'Test Tag' }],
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Partial export');
      expect(result.message).toContain('150 tasks');
      expect(result.message).toContain('0 projects');
      expect(result.message).toContain('25 tags');
      expect(result.message).toContain('Failed: projects (Database connection failed)');
      expect(result.partialResults.tasks.exported).toBe(150);
      expect(result.partialResults.projects.exported).toBe(0);
      expect(result.partialResults.tags.exported).toBe(25);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toEqual({
        operation: 'projects',
        error: 'Database connection failed',
      });
    });
  });

  describe('partial success - tags fail', () => {
    it('should export tasks and projects when tags fail', async () => {
      const mockTaskResult = {
        error: false,
        count: 150,
        data: [{ id: 'task1', name: 'Test Task' }],
      };
      const mockProjectResult = {
        error: false,
        count: 10,
        data: [{ id: 'proj1', name: 'Test Project' }],
      };
      const mockTagResult = {
        error: true,
        message: 'API timeout',
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Partial export');
      expect(result.message).toContain('150 tasks');
      expect(result.message).toContain('10 projects');
      expect(result.message).toContain('0 tags');
      expect(result.message).toContain('Failed: tags (API timeout)');
      expect(result.partialResults.tasks.exported).toBe(150);
      expect(result.partialResults.projects.exported).toBe(10);
      expect(result.partialResults.tags.exported).toBe(0);
      expect(result.failures).toHaveLength(1);
    });
  });

  describe('multiple failures', () => {
    it('should collect all failures and return partial results', async () => {
      const mockTaskResult = {
        error: true,
        message: 'Permission denied',
      };
      const mockProjectResult = {
        error: true,
        message: 'Database error',
      };
      const mockTagResult = {
        error: false,
        summary: { totalTags: 25 },
        tags: [{ id: 'tag1', name: 'Test Tag' }],
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Partial export');
      expect(result.message).toContain('0 tasks');
      expect(result.message).toContain('0 projects');
      expect(result.message).toContain('25 tags');
      expect(result.message).toContain('tasks (Permission denied)');
      expect(result.message).toContain('projects (Database error)');
      expect(result.failures).toHaveLength(2);
      expect(result.failures).toContainEqual({
        operation: 'tasks',
        error: 'Permission denied',
      });
      expect(result.failures).toContainEqual({
        operation: 'projects',
        error: 'Database error',
      });
    });

    it('should handle complete failure gracefully', async () => {
      const mockTaskResult = {
        error: true,
        message: 'Permission denied',
      };
      const mockProjectResult = {
        error: true,
        message: 'Database error',
      };
      const mockTagResult = {
        error: true,
        message: 'API timeout',
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Partial export');
      expect(result.message).toContain('0 tasks');
      expect(result.message).toContain('0 projects');
      expect(result.message).toContain('0 tags');
      expect(result.failures).toHaveLength(3);
      expect(result.partialResults.tasks.exported).toBe(0);
      expect(result.partialResults.projects.exported).toBe(0);
      expect(result.partialResults.tags.exported).toBe(0);
    });
  });

  describe('CSV format', () => {
    it('should handle CSV format in partial success scenario', async () => {
      const mockTaskResult = {
        error: false,
        count: 150,
        data: 'id,name\ntask1,Test Task',
      };
      const mockProjectResult = {
        error: true,
        message: 'Export failed',
      };
      const mockTagResult = {
        error: false,
        summary: { totalTags: 25 },
        tags: [{ id: 'tag1', name: 'Test Tag' }],
      };

      vi.mocked(ExportTasksTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTaskResult),
      } as any));

      vi.mocked(ExportProjectsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockProjectResult),
      } as any));

      vi.mocked(ListTagsTool).mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(mockTagResult),
      } as any));

      const result = await tool.execute({
        outputDirectory: '/tmp/export',
        format: 'csv',
      });

      expect(result.success).toBe(false);
      expect(result.partialResults.tasks.exported).toBe(150);
      expect(result.partialResults.tasks.file).toContain('tasks.csv');
      expect(result.failures).toHaveLength(1);

      // Verify CSV was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tasks.csv'),
        'id,name\ntask1,Test Task',
        'utf-8'
      );
    });
  });
});
