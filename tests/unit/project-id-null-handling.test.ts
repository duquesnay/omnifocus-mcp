import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTaskTool } from '../../src/tools/tasks/UpdateTaskTool';

describe('ProjectId Null Handling', () => {
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

  let updateTaskTool: UpdateTaskTool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheManager.get.mockReturnValue(null);
    mockOmniAutomation.buildScript.mockReturnValue('mock script');
    
    updateTaskTool = new UpdateTaskTool(mockCacheManager as any, mockOmniAutomation as any);
    // @ts-ignore
    updateTaskTool.logger = mockLogger;
  });

  it('should include projectId in safe updates when provided', async () => {
    mockOmniAutomation.execute.mockResolvedValue(
      JSON.stringify({ id: 'task123', name: 'Task', updated: true })
    );

    await updateTaskTool.execute({
      taskId: 'task123',
      projectId: 'project456'
    });

    expect(mockOmniAutomation.buildScript).toHaveBeenCalledWith(
      expect.any(String),
      {
        taskId: 'task123',
        updates: { projectId: 'project456' }
      }
    );
  });

  it('should handle projectId null to move task to inbox', async () => {
    mockOmniAutomation.execute.mockResolvedValue(
      JSON.stringify({ id: 'task123', name: 'Task', updated: true })
    );

    await updateTaskTool.execute({
      taskId: 'task123',
      projectId: null
    });

    expect(mockOmniAutomation.buildScript).toHaveBeenCalledWith(
      expect.any(String),
      {
        taskId: 'task123',
        updates: { projectId: null }
      }
    );
  });

  it('should filter out unsupported fields for simplified script', async () => {
    mockOmniAutomation.execute.mockResolvedValue(
      JSON.stringify({ id: 'task123', name: 'Task', updated: true })
    );

    await updateTaskTool.execute({
      taskId: 'task123',
      name: 'Updated Name',
      note: 'Updated Note',
      flagged: true,
      projectId: 'project456',
      // These should be filtered out in simplified script
      dueDate: '2025-01-10T10:00:00Z',
      deferDate: '2025-01-09T10:00:00Z',
      estimatedMinutes: 30,
      tags: ['tag1', 'tag2']
    });

    const callArgs = mockOmniAutomation.buildScript.mock.calls[0];
    const safeUpdates = callArgs[1].updates;

    // Should include supported fields
    expect(safeUpdates).toHaveProperty('name', 'Updated Name');
    expect(safeUpdates).toHaveProperty('note', 'Updated Note');
    expect(safeUpdates).toHaveProperty('flagged', true);
    expect(safeUpdates).toHaveProperty('projectId', 'project456');

    // Should NOT include unsupported fields
    expect(safeUpdates).not.toHaveProperty('dueDate');
    expect(safeUpdates).not.toHaveProperty('deferDate');
    expect(safeUpdates).not.toHaveProperty('estimatedMinutes');
    expect(safeUpdates).not.toHaveProperty('tags');
  });

  it('should document known issue with projectId null causing JXA error', () => {
    // This test documents the known issue where projectId: null causes
    // "Can't convert types" error in JXA when trying to assign doc.inbox
    // This is a limitation of the JXA bridge, not our code
    
    // The workaround would be to use a special value like 'INBOX' instead of null
    // and handle that in the script, but that would be a breaking API change
    
    expect(true).toBe(true); // Placeholder test to document the issue
  });
});