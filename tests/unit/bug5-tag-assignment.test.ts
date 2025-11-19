import { describe, it, expect } from 'vitest';
import { CREATE_TASK_SCRIPT } from '../../src/omnifocus/scripts/tasks.js';

/**
 * BUG5: User assigns tags during task creation and sees tags applied to new task
 *
 * CURRENT BEHAVIOR: Tags parameter is silently ignored when creating tasks
 * EXPECTED BEHAVIOR: Tags should be created/assigned, or explicit error if operation fails
 *
 * This test verifies the CREATE_TASK_SCRIPT implements fail-fast behavior for tag assignment errors
 */

describe('BUG5: Tag Assignment in Create Task Script', () => {
  it('should fail-fast when tag assignment fails (not add to warnings)', () => {
    // Verify the script contains fail-fast error handling for tag errors
    // NOT: catch (tagError) { tagAddError = tagError.toString(); }
    // YES: catch (tagError) { return JSON.stringify({ error: true, ... }); }

    // BUG5 FIX: Use correct JXA app.add() method instead of OmniAutomation task.addTags()
    expect(CREATE_TASK_SCRIPT).toContain('app.add(tagsToAdd[i], {to: task.tags})');
    expect(CREATE_TASK_SCRIPT).toContain('catch (tagError)');

    // Fail-fast pattern: should return error immediately, not store in variable
    expect(CREATE_TASK_SCRIPT).toContain('return JSON.stringify({');
    expect(CREATE_TASK_SCRIPT).toContain('error: true');
    expect(CREATE_TASK_SCRIPT).toContain('Failed to add tags to task');

    // Should NOT have the old silent failure pattern
    expect(CREATE_TASK_SCRIPT).not.toContain('tagAddError = tagError');
  });

  it('should handle tags that do not exist with clear warnings', () => {
    // Verify the script warns about tags not found
    expect(CREATE_TASK_SCRIPT).toContain('tagsNotFound');
    expect(CREATE_TASK_SCRIPT).toContain('Tags not found and were not added');
    expect(CREATE_TASK_SCRIPT).toContain('Use manage_tags tool to create them first');
  });

  it('should attempt to find and add existing tags', () => {
    // Verify the script looks up existing tags before task creation
    expect(CREATE_TASK_SCRIPT).toContain('doc.flattenedTags()');
    expect(CREATE_TASK_SCRIPT).toContain('tagsToAdd.push(existingTags[i])');

    // Verify it actually adds the tags using correct JXA method
    expect(CREATE_TASK_SCRIPT).toContain('app.add(tagsToAdd[i], {to: task.tags})');
  });

  it('should return tag assignment status in response', () => {
    // Verify the response includes tag assignment information
    expect(CREATE_TASK_SCRIPT).toContain('tagsAdded: tagsToAdd.length');
    expect(CREATE_TASK_SCRIPT).toContain('tagsRequested: (taskData.tags || []).length');
  });

  it('should not have unused tagAddError variable', () => {
    // Verify we removed the old error-storing pattern
    const scriptLines = CREATE_TASK_SCRIPT.split('\n');
    const tagAddErrorDeclaration = scriptLines.find(line =>
      line.includes('tagAddError') && line.includes('null')
    );

    expect(tagAddErrorDeclaration).toBeUndefined();
  });
});
