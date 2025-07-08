import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

// Integration test to verify bug fixes work with actual MCP server
describe('Bug Fixes Verification', () => {
  const serverPath = path.join(process.cwd(), 'dist', 'index.js');
  
  async function callMcpServer(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, LOG_LEVEL: 'error' }
      });

      let outputData = '';
      let errorData = '';
      let responseReceived = false;

      child.stdout.on('data', (data) => {
        outputData += data.toString();
        
        // Try to parse each line as it might contain our response
        const lines = outputData.split('\n');
        for (const line of lines) {
          if (line.trim() && !responseReceived) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.jsonrpc === '2.0' && parsed.id === 2) {
                responseReceived = true;
                child.kill();
                resolve(parsed);
              }
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Send initialize request
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '1.0',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' }
        },
        id: 1
      }) + '\n');

      // Send the actual request after a short delay
      setTimeout(() => {
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: 2
        }) + '\n');
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          child.kill();
          reject(new Error(`Timeout waiting for response. Output: ${outputData}, Error: ${errorData}`));
        }
      }, 10000);
    });
  }

  describe('JSON Encoding Fix', () => {
    it('should return parsed objects, not JSON strings', async () => {
      const response = await callMcpServer('tools/call', {
        name: 'list_projects',
        arguments: {}
      });

      // The result should be an object, not a JSON string
      expect(response.result).toBeDefined();
      expect(typeof response.result).toBe('object');
      
      // If it returns projects, they should have id fields
      if (response.result.projects && response.result.projects.length > 0) {
        expect(response.result.projects[0]).toHaveProperty('id');
        expect(typeof response.result.projects[0].id).toBe('string');
      }
    }, 15000);
  });

  describe('List Projects ID Field', () => {
    it('should return projects with id field', async () => {
      const response = await callMcpServer('tools/call', {
        name: 'list_projects',
        arguments: {}
      });

      expect(response.result).toBeDefined();
      expect(response.result.projects).toBeDefined();
      
      // Every project should have an id field
      if (response.result.projects.length > 0) {
        response.result.projects.forEach((project: any) => {
          expect(project).toHaveProperty('id');
          expect(project.id).toBeTruthy();
          expect(typeof project.id).toBe('string');
        });
      }
    }, 15000);
  });

  describe('Update Task Script', () => {
    it('should have projectId support in simplified script', async () => {
      // This test verifies the script contains the fix
      // We can't actually test task updates without creating test data
      const fs = await import('fs');
      const scriptPath = path.join(process.cwd(), 'dist', 'omnifocus', 'scripts', 'tasks.js');
      const content = await fs.promises.readFile(scriptPath, 'utf-8');
      
      // Verify the simplified script has projectId handling
      expect(content).toContain('UPDATE_TASK_SCRIPT_SIMPLE');
      expect(content).toContain('if (updates.projectId !== undefined)');
      expect(content).toContain('task.assignedContainer = doc.inbox');
      
      // Verify no 100 task limit
      expect(content).toContain('for (let i = 0; i < tasks.length; i++)');
      expect(content).not.toContain('i < 100;');
    });
  });
});