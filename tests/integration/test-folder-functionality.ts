#!/usr/bin/env npx tsx
import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RPCMessage {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface RPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: any;
}

class MCPTestClient {
  private server: any;
  private messageId = 0;
  private buffer = '';

  constructor() {
    const serverPath = join(__dirname, '../../dist/index.js');
    this.server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LOG_LEVEL: 'error' }
    });

    this.server.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.server.stderr.on('data', (data: Buffer) => {
      console.error('Server error:', data.toString());
    });
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          this.handleResponse(response);
        } catch (e) {
          console.error('Failed to parse response:', line);
        }
      }
    }
  }

  private handleResponse(response: RPCResponse) {
    console.log(`← Response for ${response.id}:`, JSON.stringify(response, null, 2));
  }

  async sendRequest(method: string, params?: any): Promise<void> {
    const message: RPCMessage = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method,
      params
    };

    console.log(`→ Sending: ${method}`);
    this.server.stdin.write(JSON.stringify(message) + '\n');

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async close() {
    this.server.kill();
  }
}

async function runTests() {
  console.log('Testing OmniFocus MCP Server Folder Functionality...\n');

  const client = new MCPTestClient();

  try {
    // Initialize
    await client.sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    // Test 1: Create project with folder
    console.log('\n📁 Test 1: Create project with new folder');
    await client.sendRequest('tools/call', {
      name: 'create_project',
      arguments: {
        name: 'Test Project in Folder',
        note: 'This project should be created in a new folder',
        parentFolder: 'Test Folder MCP',
        flagged: true
      }
    });

    // Test 2: Move project to different folder
    console.log('\n📁 Test 2: Move project to a different folder');
    await client.sendRequest('tools/call', {
      name: 'update_project',
      arguments: {
        projectName: 'Test Project in Folder',
        updates: {
          folder: 'Another Test Folder'
        }
      }
    });

    // Test 3: Move project to root
    console.log('\n📁 Test 3: Move project to root');
    await client.sendRequest('tools/call', {
      name: 'update_project',
      arguments: {
        projectName: 'Test Project in Folder',
        updates: {
          folder: null
        }
      }
    });

    // Test 4: Update project with multiple fields including folder
    console.log('\n📁 Test 4: Update multiple fields including folder');
    await client.sendRequest('tools/call', {
      name: 'update_project',
      arguments: {
        projectName: 'Test Project in Folder',
        updates: {
          note: 'Updated note',
          flagged: false,
          folder: 'Final Test Folder'
        }
      }
    });

    // Test 5: List projects to verify folder placement
    console.log('\n📁 Test 5: List projects to verify folder');
    await client.sendRequest('tools/call', {
      name: 'list_projects',
      arguments: {
        search: 'Test Project in Folder'
      }
    });

    console.log('\n✅ All folder functionality tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

runTests().catch(console.error);