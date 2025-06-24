#!/usr/bin/env node
/**
 * Test script to verify that Claude Code can use our MCP server
 * This provides command-line testing without needing Claude Desktop
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.log('Claude Code MCP Integration Test');
console.log('================================');

// Configuration for Claude Code MCP testing
const CONFIG = {
  serverPath: './dist/index.js',
  testTools: [
    {
      name: 'get_task_count',
      args: { completed: false },
      description: 'Count incomplete tasks'
    },
    {
      name: 'todays_agenda',
      args: { includeFlagged: true },
      description: 'Get today\'s agenda'
    },
    {
      name: 'list_tags',
      args: { sortBy: 'usage' },
      description: 'List tags by usage'
    },
    {
      name: 'get_productivity_stats',
      args: { period: 'week' },
      description: 'Get weekly productivity stats'
    }
  ]
};

class MCPTester {
  constructor() {
    this.server = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.testResults = [];
  }

  async start() {
    console.log(`Starting MCP server: ${CONFIG.serverPath}`);
    
    this.server = spawn('node', [CONFIG.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    const rl = createInterface({
      input: this.server.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        this.handleResponse(response);
      } catch (e) {
        // Ignore non-JSON output
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    this.server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    // Give server time to start
    await this.delay(500);
  }

  async initialize() {
    console.log('\n1. Initializing MCP connection...');
    
    const initRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'claude-code-test',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(initRequest);
    
    if (response.result) {
      console.log('✅ MCP initialization successful');
      console.log(`   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
      
      // Send initialized notification
      this.server.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }) + '\n');
      
      return true;
    } else {
      console.error('❌ MCP initialization failed:', response.error);
      return false;
    }
  }

  async listTools() {
    console.log('\n2. Requesting tools list...');
    
    const toolsRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendRequest(toolsRequest);
    
    if (response.result) {
      const tools = response.result.tools;
      console.log(`✅ ${tools.length} tools available`);
      
      // List some key tools
      const keyTools = tools.filter(t => 
        ['list_tasks', 'get_productivity_stats', 'list_tags', 'export_tasks'].includes(t.name)
      );
      
      console.log('   Key tools:', keyTools.map(t => t.name).join(', '));
      
      return tools;
    } else {
      console.error('❌ Failed to get tools list:', response.error);
      return [];
    }
  }

  async testTools() {
    console.log('\n3. Testing tool execution...');
    
    for (const test of CONFIG.testTools) {
      console.log(`\n   Testing: ${test.name} - ${test.description}`);
      
      const startTime = Date.now();
      const toolRequest = {
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'tools/call',
        params: {
          name: test.name,
          arguments: test.args
        }
      };

      const response = await this.sendRequest(toolRequest, 30000); // 30 second timeout
      const elapsed = Date.now() - startTime;
      
      if (response.result) {
        console.log(`   ✅ ${test.name} completed in ${elapsed}ms`);
        
        try {
          const content = response.result.content[0].text;
          const result = JSON.parse(content);
          
          // Show relevant info from the result
          if (result.count !== undefined) {
            console.log(`      Result: ${result.count} items`);
          } else if (result.tasks) {
            console.log(`      Result: ${result.tasks.length} tasks`);
          } else if (result.tags) {
            console.log(`      Result: ${result.tags.length} tags`);
          } else if (result.stats) {
            console.log(`      Result: productivity stats generated`);
          }
          
          this.testResults.push({ tool: test.name, success: true, time: elapsed });
        } catch (parseError) {
          console.log(`      Raw result length: ${response.result.content[0].text.length} chars`);
          this.testResults.push({ tool: test.name, success: true, time: elapsed });
        }
      } else {
        console.error(`   ❌ ${test.name} failed:`, response.error);
        this.testResults.push({ tool: test.name, success: false, time: elapsed, error: response.error });
      }
    }
  }

  async sendRequest(request, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const requestId = request.id;
      
      // Store the resolver
      this.pendingRequests.set(requestId, resolve);
      
      // Send the request
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${requestId} timed out after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  handleResponse(response) {
    if (response.id && this.pendingRequests.has(response.id)) {
      const resolver = this.pendingRequests.get(response.id);
      this.pendingRequests.delete(response.id);
      resolver(response);
    }
  }

  nextId() {
    return ++this.messageId;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printSummary() {
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    console.log(`Tools tested: ${total}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${total - successful}`);
    
    if (successful === total) {
      console.log('\n✅ All tests passed! The MCP server is working correctly.');
      console.log('   You can use this server with Claude Code by configuring it in your MCP settings.');
    } else {
      console.log('\n❌ Some tests failed. Check the output above for details.');
    }

    console.log('\nPerformance:');
    for (const result of this.testResults) {
      if (result.success) {
        console.log(`   ${result.tool}: ${result.time}ms`);
      } else {
        console.log(`   ${result.tool}: FAILED`);
      }
    }
  }

  async cleanup() {
    if (this.server && !this.server.killed) {
      this.server.kill();
    }
  }
}

// Run the test
async function runTest() {
  const tester = new MCPTester();
  
  try {
    await tester.start();
    
    const initialized = await tester.initialize();
    if (!initialized) {
      process.exit(1);
    }
    
    const tools = await tester.listTools();
    if (tools.length === 0) {
      process.exit(1);
    }
    
    await tester.testTools();
    tester.printSummary();
    
    await tester.cleanup();
    
    const successful = tester.testResults.filter(r => r.success).length;
    process.exit(successful === tester.testResults.length ? 0 : 1);
    
  } catch (error) {
    console.error('Test failed:', error);
    await tester.cleanup();
    process.exit(1);
  }
}

runTest();