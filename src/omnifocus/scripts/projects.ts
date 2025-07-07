export const LIST_PROJECTS_SCRIPT = `
  const filter = {{filter}};
  const projects = [];
  
  try {
    const allProjects = doc.flattenedProjects();
    
    for (let i = 0; i < allProjects.length; i++) {
      const project = allProjects[i];
      
      // Apply filters
      if (filter.status && filter.status.length > 0) {
        const projectStatus = project.status();
        if (!filter.status.includes(projectStatus)) continue;
      }
      
      if (filter.flagged !== undefined && project.flagged() !== filter.flagged) continue;
      
      // Apply search filter
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        const projectName = project.name().toLowerCase();
        let projectNote = '';
        try {
          const note = project.note();
          if (note) projectNote = note.toLowerCase();
        } catch (e) {}
        
        if (!projectName.includes(searchTerm) && !projectNote.includes(searchTerm)) {
          continue;
        }
      }
      
      // Build project object
      const projectObj = {
        id: project.id.primaryKey,
        name: project.name(),
        status: project.status(),
        flagged: project.flagged()
      };
      
      // Add optional properties safely
      try {
        const note = project.note();
        if (note) projectObj.note = note;
      } catch (e) {}
      
      try {
        const folder = project.folder();
        if (folder) projectObj.folder = folder.name();
      } catch (e) {}
      
      try {
        const dueDate = project.dueDate();
        if (dueDate) projectObj.dueDate = dueDate.toISOString();
      } catch (e) {}
      
      try {
        const deferDate = project.deferDate();
        if (deferDate) projectObj.deferDate = deferDate.toISOString();
      } catch (e) {}
      
      try {
        const tasks = project.flattenedTasks();
        projectObj.numberOfTasks = tasks.length;
      } catch (e) {
        projectObj.numberOfTasks = 0;
      }
      
      projects.push(projectObj);
    }
    
    return JSON.stringify({ projects: projects });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to list projects: " + error.toString(),
      details: error.message
    });
  }
`;

export const CREATE_PROJECT_SCRIPT = `
  const name = {{name}};
  const options = {{options}};
  
  try {
    // Check if project already exists
    const existingProjects = doc.flattenedProjects();
    for (let i = 0; i < existingProjects.length; i++) {
      if (existingProjects[i].name() === name) {
        return JSON.stringify({
          error: true,
          message: "Project '" + name + "' already exists"
        });
      }
    }
    
    // Create the project
    const projectProps = { name: name };
    
    // Add optional properties
    if (options.note) {
      projectProps.note = options.note;
    }
    
    if (options.deferDate) {
      projectProps.deferDate = new Date(options.deferDate);
    }
    
    if (options.dueDate) {
      projectProps.dueDate = new Date(options.dueDate);
    }
    
    if (options.flagged !== undefined) {
      projectProps.flagged = options.flagged;
    }
    
    // Create project
    const newProject = app.Project(projectProps);
    
    // Add to specific folder if specified
    if (options.folder) {
      const folders = doc.flattenedFolders();
      let targetFolder = null;
      
      for (let i = 0; i < folders.length; i++) {
        if (folders[i].name() === options.folder) {
          targetFolder = folders[i];
          break;
        }
      }
      
      if (targetFolder) {
        targetFolder.projects.push(newProject);
      } else {
        // Create folder if it doesn't exist
        targetFolder = app.Folder({name: options.folder});
        doc.folders.push(targetFolder);
        targetFolder.projects.push(newProject);
      }
    } else {
      // Add to root projects
      doc.projects.push(newProject);
    }
    
    return JSON.stringify({
      success: true,
      project: {
        id: newProject.id.primaryKey,
        name: newProject.name(),
        createdAt: new Date().toISOString()
      },
      message: "Project '" + name + "' created successfully"
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to create project: " + error.toString()
    });
  }
`;

export const UPDATE_PROJECT_SCRIPT = `
  const projectId = {{projectId}};
  const updates = {{updates}};
  
  try {
    // Find the project by ID
    const projects = doc.flattenedProjects();
    let targetProject = null;
    
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].id.primaryKey === projectId) {
        targetProject = projects[i];
        break;
      }
    }
    
    if (!targetProject) {
      return JSON.stringify({
        error: true,
        message: "Project with ID '" + projectId + "' not found"
      });
    }
    
    // Apply updates
    const changes = [];
    
    if (updates.name && updates.name !== targetProject.name()) {
      // Check if new name already exists
      for (let i = 0; i < projects.length; i++) {
        if (projects[i].name() === updates.name && projects[i] !== targetProject) {
          return JSON.stringify({
            error: true,
            message: "Project '" + updates.name + "' already exists"
          });
        }
      }
      targetProject.name = updates.name;
      changes.push("Name changed to '" + updates.name + "'");
    }
    
    if (updates.note !== undefined) {
      targetProject.note = updates.note;
      changes.push("Note updated");
    }
    
    if (updates.deferDate !== undefined) {
      if (updates.deferDate === null) {
        targetProject.deferDate = null;
        changes.push("Defer date removed");
      } else {
        targetProject.deferDate = new Date(updates.deferDate);
        changes.push("Defer date set to " + updates.deferDate);
      }
    }
    
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null) {
        targetProject.dueDate = null;
        changes.push("Due date removed");
      } else {
        targetProject.dueDate = new Date(updates.dueDate);
        changes.push("Due date set to " + updates.dueDate);
      }
    }
    
    if (updates.flagged !== undefined) {
      targetProject.flagged = updates.flagged;
      changes.push(updates.flagged ? "Flagged" : "Unflagged");
    }
    
    if (updates.status) {
      if (updates.status === 'active') {
        targetProject.status = app.Project.Status.active;
        changes.push("Status set to active");
      } else if (updates.status === 'onHold') {
        targetProject.status = app.Project.Status.onHold;
        changes.push("Status set to on hold");
      } else if (updates.status === 'dropped') {
        targetProject.status = app.Project.Status.dropped;
        changes.push("Status set to dropped");
      } else if (updates.status === 'done') {
        targetProject.status = app.Project.Status.done;
        targetProject.completionDate = new Date();
        changes.push("Project completed");
      }
    }
    
    if (updates.folder !== undefined) {
      // Handle folder movement
      try {
        if (updates.folder === null) {
          // Move to root by using moveTo with location Beginning
          targetProject.moveTo(doc.projects, { at: app.LocationSpecifier.beginning });
          changes.push("Moved to root folder");
        } else {
          // Move to specific folder
          const folders = doc.flattenedFolders();
          let targetFolder = null;
          
          for (let i = 0; i < folders.length; i++) {
            if (folders[i].name() === updates.folder) {
              targetFolder = folders[i];
              break;
            }
          }
          
          if (!targetFolder) {
            // Create folder if it doesn't exist
            targetFolder = app.Folder({name: updates.folder});
            doc.folders.push(targetFolder);
            changes.push("Created folder '" + updates.folder + "'");
          }
          
          // Move project to target folder
          targetProject.moveTo(targetFolder.projects, { at: app.LocationSpecifier.beginning });
          changes.push("Moved to folder '" + updates.folder + "'");
        }
      } catch (moveError) {
        // Fallback: Note the limitation
        changes.push("Note: Folder change requires manual move in OmniFocus");
      }
    }
    
    if (changes.length === 0) {
      return JSON.stringify({
        success: true,
        message: "No changes made to project"
      });
    }
    
    return JSON.stringify({
      success: true,
      project: {
        id: targetProject.id.primaryKey,
        name: targetProject.name()
      },
      changes: changes,
      message: "Project updated successfully"
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to update project: " + error.toString()
    });
  }
`;

export const COMPLETE_PROJECT_SCRIPT = `
  const projectId = {{projectId}};
  const completeAllTasks = {{completeAllTasks}};
  
  try {
    // Find the project by ID
    const projects = doc.flattenedProjects();
    let targetProject = null;
    
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].id.primaryKey === projectId) {
        targetProject = projects[i];
        break;
      }
    }
    
    if (!targetProject) {
      return JSON.stringify({
        error: true,
        message: "Project with ID '" + projectId + "' not found"
      });
    }
    
    // Count incomplete tasks
    const tasks = targetProject.flattenedTasks();
    let incompleteCount = 0;
    let completedCount = 0;
    
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].completed()) {
        incompleteCount++;
      }
    }
    
    // Complete all tasks if requested
    if (completeAllTasks && incompleteCount > 0) {
      for (let i = 0; i < tasks.length; i++) {
        if (!tasks[i].completed()) {
          tasks[i].markComplete();
          completedCount++;
        }
      }
    }
    
    // Complete the project
    targetProject.status = app.Project.Status.done;
    targetProject.completionDate = new Date();
    
    return JSON.stringify({
      success: true,
      project: {
        id: targetProject.id.primaryKey,
        name: targetProject.name(),
        completedAt: targetProject.completionDate().toISOString()
      },
      tasksCompleted: completedCount,
      message: "Project '" + targetProject.name() + "' completed" + 
                (completedCount > 0 ? " with " + completedCount + " tasks" : "")
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to complete project: " + error.toString()
    });
  }
`;

export const DELETE_PROJECT_SCRIPT = `
  const projectId = {{projectId}};
  const deleteTasks = {{deleteTasks}};
  
  try {
    // Find the project by ID
    const projects = doc.flattenedProjects();
    let targetProject = null;
    
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].id.primaryKey === projectId) {
        targetProject = projects[i];
        break;
      }
    }
    
    if (!targetProject) {
      return JSON.stringify({
        error: true,
        message: "Project with ID '" + projectId + "' not found"
      });
    }
    
    const projectName = targetProject.name();
    
    // Count tasks
    const tasks = targetProject.flattenedTasks();
    const taskCount = tasks.length;
    let deletedTaskCount = 0;
    
    // Delete or orphan tasks
    if (deleteTasks && taskCount > 0) {
      // Delete all tasks in the project
      for (let i = tasks.length - 1; i >= 0; i--) {
        tasks[i].remove();
        deletedTaskCount++;
      }
    }
    
    // Delete the project
    targetProject.remove();
    
    return JSON.stringify({
      success: true,
      projectName: projectName,
      tasksDeleted: deletedTaskCount,
      tasksOrphaned: taskCount - deletedTaskCount,
      message: "Project '" + projectName + "' deleted" +
                (deletedTaskCount > 0 ? " with " + deletedTaskCount + " tasks" : "") +
                (taskCount - deletedTaskCount > 0 ? " (" + (taskCount - deletedTaskCount) + " tasks moved to Inbox)" : "")
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to delete project: " + error.toString()
    });
  }
`;