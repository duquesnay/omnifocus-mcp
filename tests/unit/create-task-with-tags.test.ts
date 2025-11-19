import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskTool } from '../../src/tools/tasks/CreateTaskTool.js';
import { ManageTagsTool } from '../../src/tools/tags/ManageTagsTool.js';
import { ListTasksTool } from '../../src/tools/tasks/ListTasksTool.js';
import { DeleteTaskTool } from '../../src/tools/tasks/DeleteTaskTool.js';
import { OmniAutomation } from '../../src/omnifocus/OmniAutomation.js';
import { Logger, createLogger } from '../../src/utils/logger.js';
import { CacheManager } from '../../src/cache/CacheManager.js';

/**
 * BUG5: User assigns tags during task creation and sees tags applied to new task
 *
 * CURRENT BEHAVIOR: Tags parameter is silently ignored when creating tasks
 * EXPECTED BEHAVIOR: Tags should be created/assigned, or explicit error if operation fails
 *
 * This test follows TDD protocol:
 * 1. Write failing test that reproduces the bug
 * 2. Run test to confirm it fails
 * 3. Fix the bug to make test pass
 * 4. Verify no regressions in existing tests
 */

describe('BUG5: Create task with tags', () => {
  let createTaskTool: CreateTaskTool;
  let manageTagsTool: ManageTagsTool;
  let listTasksTool: ListTasksTool;
  let deleteTaskTool: DeleteTaskTool;
  let omnifocus: OmniAutomation;
  let logger: Logger;
  let cache: CacheManager;

  beforeEach(() => {
    logger = createLogger('test');
    cache = new CacheManager(logger);
    omnifocus = new OmniAutomation(logger);

    createTaskTool = new CreateTaskTool(cache, omnifocus, logger);
    manageTagsTool = new ManageTagsTool(cache, omnifocus, logger);
    listTasksTool = new ListTasksTool(cache, omnifocus, logger);
    deleteTaskTool = new DeleteTaskTool(cache, omnifocus, logger);
  });

  it('should create task with existing tags and assign them', async () => {
    const testTagName = `test-tag-${Date.now()}`;
    const testTaskName = `Test task with tags ${Date.now()}`;

    try {
      // Setup: Create a tag first
      const createTagResult = await manageTagsTool.execute({
        action: 'create',
        tagName: testTagName
      });

      expect(createTagResult.error).toBeFalsy();
      expect(createTagResult.success).toBe(true);

      // Act: Create task with the tag
      const createTaskResult = await createTaskTool.execute({
        name: testTaskName,
        tags: [testTagName]
      });

      // Assert: Task creation should succeed
      expect(createTaskResult.error).toBeFalsy();
      expect(createTaskResult.success).toBe(true);
      expect(createTaskResult.taskId).toBeDefined();

      // Assert: Tag should be assigned (not just silently ignored)
      expect(createTaskResult.task.tagsAdded).toBe(1);
      expect(createTaskResult.task.tagsRequested).toBe(1);

      // Verify: List tasks with this tag filter to confirm assignment
      const listResult = await listTasksTool.execute({
        tags: [testTagName],
        completed: false,
        limit: 100
      });

      expect(listResult.error).toBeFalsy();
      const taskWithTag = listResult.tasks.tasks.find((t: any) => t.name === testTaskName);
      expect(taskWithTag).toBeDefined();
      expect(taskWithTag.tags).toContain(testTagName);

      // Cleanup
      await deleteTaskTool.execute({ taskId: createTaskResult.taskId });
      await manageTagsTool.execute({ action: 'delete', tagName: testTagName });

    } catch (error) {
      throw new Error(`Test failed: ${error}`);
    }
  }, { timeout: 10000 });

  it('should fail explicitly when tags cannot be assigned (not silently ignore)', async () => {
    const nonExistentTag = `nonexistent-tag-${Date.now()}`;
    const testTaskName = `Test task fail-fast ${Date.now()}`;

    try {
      // Act: Create task with non-existent tag
      const createTaskResult = await createTaskTool.execute({
        name: testTaskName,
        tags: [nonExistentTag]
      });

      // Assert: Should either:
      // 1. Succeed but indicate tag was not added (warnings)
      // 2. Fail explicitly with clear error message

      if (createTaskResult.success) {
        // If success, warnings should clearly state tags were not added
        expect(createTaskResult.warnings).toBeDefined();
        expect(createTaskResult.warnings.length).toBeGreaterThan(0);
        expect(createTaskResult.warnings.some((w: string) =>
          w.includes(nonExistentTag) && w.includes('not found')
        )).toBe(true);

        // And tags should NOT be reported as added
        expect(createTaskResult.task.tagsAdded).toBe(0);
        expect(createTaskResult.task.tagsRequested).toBe(1);

        // Cleanup
        await deleteTaskTool.execute({ taskId: createTaskResult.taskId });
      } else {
        // If error, message should be clear about the tag issue
        expect(createTaskResult.error).toBe(true);
        expect(createTaskResult.message).toContain(nonExistentTag);
      }

    } catch (error) {
      throw new Error(`Test failed: ${error}`);
    }
  }, { timeout: 10000 });

  it('should handle partial tag assignment (some exist, some do not)', async () => {
    const existingTag = `existing-tag-${Date.now()}`;
    const nonExistentTag = `nonexistent-tag-${Date.now()}`;
    const testTaskName = `Test task partial tags ${Date.now()}`;

    try {
      // Setup: Create only one tag
      await manageTagsTool.execute({
        action: 'create',
        tagName: existingTag
      });

      // Act: Create task with both existing and non-existent tags
      const createTaskResult = await createTaskTool.execute({
        name: testTaskName,
        tags: [existingTag, nonExistentTag]
      });

      // Assert: Should succeed with warnings
      expect(createTaskResult.success).toBe(true);
      expect(createTaskResult.warnings).toBeDefined();

      // Assert: Only existing tag should be added
      expect(createTaskResult.task.tagsAdded).toBe(1);
      expect(createTaskResult.task.tagsRequested).toBe(2);

      // Assert: Warning should mention the non-existent tag
      expect(createTaskResult.warnings.some((w: string) =>
        w.includes(nonExistentTag) && w.includes('not found')
      )).toBe(true);

      // Verify: Task should have the existing tag
      const listResult = await listTasksTool.execute({
        tags: [existingTag],
        completed: false,
        limit: 100
      });

      const taskWithTag = listResult.tasks.tasks.find((t: any) => t.name === testTaskName);
      expect(taskWithTag).toBeDefined();
      expect(taskWithTag.tags).toContain(existingTag);
      expect(taskWithTag.tags).not.toContain(nonExistentTag);

      // Cleanup
      await deleteTaskTool.execute({ taskId: createTaskResult.taskId });
      await manageTagsTool.execute({ action: 'delete', tagName: existingTag });

    } catch (error) {
      throw new Error(`Test failed: ${error}`);
    }
  }, { timeout: 10000 });
});
