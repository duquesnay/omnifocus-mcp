import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListProjectsTool } from '../../src/tools/projects/ListProjectsTool';
import { LIST_PROJECTS_SCRIPT } from '../../src/omnifocus/scripts/projects';

describe('List Projects ID Field', () => {
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

  let listProjectsTool: ListProjectsTool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheManager.get.mockReturnValue(null);
    mockOmniAutomation.buildScript.mockReturnValue('mock script');
    
    listProjectsTool = new ListProjectsTool(mockCacheManager as any, mockOmniAutomation as any);
    // @ts-ignore
    listProjectsTool.logger = mockLogger;
  });

  describe('Script validation', () => {
    it('should use project.id() instead of project.id.primaryKey', () => {
      // The script should use the correct JXA API
      expect(LIST_PROJECTS_SCRIPT).toContain('id: project.id()');
      expect(LIST_PROJECTS_SCRIPT).not.toContain('id: project.id.primaryKey');
    });

    it('should return id field in project object', () => {
      // Verify the structure includes id
      const projectObjPattern = /const projectObj = \{[\s\S]*?id: project\.id\(\)/;
      expect(LIST_PROJECTS_SCRIPT).toMatch(projectObjPattern);
    });
  });

  describe('Tool execution', () => {
    it('should return projects with id field', async () => {
      // Mock the script execution to return projects with IDs
      mockOmniAutomation.execute.mockResolvedValue({
        projects: [
          {
            id: 'proj123',
            name: 'Test Project 1',
            status: 'active',
            flagged: false
          },
          {
            id: 'proj456',
            name: 'Test Project 2',
            status: 'active',
            flagged: true,
            folder: 'Work'
          }
        ]
      });

      const result = await listProjectsTool.execute({});

      expect(result.projects).toHaveLength(2);
      expect(result.projects[0]).toHaveProperty('id', 'proj123');
      expect(result.projects[1]).toHaveProperty('id', 'proj456');
      expect(result.total).toBe(2);
    });

    it('should handle projects with all fields including id', async () => {
      mockOmniAutomation.execute.mockResolvedValue({
        projects: [{
          id: 'complexProj',
          name: 'Complex Project',
          status: 'active',
          flagged: true,
          note: 'Project notes',
          folder: 'Personal',
          dueDate: '2025-02-01T00:00:00Z',
          deferDate: '2025-01-15T00:00:00Z',
          numberOfTasks: 5
        }]
      });

      const result = await listProjectsTool.execute({});

      const project = result.projects[0];
      expect(project).toHaveProperty('id', 'complexProj');
      expect(project).toHaveProperty('name', 'Complex Project');
      expect(project).toHaveProperty('folder', 'Personal');
      expect(project).toHaveProperty('numberOfTasks', 5);
    });

    it('should cache projects with their ids', async () => {
      const projects = [
        { id: 'cached1', name: 'Cached Project 1', status: 'active', flagged: false },
        { id: 'cached2', name: 'Cached Project 2', status: 'active', flagged: true }
      ];

      mockOmniAutomation.execute.mockResolvedValue({ projects });

      // First call - should execute and cache
      const result1 = await listProjectsTool.execute({ status: ['active'] });
      expect(result1.cached).toBe(false);
      expect(result1.projects[0].id).toBe('cached1');

      // Verify cache was set
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'projects',
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ id: 'cached1' }),
          expect.objectContaining({ id: 'cached2' })
        ])
      );

      // Second call setup - return from cache
      mockCacheManager.get.mockReturnValue(projects);
      
      // Second call with same filter - should use cache
      const result2 = await listProjectsTool.execute({ status: ['active'] });
      expect(result2.cached).toBe(true);
      expect(result2.projects[0].id).toBe('cached1');
      expect(result2.projects[1].id).toBe('cached2');
    });
  });
});