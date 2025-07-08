export const LIST_TAGS_SCRIPT = `
  const options = {{options}};
  
  try {
    const tags = [];
    const allTags = doc.flattenedTags();
    const allTasks = doc.flattenedTasks();
    
    // Count task usage for each tag
    const tagUsage = {};
    
    for (let i = 0; i < allTasks.length; i++) {
      const task = allTasks[i];
      try {
        const taskTags = task.tags();
        for (let j = 0; j < taskTags.length; j++) {
          const tagId = taskTags[j].id();
          if (!tagUsage[tagId]) {
            tagUsage[tagId] = {
              total: 0,
              active: 0,
              completed: 0
            };
          }
          tagUsage[tagId].total++;
          if (task.completed()) {
            tagUsage[tagId].completed++;
          } else {
            tagUsage[tagId].active++;
          }
        }
      } catch (e) {}
    }
    
    // Build tag list
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      const tagId = tag.id();
      const usage = tagUsage[tagId] || { total: 0, active: 0, completed: 0 };
      
      // Skip empty tags if requested
      if (!options.includeEmpty && usage.total === 0) continue;
      
      const tagInfo = {
        id: tagId,
        name: tag.name(),
        usage: usage,
        status: 'active' // Tags don't have status in OmniFocus
      };
      
      // Check for parent tag
      try {
        const parent = tag.parent();
        if (parent) {
          tagInfo.parentId = parent.id();
          tagInfo.parentName = parent.name();
        }
      } catch (e) {}
      
      // Check for child tags
      try {
        const children = tag.tags();
        if (children && children.length > 0) {
          tagInfo.childCount = children.length;
        }
      } catch (e) {}
      
      tags.push(tagInfo);
    }
    
    // Sort tags
    switch(options.sortBy) {
      case 'usage':
        tags.sort((a, b) => b.usage.total - a.usage.total);
        break;
      case 'tasks':
        tags.sort((a, b) => b.usage.active - a.usage.active);
        break;
      case 'name':
      default:
        tags.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    
    // Calculate summary
    const totalTags = tags.length;
    const activeTags = tags.filter(t => t.usage.active > 0).length;
    const emptyTags = tags.filter(t => t.usage.total === 0).length;
    
    return JSON.stringify({
      tags: tags,
      summary: {
        totalTags: totalTags,
        activeTags: activeTags,
        emptyTags: emptyTags,
        mostUsed: tags.length > 0 ? tags[0].name : null
      }
    });
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to list tags: " + error.toString()
    });
  }
`;

export const MANAGE_TAGS_SCRIPT = `
  const action = {{action}};
  const tagName = {{tagName}};
  const newName = {{newName}};
  const targetTag = {{targetTag}};
  
  try {
    const allTags = doc.flattenedTags();
    
    switch(action) {
      case 'create':
        // Check if tag already exists
        for (let i = 0; i < allTags.length; i++) {
          if (allTags[i].name() === tagName) {
            return JSON.stringify({
              error: true,
              message: "Tag '" + tagName + "' already exists"
            });
          }
        }
        
        // Create new tag
        const newTag = app.Tag({name: tagName});
        doc.tags.push(newTag);
        
        return JSON.stringify({
          success: true,
          action: 'created',
          tagName: tagName,
          message: "Tag '" + tagName + "' created successfully"
        });
        
      case 'rename':
        // Find tag to rename
        let tagToRename = null;
        for (let i = 0; i < allTags.length; i++) {
          if (allTags[i].name() === tagName) {
            tagToRename = allTags[i];
            break;
          }
        }
        
        if (!tagToRename) {
          return JSON.stringify({
            error: true,
            message: "Tag '" + tagName + "' not found"
          });
        }
        
        // Check if new name already exists
        for (let i = 0; i < allTags.length; i++) {
          if (allTags[i].name() === newName) {
            return JSON.stringify({
              error: true,
              message: "Tag '" + newName + "' already exists"
            });
          }
        }
        
        // Rename the tag
        tagToRename.name = newName;
        
        return JSON.stringify({
          success: true,
          action: 'renamed',
          oldName: tagName,
          newName: newName,
          message: "Tag renamed from '" + tagName + "' to '" + newName + "'"
        });
        
      case 'delete':
        // Find tag to delete
        let tagToDelete = null;
        let tagIndex = -1;
        for (let i = 0; i < allTags.length; i++) {
          if (allTags[i].name() === tagName) {
            tagToDelete = allTags[i];
            tagIndex = i;
            break;
          }
        }
        
        if (!tagToDelete) {
          return JSON.stringify({
            error: true,
            message: "Tag '" + tagName + "' not found"
          });
        }
        
        // Count tasks using this tag
        let taskCount = 0;
        const tasks = doc.flattenedTasks();
        for (let i = 0; i < tasks.length; i++) {
          try {
            const taskTags = tasks[i].tags();
            for (let j = 0; j < taskTags.length; j++) {
              if (taskTags[j].id() === tagToDelete.id()) {
                taskCount++;
                break;
              }
            }
          } catch (e) {}
        }
        
        // Remove the tag
        tagToDelete.remove();
        
        return JSON.stringify({
          success: true,
          action: 'deleted',
          tagName: tagName,
          tasksAffected: taskCount,
          message: "Tag '" + tagName + "' deleted. " + taskCount + " tasks were affected."
        });
        
      case 'merge':
        // Find source and target tags
        let sourceTag = null;
        let targetTagObj = null;
        
        for (let i = 0; i < allTags.length; i++) {
          if (allTags[i].name() === tagName) {
            sourceTag = allTags[i];
          }
          if (allTags[i].name() === targetTag) {
            targetTagObj = allTags[i];
          }
        }
        
        if (!sourceTag) {
          return JSON.stringify({
            error: true,
            message: "Source tag '" + tagName + "' not found"
          });
        }
        
        if (!targetTagObj) {
          return JSON.stringify({
            error: true,
            message: "Target tag '" + targetTag + "' not found"
          });
        }
        
        // Move all tasks from source to target
        let mergedCount = 0;
        const tasks = doc.flattenedTasks();
        
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          try {
            const taskTags = task.tags();
            let hasSourceTag = false;
            let hasTargetTag = false;
            
            for (let j = 0; j < taskTags.length; j++) {
              if (taskTags[j].id() === sourceTag.id()) {
                hasSourceTag = true;
              }
              if (taskTags[j].id() === targetTagObj.id()) {
                hasTargetTag = true;
              }
            }
            
            if (hasSourceTag) {
              // Remove source tag
              task.removeTags([sourceTag]);
              
              // Add target tag if not already present
              if (!hasTargetTag) {
                task.addTags([targetTagObj]);
              }
              
              mergedCount++;
            }
          } catch (e) {}
        }
        
        // Delete the source tag
        sourceTag.remove();
        
        return JSON.stringify({
          success: true,
          action: 'merged',
          sourceTag: tagName,
          targetTag: targetTag,
          tasksMerged: mergedCount,
          message: "Merged '" + tagName + "' into '" + targetTag + "'. " + mergedCount + " tasks updated."
        });
        
      default:
        return JSON.stringify({
          error: true,
          message: "Unknown action: " + action
        });
    }
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to manage tag: " + error.toString()
    });
  }
`;