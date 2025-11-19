#!/usr/bin/env tsx

// Test task creation with project and tags (BUG4 fix validation)

async function testCreateWithProjectAndTags() {
  console.log('=== Testing Task Creation with Project and Tags (BUG4 Fix) ===\n');

  try {
    // First, get available projects
    console.log('Step 1: Getting available projects...');
    const { ListProjectsTool } = await import('./src/tools/projects/ListProjectsTool');
    const listProjectsTool = new ListProjectsTool();
    const projects = await listProjectsTool.execute({});

    if (!projects.projects || projects.projects.length === 0) {
      console.error('No projects found. Please create a project first.');
      return;
    }

    const testProject = projects.projects[0];
    console.log(`Using project: ${testProject.name} (${testProject.id})\n`);

    // Get available tags
    console.log('Step 2: Getting available tags...');
    const { ListTagsTool } = await import('./src/tools/tags/ListTagsTool');
    const listTagsTool = new ListTagsTool();
    const tags = await listTagsTool.execute({});

    const testTags = tags.tags?.slice(0, 2).map(t => t.name) || [];
    console.log(`Using tags: ${testTags.join(', ')}\n`);

    // Create task with project and tags
    console.log('Step 3: Creating task with project and tags...');
    const { CreateTaskTool } = await import('./src/tools/tasks/CreateTaskTool');
    const createTool = new CreateTaskTool();

    const taskName = `BUG4 Test Task - ${new Date().toISOString()}`;
    const createParams = {
      name: taskName,
      projectId: testProject.id,
      tags: testTags,
      note: 'Test task for BUG4 fix validation'
    };

    console.log('Creating with params:', JSON.stringify(createParams, null, 2));
    const createResult = await createTool.execute(createParams);
    console.log('Create result:', JSON.stringify(createResult, null, 2));
    console.log('');

    // Verify the task was created correctly
    if (createResult.success && createResult.taskId) {
      console.log('Step 4: Verifying task was created in correct project with tags...');
      const { ListTasksTool } = await import('./src/tools/tasks/ListTasksTool');
      const listTasksTool = new ListTasksTool();

      const searchResult = await listTasksTool.execute({ search: taskName });
      console.log('Search result:', JSON.stringify(searchResult, null, 2));

      if (searchResult.tasks && searchResult.tasks.length > 0) {
        const createdTask = searchResult.tasks[0];
        console.log('\n=== Verification Results ===');
        console.log(`✓ Task created: ${createdTask.name}`);
        console.log(`✓ Task ID: ${createdTask.id}`);
        console.log(`✓ In Inbox: ${createdTask.inInbox}`);
        console.log(`✓ Project: ${createdTask.projectName || 'None'} (${createdTask.projectId || 'None'})`);
        console.log(`✓ Tags: ${createdTask.tags?.map(t => t.name).join(', ') || 'None'}`);

        // Check if expectations are met
        console.log('\n=== BUG4 Fix Validation ===');
        const projectMatches = createdTask.projectId === testProject.id;
        const inCorrectProject = !createdTask.inInbox && projectMatches;
        const hasExpectedTags = createdTask.tags?.length === testTags.length;

        console.log(`${inCorrectProject ? '✓' : '✗'} Task in correct project: ${projectMatches ? 'YES' : 'NO'}`);
        console.log(`${inCorrectProject ? '✓' : '✗'} Task NOT in inbox: ${!createdTask.inInbox ? 'YES' : 'NO'}`);
        console.log(`${hasExpectedTags ? '✓' : '✗'} Tags applied: ${createdTask.tags?.length || 0}/${testTags.length}`);

        if (inCorrectProject && hasExpectedTags) {
          console.log('\n🎉 BUG4 FIX VALIDATED: Task created successfully with project and tags!');
        } else {
          console.log('\n⚠️  BUG4 STILL PRESENT: Task creation did not work as expected');
          if (!inCorrectProject) {
            console.log('   - Task ended up in inbox instead of project');
          }
          if (!hasExpectedTags) {
            console.log(`   - Expected ${testTags.length} tags, got ${createdTask.tags?.length || 0}`);
          }
        }

        // Cleanup
        console.log('\nStep 5: Cleaning up test task...');
        const { DeleteTaskTool } = await import('./src/tools/tasks/DeleteTaskTool');
        const deleteTool = new DeleteTaskTool();
        await deleteTool.execute({ taskId: createdTask.id });
        console.log('Test task deleted.');

      } else {
        console.error('⚠️  Could not find created task for verification');
      }
    } else {
      console.error('⚠️  Task creation failed:', createResult);
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

testCreateWithProjectAndTags();
