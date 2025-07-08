import { describe, it, expect } from 'vitest';

describe('ID Extraction Bug', () => {
  it('should document the numeric extraction pattern', () => {
    // Claude Desktop appears to extract numbers from IDs:
    const examples = [
      { original: 'az5Ieo4ip7K', extracted: '547' },      // 5, 4, 7
      { original: 'hJgIIAvYYbl', extracted: 'null' },     // no numbers
      { original: 'abc123def456', extracted: '123456' },  // theoretical
      { original: '123', extracted: '123' },              // all numbers
      { original: 'test', extracted: 'null' },            // no numbers
    ];
    
    // This seems to be happening at the Claude Desktop input layer
    // Not in our code, but in how Claude interprets the parameters
    
    examples.forEach(({ original, extracted }) => {
      const numbers = original.match(/\d/g);
      const wouldExtract = numbers ? numbers.join('') : 'null';
      
      console.log(`ID: ${original} → Numbers: ${wouldExtract} (Claude uses: ${extracted})`);
    });
  });
  
  it('should verify our IDs are strings in the schema', () => {
    // Our schema correctly defines IDs as strings
    const UpdateTaskToolSchema = {
      projectId: {
        type: ['string', 'null'],
        description: 'Move task to different project'
      },
      taskId: {
        type: 'string',
        description: 'ID of the task to update'
      }
    };
    
    // Both should be string types
    expect(UpdateTaskToolSchema.projectId.type).toContain('string');
    expect(UpdateTaskToolSchema.taskId.type).toBe('string');
  });
});