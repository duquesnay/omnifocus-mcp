// Fixed export scripts that handle format parameters correctly

export const EXPORT_TASKS_FIXED = `
  const filter = {{filter}};
  const format = {{format}};
  const fields = {{fields}} || ['id', 'name', 'project', 'dueDate', 'completed', 'flagged'];
  
  try {
    const app = Application('OmniFocus');
    const doc = app.defaultDocument;
    
    // Get tasks
    const allTasks = filter.available ? doc.availableTasks() : doc.flattenedTasks();
    const tasks = [];
    const limit = 1000;
    
    for (let i = 0; i < allTasks.length && tasks.length < limit; i++) {
      const task = allTasks[i];
      
      // Apply filters
      if (filter.completed !== undefined && task.completed() !== filter.completed) continue;
      if (filter.flagged !== undefined && task.flagged() !== filter.flagged) continue;
      if (filter.inInbox !== undefined && task.inInbox() !== filter.inInbox) continue;
      
      // Apply search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const name = (task.name() || '').toLowerCase();
        const note = (task.note() || '').toLowerCase();
        if (!name.includes(searchLower) && !note.includes(searchLower)) continue;
      }
      
      // Apply project filter
      if (filter.project) {
        try {
          const project = task.containingProject();
          if (!project || project.name() !== filter.project) continue;
        } catch (e) {
          continue;
        }
      }
      
      // Apply tag filter
      if (filter.tags && filter.tags.length > 0) {
        try {
          const taskTags = task.tags();
          const taskTagNames = [];
          for (let j = 0; j < taskTags.length; j++) {
            taskTagNames.push(taskTags[j].name());
          }
          
          let hasAllTags = true;
          for (let j = 0; j < filter.tags.length; j++) {
            if (!taskTagNames.includes(filter.tags[j])) {
              hasAllTags = false;
              break;
            }
          }
          if (!hasAllTags) continue;
        } catch (e) {
          continue;
        }
      }
      
      // Build task object with requested fields
      const taskObj = {};
      
      for (let j = 0; j < fields.length; j++) {
        const field = fields[j];
        
        switch(field) {
          case 'id':
            taskObj.id = task.id();
            break;
          case 'name':
            taskObj.name = task.name();
            break;
          case 'note':
            try {
              taskObj.note = task.note() || '';
            } catch (e) {
              taskObj.note = '';
            }
            break;
          case 'project':
            try {
              const project = task.containingProject();
              taskObj.project = project ? project.name() : '';
            } catch (e) {
              taskObj.project = '';
            }
            break;
          case 'tags':
            try {
              const tags = task.tags();
              const tagNames = [];
              for (let k = 0; k < tags.length; k++) {
                tagNames.push(tags[k].name());
              }
              taskObj.tags = tagNames;
            } catch (e) {
              taskObj.tags = [];
            }
            break;
          case 'dueDate':
            try {
              const dueDate = task.dueDate();
              taskObj.dueDate = dueDate ? dueDate.toISOString() : null;
            } catch (e) {
              taskObj.dueDate = null;
            }
            break;
          case 'deferDate':
            try {
              const deferDate = task.deferDate();
              taskObj.deferDate = deferDate ? deferDate.toISOString() : null;
            } catch (e) {
              taskObj.deferDate = null;
            }
            break;
          case 'completed':
            taskObj.completed = task.completed();
            break;
          case 'flagged':
            taskObj.flagged = task.flagged();
            break;
          case 'estimated':
            try {
              taskObj.estimated = task.estimatedMinutes() || 0;
            } catch (e) {
              taskObj.estimated = 0;
            }
            break;
          case 'created':
            try {
              const created = task.creationDate();
              taskObj.created = created ? created.toISOString() : null;
            } catch (e) {
              taskObj.created = null;
            }
            break;
          case 'modified':
            try {
              const modified = task.modificationDate();
              taskObj.modified = modified ? modified.toISOString() : null;
            } catch (e) {
              taskObj.modified = null;
            }
            break;
        }
      }
      
      tasks.push(taskObj);
    }
    
    // Format output
    if (format === 'csv') {
      // Create CSV with proper escaping
      let csv = fields.join(',') + '\\n';
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const row = [];
        
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          let value = task[field];
          
          if (value === null || value === undefined) {
            value = '';
          } else if (Array.isArray(value)) {
            value = value.join('; ');
          } else if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\\n'))) {
            // Escape CSV values
            value = '"' + value.replace(/"/g, '""') + '"';
          }
          
          row.push(value);
        }
        
        csv += row.join(',') + '\\n';
      }
      
      return JSON.stringify({
        format: 'csv',
        data: csv,
        count: tasks.length
      });
    } else {
      // Return as JSON
      return JSON.stringify({
        format: 'json',
        data: JSON.stringify(tasks, null, 2),
        count: tasks.length
      });
    }
    
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to export tasks: " + error.toString()
    });
  }
`;