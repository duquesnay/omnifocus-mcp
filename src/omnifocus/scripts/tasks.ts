export const LIST_TASKS_SCRIPT = `
  const filter = {{filter}};
  const tasks = [];

  try {
    const allTasks = doc.flattenedTasks();
    const limit = Math.min(filter.limit || 100, 1000); // Cap at 1000
    let count = 0;
    let hasMore = false;
    const startTime = Date.now();

    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];

      // Skip if task doesn't match filters
      if (filter.completed !== undefined && task.completed() !== filter.completed) continue;
      if (filter.flagged !== undefined && task.flagged() !== filter.flagged) continue;
      if (filter.inInbox !== undefined && task.inInbox() !== filter.inInbox) continue;

      // Search filter
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

      // Project filter
      if (filter.projectId !== undefined) {
        try {
          const project = task.containingProject();
          if (filter.projectId === null && project !== null) continue;
          if (filter.projectId !== null && (!project || project.id() !== filter.projectId)) continue;
        } catch (e) {
          continue;
        }
      }

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        try {
          const taskTags = task.tags().map(t => t.name());
          const hasAllTags = filter.tags.every(tag => taskTags.includes(tag));
          if (!hasAllTags) continue;
        } catch (e) {
          continue;
        }
      }

      // Date filters
      if (filter.dueBefore || filter.dueAfter) {
        try {
          const dueDate = task.dueDate();
          if (!dueDate && (filter.dueBefore || filter.dueAfter)) continue; // Skip tasks without due dates
          if (filter.dueBefore && dueDate > new Date(filter.dueBefore)) continue;
          if (filter.dueAfter && dueDate < new Date(filter.dueAfter)) continue;
        } catch (e) {
          continue;
        }
      }

      if (filter.deferBefore || filter.deferAfter) {
        try {
          const deferDate = task.deferDate();
          if (!deferDate && (filter.deferBefore || filter.deferAfter)) continue; // Skip tasks without defer dates
          if (filter.deferBefore && deferDate > new Date(filter.deferBefore)) continue;
          if (filter.deferAfter && deferDate < new Date(filter.deferAfter)) continue;
        } catch (e) {
          continue;
        }
      }

      // Available filter
      if (filter.available) {
        try {
          if (task.completed() || task.dropped()) continue;
          const deferDate = task.deferDate();
          if (deferDate && deferDate > new Date()) continue;
        } catch (e) {
          continue;
        }
      }

      // Early exit when limit reached
      if (count >= limit) {
        hasMore = true;
        break;
      }

      // Build task object with safe property access
      const taskObj = {
        id: task.id(),
        name: task.name(),
        completed: task.completed(),
        flagged: task.flagged(),
        inInbox: task.inInbox()
      };

      // Add optional properties safely
      try {
        const note = task.note();
        if (note) taskObj.note = note;
      } catch (e) {}

      try {
        const project = task.containingProject();
        if (project) {
          taskObj.project = project.name();
          taskObj.projectId = project.id();
        }
      } catch (e) {}

      try {
        const dueDate = task.dueDate();
        if (dueDate) taskObj.dueDate = dueDate.toISOString();
      } catch (e) {}

      try {
        const deferDate = task.deferDate();
        if (deferDate) taskObj.deferDate = deferDate.toISOString();
      } catch (e) {}

      try {
        const tags = task.tags();
        taskObj.tags = tags.map(t => t.name());
      } catch (e) {
        taskObj.tags = [];
      }

      tasks.push(taskObj);
      count++;
    }

    const endTime = Date.now();

    return JSON.stringify({
      tasks: tasks,
      metadata: {
        items_returned: tasks.length,
        limit_applied: limit,
        has_more: hasMore,
        query_time_ms: endTime - startTime,
        filters_applied: {
          completed: filter.completed,
          flagged: filter.flagged,
          inInbox: filter.inInbox,
          search: filter.search,
          tags: filter.tags,
          projectId: filter.projectId,
          dueBefore: filter.dueBefore,
          dueAfter: filter.dueAfter,
          deferBefore: filter.deferBefore,
          deferAfter: filter.deferAfter,
          available: filter.available
        }
      }
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to list tasks: " + error.toString(),
      details: error.message
    });
  }
`;

export const CREATE_TASK_SCRIPT = `
  const taskData = {{taskData}};
  
  try {
    // Create task data object for JXA
    const taskObj = {
      name: taskData.name
    };
    
    // Add optional properties
    if (taskData.note !== undefined) taskObj.note = taskData.note;
    if (taskData.flagged !== undefined) taskObj.flagged = taskData.flagged;
    if (taskData.dueDate !== undefined && taskData.dueDate) taskObj.dueDate = new Date(taskData.dueDate);
    if (taskData.deferDate !== undefined && taskData.deferDate) taskObj.deferDate = new Date(taskData.deferDate);
    if (taskData.estimatedMinutes !== undefined) taskObj.estimatedMinutes = taskData.estimatedMinutes;
    
    // Handle tags before task creation
    const tagsToAdd = [];
    const tagsNotFound = [];
    if (taskData.tags && taskData.tags.length > 0) {
      const existingTags = doc.flattenedTags();
      for (const tagName of taskData.tags) {
        let found = false;
        for (let i = 0; i < existingTags.length; i++) {
          if (existingTags[i].name() === tagName) {
            tagsToAdd.push(existingTags[i]);
            found = true;
            break;
          }
        }
        if (!found) {
          tagsNotFound.push(tagName);
        }
      }
    }
    
    // Create the task using JXA syntax
    const newTask = app.InboxTask(taskObj);
    const inbox = doc.inboxTasks;
    inbox.push(newTask);

    // Try to get the real OmniFocus ID by finding the task we just created
    let taskId = null;
    let createdTask = null;
    let assignedProjectName = null;

    try {
      const allInboxTasks = doc.inboxTasks();
      for (let i = allInboxTasks.length - 1; i >= 0; i--) {
        const task = allInboxTasks[i];
        if (task.name() === taskData.name) {
          taskId = task.id();
          createdTask = task;

          // Assign to project if projectId provided
          if (taskData.projectId) {
            const projects = doc.flattenedProjects();
            let projectFound = false;
            let assignedProject = null;
            for (let j = 0; j < projects.length; j++) {
              // Prefer id() but fall back to id.primaryKey for JXA tolerance
              let pid = null;
              try { pid = projects[j].id(); } catch (e) {}
              if (pid !== taskData.projectId) {
                try { pid = projects[j].id.primaryKey; } catch (e) {}
              }
              if (pid === taskData.projectId) {
                task.assignedContainer = projects[j];
                assignedProject = projects[j];
                projectFound = true;
                break;
              }
            }
            if (!projectFound) {
              // Check if this looks like Claude Desktop extracted a number from an alphanumeric ID
              const isNumericOnly = /^\d+$/.test(taskData.projectId);
              let errorMessage = "Project with ID '" + taskData.projectId + "' not found";

              if (isNumericOnly) {
                errorMessage += ". CLAUDE DESKTOP BUG DETECTED: Claude Desktop may have extracted numbers from an alphanumeric project ID (e.g., '547' from 'az5Ieo4ip7K'). Please use the list_projects tool to get the correct full project ID and try again.";
              }

              return JSON.stringify({
                error: true,
                message: errorMessage
              });
            }

            // Verify the assignment landed (silent-fail prone on JXA)
            let projAfter = null;
            try { projAfter = task.containingProject(); } catch (e) { projAfter = null; }
            let projAfterId = null;
            try { projAfterId = projAfter ? projAfter.id() : null; } catch (e) {}
            if (!projAfter || projAfterId !== taskData.projectId) {
              // JXA assignedContainer is structurally broken on OF 4.6 (setter accepted,
              // move not applied — proven live 2026-07-04). Real fix: OmniJS moveTasks()
              // via the Omni Automation bridge. IDs are interpolated with JSON.stringify
              // so quotes/backslashes in identifiers cannot break out of the snippet.
              const omniJs = "(function(){" +
                " var t = Task.byIdentifier(" + JSON.stringify(taskId) + ");" +
                " var p = null;" +
                " try { p = Project.byIdentifier(" + JSON.stringify(taskData.projectId) + "); } catch (e) { p = null; }" +
                " if (!p) { p = flattenedProjects.find(function(pr) { return pr.id.primaryKey === " + JSON.stringify(taskData.projectId) + "; }) || null; }" +
                " if (!t || !p) { return 'omnijs-move: task or project not found'; }" +
                " moveTasks([t], p);" +
                " return 'omnijs-move: ok';" +
                "})()";
              try { app.evaluateJavascript(omniJs); } catch (e) {}
              // Re-verify via the ALREADY HELD task reference — byId lookups can be
              // stale directly after moveTasks() (see CLAUDE.md JXA gotchas).
              projAfter = null;
              try { projAfter = task.containingProject(); } catch (e) { projAfter = null; }
              projAfterId = null;
              try { projAfterId = projAfter ? projAfter.id() : null; } catch (e) {}
            }
            if (!projAfter || projAfterId !== taskData.projectId) {
              return JSON.stringify({
                error: true,
                message: "Task created but project assignment did not persist. Task is in inbox. Expected project '" + taskData.projectId + "'.",
                taskId: task.id(),
                hint: "JXA assignedContainer setter accepted but OmniFocus did not honor the assignment, and the OmniJS moveTasks() fallback did not verify either."
              });
            }
            assignedProjectName = projAfter.name();
          }

          // Add tags to the created task
          if (tagsToAdd.length > 0) {
            try {
              task.addTags(tagsToAdd);
            } catch (tagError) {
              // Fail-fast: Tag assignment errors should not be silently ignored
              return JSON.stringify({
                error: true,
                message: "Failed to add tags to task: " + tagError.toString()
              });
            }
          }

          break;
        }
      }
    } catch (e) {
      // If we can't get the real ID, generate a temporary one
      taskId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    }
    
    // Build warnings for tag issues
    const warnings = [];
    if (tagsNotFound.length > 0) {
      warnings.push("Tags not found and were not added: " + tagsNotFound.join(", ") + ". Use manage_tags tool to create them first.");
    }

    const result = {
      success: true,
      taskId: taskId,
      task: {
        id: taskId,
        name: taskData.name,
        flagged: taskData.flagged || false,
        inInbox: !assignedProjectName,
        projectName: assignedProjectName || null,
        tagsAdded: tagsToAdd.length,
        tagsRequested: (taskData.tags || []).length
      }
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to create task: " + error.toString(),
      details: error.message
    });
  }
`;

// Simplified version to debug freeze issue
export const UPDATE_TASK_SCRIPT_SIMPLE = `
  const taskId = {{taskId}};
  const updates = {{updates}};
  
  try {
    // Find task by ID - simplified search
    const tasks = doc.flattenedTasks();
    let task = null;
    for (let i = 0; i < tasks.length; i++) { // Search all tasks
      if (tasks[i].id() === taskId) {
        task = tasks[i];
        break;
      }
    }
    if (!task) {
      return JSON.stringify({ error: true, message: 'Task not found' });
    }
    
    // Apply updates - basic properties
    if (updates.name !== undefined) task.name = updates.name;
    if (updates.note !== undefined) task.note = updates.note;
    if (updates.flagged !== undefined) task.flagged = updates.flagged;
    
    // Handle project assignment (simplified version)
    if (updates.projectId !== undefined) {
      if (updates.projectId === "") {
        // Move to inbox - set assignedContainer to null which moves task to inbox
        task.assignedContainer = null;
      } else {
        // Find and assign project by ID
        const projects = doc.flattenedProjects();
        let projectFound = false;
        for (let i = 0; i < projects.length; i++) {
          if (projects[i].id() === updates.projectId) {
            task.assignedContainer = projects[i];
            projectFound = true;
            break;
          }
        }
        if (!projectFound) {
          // Check if this looks like Claude Desktop extracted a number from an alphanumeric ID
          const isNumericOnly = /^\d+$/.test(updates.projectId);
          let errorMessage = "Project with ID '" + updates.projectId + "' not found";
          
          if (isNumericOnly) {
            errorMessage += ". CLAUDE DESKTOP BUG DETECTED: Claude Desktop may have extracted numbers from an alphanumeric project ID (e.g., '547' from 'az5Ieo4ip7K'). Please use the list_projects tool to get the correct full project ID and try again.";
          }
          
          return JSON.stringify({
            error: true,
            message: errorMessage
          });
        }
      }
    }
    
    // Build response with updated fields
    const response = {
      id: task.id(),
      name: task.name(),
      updated: true,
      changes: {}
    };
    
    // Track what was actually changed
    if (updates.name !== undefined) response.changes.name = updates.name;
    if (updates.note !== undefined) response.changes.note = updates.note;
    if (updates.flagged !== undefined) response.changes.flagged = updates.flagged;
    if (updates.projectId !== undefined) {
      response.changes.projectId = updates.projectId;
      if (updates.projectId !== "") {
        const project = task.containingProject();
        if (project) {
          response.changes.projectName = project.name();
        }
      } else {
        response.changes.projectName = "Inbox";
      }
    }
    
    return JSON.stringify(response);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to update task: " + error.toString()
    });
  }
`;

// UPDATE_TASK_SCRIPT
// Verifies every property write via cross-read so silent JXA no-ops on
// dueDate / deferDate / projectId surface as structured errors rather than
// false-positive success. JXA on German macOS occasionally accepts a Date
// assignment without persisting it; the verify-after-set pattern catches that.
export const UPDATE_TASK_SCRIPT = `
  const taskId = {{taskId}};
  const updates = {{updates}};

  // Helpers (kept inside the script template since this runs in osascript JXA)
  function safeId(obj) {
    try {
      if (obj && obj.id && typeof obj.id === 'function') return obj.id();
    } catch (e) {}
    try {
      if (obj && obj.id && obj.id.primaryKey) return obj.id.primaryKey;
    } catch (e) {}
    return null;
  }

  function findTaskById(id) {
    const tasks = doc.flattenedTasks();
    for (let i = 0; i < tasks.length; i++) {
      if (safeId(tasks[i]) === id) return tasks[i];
    }
    return null;
  }

  function findProjectById(id) {
    const projects = doc.flattenedProjects();
    for (let i = 0; i < projects.length; i++) {
      if (safeId(projects[i]) === id) return projects[i];
    }
    return null;
  }

  function dateEquals(a, b) {
    // OmniFocus stores dates with second-level granularity. ISO inputs from
    // callers usually carry milliseconds — compare floor-to-second so a
    // legitimate write of "...:33.741Z" matches the persisted "...:33.000Z"
    // without flagging it as a silent failure.
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    try {
      const ta = Math.floor(new Date(a).getTime() / 1000);
      const tb = Math.floor(new Date(b).getTime() / 1000);
      return ta === tb;
    } catch (e) { return false; }
  }

  try {
    const task = findTaskById(taskId);
    if (!task) {
      return JSON.stringify({ error: true, message: 'Task not found' });
    }

    const verifyFailures = [];
    const changes = {};

    // ---- name ----
    if (updates.name !== undefined) {
      task.name = updates.name;
      const after = task.name();
      if (after === updates.name) {
        changes.name = updates.name;
      } else {
        verifyFailures.push('name');
      }
    }

    // ---- note ----
    if (updates.note !== undefined) {
      task.note = updates.note;
      const after = task.note();
      if (after === updates.note) {
        changes.note = updates.note;
      } else {
        verifyFailures.push('note');
      }
    }

    // ---- flagged ----
    if (updates.flagged !== undefined) {
      task.flagged = updates.flagged;
      const after = task.flagged();
      if (after === updates.flagged) {
        changes.flagged = updates.flagged;
      } else {
        verifyFailures.push('flagged');
      }
    }

    // ---- dueDate (silent-fail prone on JXA) ----
    if (updates.dueDate !== undefined) {
      const desired = updates.dueDate ? new Date(updates.dueDate) : null;
      task.dueDate = desired;
      let after = null;
      try { after = task.dueDate(); } catch (e) { after = null; }
      const afterIso = after ? after.toISOString() : null;
      const desiredIso = desired ? desired.toISOString() : null;
      if (dateEquals(afterIso, desiredIso)) {
        changes.dueDate = afterIso;
      } else {
        verifyFailures.push('dueDate (got ' + afterIso + ', expected ' + desiredIso + ')');
      }
    }

    // ---- deferDate (silent-fail prone on JXA) ----
    if (updates.deferDate !== undefined) {
      const desired = updates.deferDate ? new Date(updates.deferDate) : null;
      task.deferDate = desired;
      let after = null;
      try { after = task.deferDate(); } catch (e) { after = null; }
      const afterIso = after ? after.toISOString() : null;
      const desiredIso = desired ? desired.toISOString() : null;
      if (dateEquals(afterIso, desiredIso)) {
        changes.deferDate = afterIso;
      } else {
        verifyFailures.push('deferDate (got ' + afterIso + ', expected ' + desiredIso + ')');
      }
    }

    // ---- estimatedMinutes ----
    if (updates.estimatedMinutes !== undefined) {
      task.estimatedMinutes = updates.estimatedMinutes;
      let after = null;
      try { after = task.estimatedMinutes(); } catch (e) { after = null; }
      // OmniFocus returns null for cleared estimate
      const matches = (updates.estimatedMinutes === null && (after === null || after === 0))
        || after === updates.estimatedMinutes;
      if (matches) {
        changes.estimatedMinutes = updates.estimatedMinutes;
      } else {
        verifyFailures.push('estimatedMinutes (got ' + after + ', expected ' + updates.estimatedMinutes + ')');
      }
    }

    // ---- projectId (move task to project / inbox) ----
    if (updates.projectId !== undefined) {
      if (updates.projectId === "" || updates.projectId === null) {
        task.assignedContainer = null;
        // Verify: containingProject() should be null after move-to-inbox
        let projAfter = null;
        try { projAfter = task.containingProject(); } catch (e) { projAfter = null; }
        if (projAfter === null) {
          changes.projectId = "";
          changes.projectName = "Inbox";
        } else {
          verifyFailures.push('projectId (still in project ' + projAfter.name() + ' after move to inbox)');
        }
      } else {
        const project = findProjectById(updates.projectId);
        if (!project) {
          const isNumericOnly = /^\\d+$/.test(updates.projectId);
          let errorMessage = "Project with ID '" + updates.projectId + "' not found";
          if (isNumericOnly) {
            errorMessage += ". CLAUDE DESKTOP BUG DETECTED: Claude Desktop may have extracted numbers from an alphanumeric project ID (e.g., '547' from 'az5Ieo4ip7K'). Please use the list_projects tool to get the correct full project ID and try again.";
          }
          return JSON.stringify({ error: true, message: errorMessage });
        }
        task.assignedContainer = project;
        // Verify: containingProject() id should match
        let projAfter = null;
        try { projAfter = task.containingProject(); } catch (e) { projAfter = null; }
        let projAfterId = safeId(projAfter);
        if (!projAfter || projAfterId !== updates.projectId) {
          // JXA assignedContainer is structurally broken on OF 4.6 (setter accepted,
          // move not applied — proven live 2026-07-04). Real fix: OmniJS moveTasks()
          // via the Omni Automation bridge. IDs are interpolated with JSON.stringify
          // so quotes/backslashes in identifiers cannot break out of the snippet.
          const omniJs = "(function(){" +
            " var t = Task.byIdentifier(" + JSON.stringify(taskId) + ");" +
            " var p = null;" +
            " try { p = Project.byIdentifier(" + JSON.stringify(updates.projectId) + "); } catch (e) { p = null; }" +
            " if (!p) { p = flattenedProjects.find(function(pr) { return pr.id.primaryKey === " + JSON.stringify(updates.projectId) + "; }) || null; }" +
            " if (!t || !p) { return 'omnijs-move: task or project not found'; }" +
            " moveTasks([t], p);" +
            " return 'omnijs-move: ok';" +
            "})()";
          try { app.evaluateJavascript(omniJs); } catch (e) {}
          // Re-verify via the ALREADY HELD task reference — byId lookups can be
          // stale directly after moveTasks() (see CLAUDE.md JXA gotchas).
          projAfter = null;
          try { projAfter = task.containingProject(); } catch (e) { projAfter = null; }
          projAfterId = safeId(projAfter);
        }
        if (projAfter && projAfterId === updates.projectId) {
          changes.projectId = updates.projectId;
          changes.projectName = projAfter.name();
        } else {
          verifyFailures.push('projectId (containingProject id is ' + projAfterId + ', expected ' + updates.projectId + '; OmniJS moveTasks fallback did not verify either)');
        }
      }
    }

    // ---- tags (replace all) ----
    if (updates.tags !== undefined) {
      const currentTags = task.tags();
      if (currentTags.length > 0) {
        task.removeTags(currentTags);
      }
      if (updates.tags.length > 0) {
        const existingTags = doc.flattenedTags();
        const tagsToAdd = [];
        for (const tagName of updates.tags) {
          let found = false;
          for (let i = 0; i < existingTags.length; i++) {
            if (existingTags[i].name() === tagName) {
              tagsToAdd.push(existingTags[i]);
              found = true;
              break;
            }
          }
          if (!found) {
            const newTag = app.Tag({name: tagName});
            doc.tags.push(newTag);
            tagsToAdd.push(newTag);
          }
        }
        if (tagsToAdd.length > 0) {
          task.addTags(tagsToAdd);
        }
      }
      // Verify by reading current tag names back
      const verifyTags = task.tags().map(function(t) { return t.name(); });
      const desiredSorted = (updates.tags || []).slice().sort();
      const verifySorted = verifyTags.slice().sort();
      const tagsEqual = desiredSorted.length === verifySorted.length
        && desiredSorted.every(function(v, i) { return v === verifySorted[i]; });
      if (tagsEqual) {
        changes.tags = verifyTags;
      } else {
        verifyFailures.push('tags (got ' + JSON.stringify(verifyTags) + ', expected ' + JSON.stringify(updates.tags) + ')');
      }
    }

    // If ANY verify-after-set failed, surface a structured error rather than fake success.
    if (verifyFailures.length > 0) {
      return JSON.stringify({
        error: true,
        message: "Update verification failed for: " + verifyFailures.join('; '),
        partialChanges: changes,
        hint: "JXA property setter accepted but OmniFocus did not persist. Date locale or container-type mismatch is the usual cause."
      });
    }

    return JSON.stringify({
      id: safeId(task),
      name: task.name(),
      updated: true,
      changes: changes
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to update task: " + error.toString(),
      details: error.message
    });
  }
`;

export const COMPLETE_TASK_SCRIPT = `
  const taskId = {{taskId}};
  
  try {
    // Find task by ID
    const tasks = doc.flattenedTasks();
    let task = null;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id() === taskId) {
        task = tasks[i];
        break;
      }
    }
    if (!task) {
      return JSON.stringify({ error: true, message: 'Task not found' });
    }
    
    if (task.completed()) {
      return JSON.stringify({ error: true, message: 'Task already completed' });
    }
    
    // Mark as complete using JXA property setter
    task.completed = true;
    
    return JSON.stringify({
      id: task.id(),
      completed: true,
      completionDate: task.completionDate() ? task.completionDate().toISOString() : new Date().toISOString()
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to complete task: " + error.toString(),
      details: error.message
    });
  }
`;

// Omni Automation script for completing tasks (bypasses JXA permission issues)
// IIFE-Wrap: omnijs-run executes the script as top-level; without a function
// `return` is a SyntaxError. task.id.primaryKey is the Omni Automation API
// (not task.id() — that's JXA syntax).
export const COMPLETE_TASK_OMNI_SCRIPT = `
(() => {
  const taskId = {{taskId}};

  try {
    const tasks = flattenedTasks;
    let targetTask = null;

    tasks.forEach(task => {
      if (task.id.primaryKey === taskId) {
        targetTask = task;
      }
    });

    if (!targetTask) {
      throw new Error('Task not found');
    }

    if (targetTask.completed) {
      throw new Error('Task already completed');
    }

    targetTask.markComplete();
    return true;
  } catch (error) {
    throw new Error("Failed to complete task: " + error.toString());
  }
})();
`;

export const DELETE_TASK_SCRIPT = `
  const taskId = {{taskId}};
  
  try {
    // Find task by ID
    const tasks = doc.flattenedTasks();
    let task = null;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id() === taskId) {
        task = tasks[i];
        break;
      }
    }
    if (!task) {
      return JSON.stringify({ error: true, message: 'Task not found' });
    }
    
    const taskName = task.name();
    
    // Delete using JXA app.delete method
    app.delete(task);
    
    return JSON.stringify({
      id: taskId,
      deleted: true,
      name: taskName
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to delete task: " + error.toString(),
      details: error.message
    });
  }
`;

// Omni Automation script for deleting tasks (bypasses JXA permission issues)
export const DELETE_TASK_OMNI_SCRIPT = `
  const taskId = {{taskId}};
  
  try {
    // Find task by ID using Omni Automation
    const tasks = flattenedTasks;
    let targetTask = null;
    
    tasks.forEach(task => {
      if (task.id() === taskId) {
        targetTask = task;
      }
    });
    
    if (!targetTask) {
      throw new Error('Task not found');
    }
    
    const taskName = targetTask.name;
    
    // Delete using Omni Automation method
    deleteObject(targetTask);
    
    // Return success (URL scheme doesn't return values directly)
    return true;
  } catch (error) {
    throw new Error("Failed to delete task: " + error.toString());
  }
`;

export const TODAYS_AGENDA_SCRIPT = `
  const options = {{options}};
  const tasks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const allTasks = doc.flattenedTasks();
    const startTime = Date.now();
    
    let dueTodayCount = 0;
    let overdueCount = 0;
    let flaggedCount = 0;
    
    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];
      
      // Skip completed tasks
      if (task.completed()) continue;
      
      // Check if available (if required)
      if (options.includeAvailable) {
        try {
          const deferDate = task.deferDate();
          if (deferDate && deferDate > new Date()) continue;
          // Note: Full availability check would include blocked status
        } catch (e) {}
      }
      
      let includeTask = false;
      let reason = '';
      
      // Check due date
      try {
        const dueDate = task.dueDate();
        if (dueDate) {
          if (dueDate < today && options.includeOverdue) {
            includeTask = true;
            reason = 'overdue';
            overdueCount++;
          } else if (dueDate >= today && dueDate < tomorrow) {
            includeTask = true;
            reason = 'due_today';
            dueTodayCount++;
          }
        }
      } catch (e) {}
      
      // Check flagged status
      if (!includeTask && options.includeFlagged && task.flagged()) {
        includeTask = true;
        reason = 'flagged';
        flaggedCount++;
      }
      
      if (includeTask) {
        // Build task object
        const taskObj = {
          id: task.id(),
          name: task.name(),
          completed: false,
          flagged: task.flagged(),
          reason: reason
        };
        
        // Add optional properties
        try {
          const note = task.note();
          if (note) taskObj.note = note;
        } catch (e) {}
        
        try {
          const project = task.containingProject();
          if (project) {
            taskObj.project = project.name();
            taskObj.projectId = project.id();
          }
        } catch (e) {}
        
        try {
          const dueDate = task.dueDate();
          if (dueDate) taskObj.dueDate = dueDate.toISOString();
        } catch (e) {}
        
        try {
          const deferDate = task.deferDate();
          if (deferDate) taskObj.deferDate = deferDate.toISOString();
        } catch (e) {}
        
        try {
          const tags = task.tags();
          taskObj.tags = tags.map(t => t.name());
        } catch (e) {
          taskObj.tags = [];
        }
        
        tasks.push(taskObj);
      }
    }
    
    const endTime = Date.now();
    
    // Sort tasks by priority: overdue first, then due today, then flagged
    tasks.sort((a, b) => {
      const priority = {'overdue': 0, 'due_today': 1, 'flagged': 2};
      return priority[a.reason] - priority[b.reason];
    });
    
    return JSON.stringify({
      tasks: tasks,
      summary: {
        total: tasks.length,
        overdue: overdueCount,
        due_today: dueTodayCount,
        flagged: flaggedCount,
        query_time_ms: endTime - startTime
      }
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to get today's agenda: " + error.toString(),
      details: error.message
    });
  }
`;

export const GET_TASK_COUNT_SCRIPT = `
  const filter = {{filter}};
  
  try {
    const allTasks = doc.flattenedTasks();
    let count = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];
      
      // Skip if task doesn't match filters
      if (filter.completed !== undefined && task.completed() !== filter.completed) continue;
      if (filter.flagged !== undefined && task.flagged() !== filter.flagged) continue;
      if (filter.inInbox !== undefined && task.inInbox() !== filter.inInbox) continue;
      
      // Additional filters that require more processing
      if (filter.projectId !== undefined) {
        try {
          const project = task.containingProject();
          if (filter.projectId === null && project !== null) continue;
          if (filter.projectId !== null && (!project || project.id() !== filter.projectId)) continue;
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
      
      if (filter.dueBefore || filter.dueAfter) {
        try {
          const dueDate = task.dueDate();
          if (filter.dueBefore && (!dueDate || dueDate > new Date(filter.dueBefore))) continue;
          if (filter.dueAfter && (!dueDate || dueDate < new Date(filter.dueAfter))) continue;
        } catch (e) {
          if (filter.dueBefore || filter.dueAfter) continue;
        }
      }
      
      if (filter.deferBefore || filter.deferAfter) {
        try {
          const deferDate = task.deferDate();
          if (filter.deferBefore && (!deferDate || deferDate > new Date(filter.deferBefore))) continue;
          if (filter.deferAfter && (!deferDate || deferDate < new Date(filter.deferAfter))) continue;
        } catch (e) {
          if (filter.deferBefore || filter.deferAfter) continue;
        }
      }
      
      if (filter.available) {
        try {
          if (task.completed() || task.dropped()) continue;
          const deferDate = task.deferDate();
          if (deferDate && deferDate > new Date()) continue;
          // Check if blocked (has incomplete sequential predecessors)
          // This is simplified - full availability logic is complex
        } catch (e) {
          continue;
        }
      }
      
      count++;
    }
    
    const endTime = Date.now();
    
    return JSON.stringify({
      count: count,
      query_time_ms: endTime - startTime,
      filters_applied: {
        completed: filter.completed,
        flagged: filter.flagged,
        inInbox: filter.inInbox,
        search: filter.search,
        tags: filter.tags,
        projectId: filter.projectId,
        dueBefore: filter.dueBefore,
        dueAfter: filter.dueAfter,
        deferBefore: filter.deferBefore,
        deferAfter: filter.deferAfter,
        available: filter.available
      }
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to count tasks: " + error.toString(),
      details: error.message
    });
  }
`;