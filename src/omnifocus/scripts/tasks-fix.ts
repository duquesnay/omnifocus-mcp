// This file contains the fix for including task IDs in responses
// To be integrated into tasks.ts

export const FIXED_TASK_FORMATTING = `
      // Format task object - INCLUDING ID!
      const taskObj = {
        id: task.id(),  // ADD THIS LINE - Include the OmniFocus ID
        name: task.name(),
        completed: task.completed(),
        flagged: task.flagged(),
        inInbox: task.inInbox(),
        dropped: task.dropped()
      };
      
      // ... rest of the formatting code remains the same
`;

export const CREATE_TASK_FIX = `
  // After creating the task, we need to find it and return its real ID
  try {
    const doc = Application('OmniFocus').defaultDocument;
    const taskData = {{taskData}};
    
    // Create new task (same as before)
    const newTask = Application('OmniFocus').Task(taskData);
    const inbox = doc.inboxTasks();
    inbox.push(newTask);
    
    // Find the task we just created to get its real ID
    const allTasks = doc.flattenedTasks();
    let createdTask = null;
    
    // Search from the end (most recent tasks)
    for (let i = allTasks.length - 1; i >= 0; i--) {
      const task = allTasks[i];
      if (task.name() === taskData.name && task.inInbox()) {
        createdTask = task;
        break;
      }
    }
    
    if (createdTask) {
      return JSON.stringify({
        success: true,
        taskId: createdTask.id(),  // Return the real OmniFocus ID
        task: {
          id: createdTask.id(),
          name: createdTask.name(),
          flagged: createdTask.flagged() || false,
          inInbox: true
        }
      });
    } else {
      // Fallback if we can't find the created task
      return JSON.stringify({
        success: true,
        taskId: "temp-" + Date.now(),
        task: {
          name: taskData.name,
          inInbox: true
        },
        warning: "Task created but ID could not be retrieved"
      });
    }
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to create task: " + error.toString()
    });
  }
`;

export const LIST_TAGS_FIX = `
  // Fix for listing tags - handle the array conversion properly
  try {
    const doc = Application('OmniFocus').defaultDocument;
    const allTags = doc.flattenedTags();
    const filter = {{filter}};
    
    const tags = [];
    
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      
      // Get basic tag info
      const tagInfo = {
        id: tag.id(),
        name: tag.name()
      };
      
      // Count tasks with this tag
      try {
        const tasksWithTag = doc.flattenedTasks.whose({
          _and: [
            {tags: {_contains: tag}},
            {completed: false}
          ]
        });
        tagInfo.taskCount = tasksWithTag.length;
        tagInfo.availableCount = tasksWithTag.length;
      } catch (e) {
        tagInfo.taskCount = 0;
        tagInfo.availableCount = 0;
      }
      
      // Apply filters
      if (filter.includeEmpty === false && tagInfo.taskCount === 0) {
        continue;
      }
      
      tags.push(tagInfo);
    }
    
    // Sort tags
    if (filter.sortBy === 'usage') {
      tags.sort((a, b) => b.taskCount - a.taskCount);
    } else if (filter.sortBy === 'tasks') {
      tags.sort((a, b) => b.taskCount - a.taskCount);
    } else {
      tags.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return JSON.stringify({
      tags: tags,
      count: tags.length
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to list tags: " + error.toString()
    });
  }
`;

export const EXPORT_TASKS_FIX = `
  // Fix for export - handle format parameter correctly
  try {
    const filter = {{filter}};
    const format = {{format}};
    const fields = {{fields}} || ['id', 'name', 'project', 'dueDate', 'completed', 'flagged'];
    
    // Get tasks using the same logic as LIST_TASKS
    const doc = Application('OmniFocus').defaultDocument;
    const allTasks = filter.available ? doc.availableTasks() : doc.flattenedTasks();
    
    const tasks = [];
    
    for (let i = 0; i < allTasks.length && tasks.length < 1000; i++) {
      const task = allTasks[i];
      
      // Apply filters (same as list_tasks)
      if (filter.completed !== undefined && task.completed() !== filter.completed) continue;
      if (filter.flagged !== undefined && task.flagged() !== filter.flagged) continue;
      
      // Build task object with requested fields only
      const taskObj = {};
      
      if (fields.includes('id')) taskObj.id = task.id();
      if (fields.includes('name')) taskObj.name = task.name();
      if (fields.includes('project')) {
        try {
          const project = task.containingProject();
          taskObj.project = project ? project.name() : null;
        } catch (e) {
          taskObj.project = null;
        }
      }
      if (fields.includes('dueDate')) {
        try {
          const dueDate = task.dueDate();
          taskObj.dueDate = dueDate ? dueDate.toISOString() : null;
        } catch (e) {
          taskObj.dueDate = null;
        }
      }
      if (fields.includes('completed')) taskObj.completed = task.completed();
      if (fields.includes('flagged')) taskObj.flagged = task.flagged();
      
      tasks.push(taskObj);
    }
    
    // Format output based on requested format
    if (format === 'csv') {
      // Create CSV
      const headers = fields.join(',');
      const rows = tasks.map(task => {
        return fields.map(field => {
          const value = task[field];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        }).join(',');
      });
      
      return JSON.stringify({
        format: 'csv',
        data: headers + '\\n' + rows.join('\\n')
      });
    } else {
      // Default to JSON
      return JSON.stringify({
        format: 'json',
        data: JSON.stringify(tasks)
      });
    }
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to export tasks: " + error.toString()
    });
  }
`;