import { describe, it, expect } from 'vitest';
import { LIST_TAGS_SCRIPT, MANAGE_TAGS_SCRIPT } from 'src/omnifocus/scripts/tags';

describe('Tag Operations Fix Verification', () => {
  it('should use correct method calls with parentheses', () => {
    // Verify tag method calls use parentheses (except primaryKey which is a property)
    expect(LIST_TAGS_SCRIPT).toContain('tag.parent()');
    expect(LIST_TAGS_SCRIPT).toContain('task.tags()');
    expect(LIST_TAGS_SCRIPT).toContain('tag.name()');
    expect(LIST_TAGS_SCRIPT).toContain('tag.id.primaryKey');
  });
  
  it('should use correct JXA app.add/remove methods for tag manipulation', () => {
    // BUG5 FIX: Verify we're using correct JXA methods (not OmniAutomation methods)
    expect(MANAGE_TAGS_SCRIPT).toContain('app.remove(sourceTag, {from: task.tags})');
    expect(MANAGE_TAGS_SCRIPT).toContain('app.add(targetTagObj, {to: task.tags})');

    // Should not contain OmniAutomation methods
    expect(MANAGE_TAGS_SCRIPT).not.toContain('task.removeTags(');
    expect(MANAGE_TAGS_SCRIPT).not.toContain('task.addTags(');
  });
  
  it('should use JXA app.add/remove with correct syntax', () => {
    // BUG5 FIX: Check that we're using correct JXA app.add/remove syntax
    const addPattern = /app\.add\([^,]+,\s*\{to:\s*task\.tags\}\)/;
    const removePattern = /app\.remove\([^,]+,\s*\{from:\s*task\.tags\}\)/;

    expect(MANAGE_TAGS_SCRIPT).toMatch(addPattern);
    expect(MANAGE_TAGS_SCRIPT).toMatch(removePattern);
  });
  
  it('should return JSON stringified results', () => {
    // Verify all return statements use JSON.stringify
    const returnPattern = /return JSON\.stringify\(/g;
    const listMatches = LIST_TAGS_SCRIPT.match(returnPattern);
    const manageMatches = MANAGE_TAGS_SCRIPT.match(returnPattern);
    
    expect(listMatches).not.toBeNull();
    expect(listMatches!.length).toBeGreaterThan(0);
    expect(manageMatches).not.toBeNull();
    expect(manageMatches!.length).toBeGreaterThan(0);
  });
});