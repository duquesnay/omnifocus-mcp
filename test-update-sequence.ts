#!/usr/bin/env tsx

// Test the complete update sequence with logging

async function testUpdateSequence() {
  const taskId = 'enWOc0D-_IG';
  const projects = ['fHBFvCscY10', 'oYYV6-TqZDL', 'lvFI8K_mnnA', 'az5Ieo4ip7K', 'hJgIIAvYYbl'];
  
  console.log('=== Testing Update Sequence ===');
  console.log(`Task ID: ${taskId}`);
  console.log('Projects to move through:', projects);
  console.log('');
  
  // First, verify the task exists
  console.log('command_send mcp__omnifocus__list_tasks with search="Weekly Review Notes"');
  
  try {
    const { ListTasksTool } = await import('./src/tools/tasks/ListTasksTool');
    const listTool = new ListTasksTool();
    const tasks = await listTool.execute({ search: "Weekly Review Notes" });
    console.log('Current tasks:', JSON.stringify(tasks, null, 2));
    console.log('');
    
    // Now try each update
    const { UpdateTaskTool } = await import('./src/tools/tasks/UpdateTaskTool');
    const updateTool = new UpdateTaskTool();
    
    for (let i = 0; i < projects.length; i++) {
      const projectId = projects[i];
      console.log(`=== Update ${i + 1}: Moving to project ${projectId} ===`);
      console.log(`command_send mcp__omnifocus__update_task with taskId="${taskId}", projectId="${projectId}"`);
      
      try {
        const result = await updateTool.execute({ taskId, projectId });
        console.log('Update result:', JSON.stringify(result, null, 2));
        
        // Verify the update
        console.log('command_send mcp__omnifocus__list_tasks to verify location');
        const verifyTasks = await listTool.execute({ search: "Weekly Review Notes" });
        const updatedTask = verifyTasks.tasks?.find(t => t.id === taskId);
        console.log('Task location after update:', updatedTask ? {
          id: updatedTask.id,
          name: updatedTask.name,
          projectId: updatedTask.projectId,
          projectName: updatedTask.projectName,
          inInbox: updatedTask.inInbox
        } : 'Task not found');
        
      } catch (error) {
        console.error('Update error:', error);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpdateSequence();