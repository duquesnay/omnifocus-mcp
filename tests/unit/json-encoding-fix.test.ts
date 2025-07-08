import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTaskTool } from '../../src/tools/tasks/UpdateTaskTool';
import { CreateTaskTool } from '../../src/tools/tasks/CreateTaskTool';
import { CompleteTaskTool } from '../../src/tools/tasks/CompleteTaskTool';
import { DeleteTaskTool } from '../../src/tools/tasks/DeleteTaskTool';

describe('JSON Encoding Fix', () => {
  // Mock dependencies
  const mockCacheManager = {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn()
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  const mockOmniAutomation = {
    buildScript: vi.fn(),
    execute: vi.fn(),
    executeUrl: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheManager.get.mockReturnValue(null); // No cache hit
    mockOmniAutomation.buildScript.mockReturnValue('mock script');
  });

  describe('UpdateTaskTool', () => {
    it('should parse JSON string results before returning', async () => {
      const tool = new UpdateTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore - accessing private property for test
      tool.logger = mockLogger;
      
      // Mock execute to return a JSON string (simulating JXA script output)
      mockOmniAutomation.execute.mockResolvedValue(
        JSON.stringify({ id: 'task123', name: 'Updated Task', updated: true })
      );

      const result = await tool.execute({
        taskId: 'task123',
        name: 'Updated Task'
      });

      // Result should be parsed, not a string
      expect(result.success).toBe(true);
      expect(result.task).toEqual({
        id: 'task123',
        name: 'Updated Task',
        updated: true
      });
      expect(typeof result.task).toBe('object');
      expect(typeof result.task).not.toBe('string');
    });

    it('should handle already-parsed results gracefully', async () => {
      const tool = new UpdateTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore
      tool.logger = mockLogger;
      
      // Mock execute to return an already-parsed object
      mockOmniAutomation.execute.mockResolvedValue({
        id: 'task123',
        name: 'Updated Task',
        updated: true
      });

      const result = await tool.execute({
        taskId: 'task123',
        name: 'Updated Task'
      });

      expect(result.success).toBe(true);
      expect(result.task).toEqual({
        id: 'task123',
        name: 'Updated Task',
        updated: true
      });
    });

    it('should handle JSON parse errors gracefully', async () => {
      const tool = new UpdateTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore
      tool.logger = mockLogger;
      
      // Mock execute to return invalid JSON
      mockOmniAutomation.execute.mockResolvedValue('Invalid JSON {');

      const result = await tool.execute({
        taskId: 'task123',
        name: 'Updated Task'
      });

      expect(result.error).toBe(true);
      expect(result.message).toBe('Failed to parse task update response');
    });
  });

  describe('CreateTaskTool', () => {
    it('should parse JSON string results before returning', async () => {
      const tool = new CreateTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore
      tool.logger = mockLogger;
      
      mockOmniAutomation.execute.mockResolvedValue(
        JSON.stringify({
          success: true,
          taskId: 'new123',
          task: { id: 'new123', name: 'New Task', flagged: false, inInbox: true }
        })
      );

      const result = await tool.execute({
        name: 'New Task'
      });

      expect(typeof result).toBe('object');
      expect(typeof result).not.toBe('string');
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('new123');
    });
  });

  describe('CompleteTaskTool', () => {
    it('should parse JSON string results before returning', async () => {
      const tool = new CompleteTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore
      tool.logger = mockLogger;
      
      mockOmniAutomation.execute.mockResolvedValue(
        JSON.stringify({
          id: 'task123',
          completed: true,
          completionDate: '2025-01-08T10:00:00Z'
        })
      );

      const result = await tool.execute({ taskId: 'task123' });

      expect(typeof result).toBe('object');
      expect(typeof result).not.toBe('string');
      expect(result.success).toBe(true);
      expect(result.task.completed).toBe(true);
    });
  });

  describe('DeleteTaskTool', () => {
    it('should parse JSON string results before returning', async () => {
      const tool = new DeleteTaskTool(mockCacheManager as any, mockOmniAutomation as any);
      // @ts-ignore
      tool.logger = mockLogger;
      
      mockOmniAutomation.execute.mockResolvedValue(
        JSON.stringify({
          id: 'task123',
          deleted: true,
          name: 'Deleted Task'
        })
      );

      const result = await tool.execute({ taskId: 'task123' });

      expect(typeof result).toBe('object');
      expect(typeof result).not.toBe('string');
      expect(result.success).toBe(true);
      expect(result.task.deleted).toBe(true);
    });
  });
});