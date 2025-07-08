#!/usr/bin/env tsx

// This script simulates the MCP call to update_task and logs it before execution

async function debugMCPCall() {
  const taskId = 'enWOc0D-_IG';
  const projectId = 'fHBFvCscY10';
  
  console.log('command_send mcp__omnifocus__update_task');
  console.log('Parameters:');
  console.log(`  taskId: "${taskId}"`);
  console.log(`  projectId: "${projectId}"`);
  console.log('');
  
  // Simulate the actual MCP call structure
  const mcpRequest = {
    method: 'tools/call',
    params: {
      name: 'update_task',
      arguments: {
        taskId: taskId,
        projectId: projectId
      }
    }
  };
  
  console.log('Full MCP Request:');
  console.log(JSON.stringify(mcpRequest, null, 2));
  console.log('');
  
  // Now actually try to import and call the function
  try {
    const { UpdateTaskTool } = await import('./src/tools/tasks/UpdateTaskTool');
    const tool = new UpdateTaskTool();
    
    console.log('Executing update_task...');
    const result = await tool.execute({ taskId, projectId });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMCPCall();