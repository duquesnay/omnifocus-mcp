export const EXPORT_TASKS_SCRIPT = `
  const filter = {{filter}};
  const format = {{format}};
  const fields = {{fields}};
  
  try {
    const tasks = [];
    const allTasks = doc.flattenedTasks();
    const allFields = fields || ['name', 'note', 'project', 'tags', 'deferDate', 'dueDate', 'completed', 'flagged'];
    
    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];
      
      // Apply filters
      if (filter.available !== undefined && task.effectivelyHidden() === filter.available) continue;
      
      if (filter.completed !== undefined && task.completed() !== filter.completed) continue;
      
      if (filter.flagged !== undefined && task.flagged() !== filter.flagged) continue;
      
      if (filter.project) {
        try {
          const project = task.containingProject();
          if (!project || project.name() !== filter.project) continue;
        } catch (e) {
          continue;
        }
      }
      
      if (filter.projectId) {
        try {
          const project = task.containingProject();
          if (!project || project.id() !== filter.projectId) continue;
        } catch (e) {
          continue;
        }
      }
      
      if (filter.tags && filter.tags.length > 0) {
        try {
          const taskTags = task.tags().map(t => t.name());
          const hasAllTags = filter.tags.every(tag => taskTags.includes(tag));
          if (!hasAllTags) continue;
        } catch (e) {
          continue;
        }
      }
      
      if (filter.search) {
        try {
          const name = task.name() || '';
          const note = task.note() || '';
          const searchText = (name + ' ' + note).toLowerCase();
          if (!searchText.includes(filter.search.toLowerCase())) continue;
        } catch (e) {
          continue;
        }
      }
      
      // Build task object with requested fields
      const taskData = {};
      
      if (allFields.includes('id')) {
        taskData.id = task.id();
      }
      
      if (allFields.includes('name')) {
        taskData.name = task.name();
      }
      
      if (allFields.includes('note')) {
        const note = task.note();
        if (note) taskData.note = note;
      }
      
      if (allFields.includes('project')) {
        try {
          const project = task.containingProject();
          if (project) {
            taskData.project = project.name();
            taskData.projectId = project.id();
          }
        } catch (e) {}
      }
      
      if (allFields.includes('tags')) {
        try {
          const tags = task.tags();
          if (tags && tags.length > 0) {
            taskData.tags = tags.map(t => t.name());
          }
        } catch (e) {}
      }
      
      if (allFields.includes('deferDate')) {
        const deferDate = task.deferDate();
        if (deferDate) taskData.deferDate = deferDate.toISOString();
      }
      
      if (allFields.includes('dueDate')) {
        const dueDate = task.dueDate();
        if (dueDate) taskData.dueDate = dueDate.toISOString();
      }
      
      if (allFields.includes('completed')) {
        taskData.completed = task.completed();
        if (task.completed()) {
          const completionDate = task.completionDate();
          if (completionDate) taskData.completionDate = completionDate.toISOString();
        }
      }
      
      if (allFields.includes('flagged')) {
        taskData.flagged = task.flagged();
      }
      
      if (allFields.includes('estimated')) {
        const minutes = task.estimatedMinutes();
        if (minutes && minutes > 0) {
          taskData.estimatedMinutes = minutes;
        }
      }
      
      if (allFields.includes('created')) {
        const created = task.creationDate();
        if (created) taskData.createdDate = created.toISOString();
      }
      
      if (allFields.includes('modified')) {
        const modified = task.modificationDate();
        if (modified) taskData.modifiedDate = modified.toISOString();
      }
      
      tasks.push(taskData);
    }
    
    // Format output based on requested format
    if (format === 'csv') {
      // Build CSV
      const headers = Object.keys(tasks[0] || {});
      let csv = headers.join(',') + '\\n';
      
      for (const task of tasks) {
        const row = headers.map(h => {
          const value = task[h];
          if (value === undefined || value === null) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          if (Array.isArray(value)) {
            return '"' + value.join('; ') + '"';
          }
          return value.toString();
        });
        csv += row.join(',') + '\\n';
      }
      
      return JSON.stringify({
        format: 'csv',
        data: csv,
        count: tasks.length
      });
    } else {
      // Default to JSON
      return JSON.stringify({
        format: 'json',
        data: tasks,
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

export const EXPORT_PROJECTS_SCRIPT = `
  const includeStats = {{includeStats}};
  const format = {{format}};
  
  try {
    const projects = [];
    const allProjects = doc.flattenedProjects();
    
    for (let i = 0; i < allProjects.length; i++) {
      const project = allProjects[i];
      
      const projectData = {
        id: project.id(),
        name: project.name(),
        status: project.status ? project.status.name : 'active'
      };
      
      // Add note if present
      const note = project.note();
      if (note) projectData.note = note;
      
      // Add parent info
      try {
        const parent = project.parentFolder();
        if (parent) {
          projectData.parentId = parent.id();
          projectData.parentName = parent.name();
        }
      } catch (e) {}
      
      // Add dates
      const deferDate = project.deferDate();
      if (deferDate) projectData.deferDate = deferDate.toISOString();
      
      const dueDate = project.dueDate();
      if (dueDate) projectData.dueDate = dueDate.toISOString();
      
      const completionDate = project.completionDate();
      if (completionDate) projectData.completionDate = completionDate.toISOString();
      
      const modifiedDate = project.modificationDate();
      if (modifiedDate) projectData.modifiedDate = modifiedDate.toISOString();
      
      // Add statistics if requested
      if (includeStats) {
        const tasks = project.flattenedTasks();
        let totalTasks = 0;
        let completedTasks = 0;
        let availableTasks = 0;
        let overdueCount = 0;
        let flaggedCount = 0;
        const now = new Date();
        
        for (let j = 0; j < tasks.length; j++) {
          const task = tasks[j];
          totalTasks++;
          
          if (task.completed()) {
            completedTasks++;
          } else {
            if (!task.effectivelyHidden()) {
              availableTasks++;
            }
            const dueDate = task.dueDate();
            if (dueDate && dueDate < now) {
              overdueCount++;
            }
          }
          
          if (task.flagged()) {
            flaggedCount++;
          }
        }
        
        projectData.stats = {
          totalTasks: totalTasks,
          completedTasks: completedTasks,
          availableTasks: availableTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          overdueCount: overdueCount,
          flaggedCount: flaggedCount
        };
      }
      
      projects.push(projectData);
    }
    
    // Format output based on requested format
    if (format === 'csv') {
      // Flatten the data for CSV
      const headers = ['id', 'name', 'status', 'note', 'parentName', 'deferDate', 'dueDate', 'completionDate'];
      if (includeStats) {
        headers.push('totalTasks', 'completedTasks', 'availableTasks', 'completionRate', 'overdueCount', 'flaggedCount');
      }
      
      let csv = headers.join(',') + '\\n';
      
      for (const project of projects) {
        const row = headers.map(h => {
          let value = project[h];
          if (h.includes('Tasks') || h.includes('Count') || h === 'completionRate') {
            value = project.stats ? project.stats[h] : '';
          }
          if (value === undefined || value === null) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value.toString();
        });
        csv += row.join(',') + '\\n';
      }
      
      return JSON.stringify({
        format: 'csv',
        data: csv,
        count: projects.length
      });
    } else {
      // Default to JSON
      return JSON.stringify({
        format: 'json',
        data: projects,
        count: projects.length
      });
    }
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to export projects: " + error.toString()
    });
  }
`;