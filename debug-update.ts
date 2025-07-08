#!/usr/bin/env tsx

import { updateTask } from './src/tools/tasks/update-task';

async function debugUpdateTask() {
  const taskId = 'enWOc0D-_IG';
  const projectId = 'fHBFvCscY10';
  
  console.log('About to call update_task with parameters:');
  console.log(`taskId: ${taskId}`);
  console.log(`projectId: ${projectId}`);
  console.log('');
  
  try {
    const result = await updateTask({
      taskId,
      projectId
    });
    console.log('Update result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Update error:', error);
  }
}

debugUpdateTask();