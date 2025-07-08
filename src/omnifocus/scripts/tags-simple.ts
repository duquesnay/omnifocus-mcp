// Simplified tags script to avoid array conversion issues

export const LIST_TAGS_SIMPLE = `
  const options = {{options}};
  
  try {
    const app = Application('OmniFocus');
    const doc = app.defaultDocument;
    const tags = [];
    
    // Get all tags without using complex queries
    const allTags = doc.flattenedTags();
    
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      
      // Get basic tag info
      const tagInfo = {
        id: tag.id(),
        name: tag.name(),
        taskCount: 0,
        availableCount: 0
      };
      
      // Count tasks manually to avoid array issues
      try {
        const allTasks = doc.flattenedTasks();
        let totalCount = 0;
        let availableCount = 0;
        
        for (let j = 0; j < allTasks.length; j++) {
          const task = allTasks[j];
          
          // Check if task has this tag
          let hasTag = false;
          try {
            const taskTags = task.tags();
            for (let k = 0; k < taskTags.length; k++) {
              if (taskTags[k].id() === tagInfo.id) {
                hasTag = true;
                break;
              }
            }
          } catch (e) {
            // Task might not have tags
          }
          
          if (hasTag) {
            totalCount++;
            if (!task.completed() && !task.dropped()) {
              availableCount++;
            }
          }
        }
        
        tagInfo.taskCount = totalCount;
        tagInfo.availableCount = availableCount;
      } catch (e) {
        // If counting fails, leave as 0
      }
      
      // Apply filter
      if (!options.includeEmpty && tagInfo.taskCount === 0) {
        continue;
      }
      
      tags.push(tagInfo);
    }
    
    // Sort tags
    if (options.sortBy === 'usage' || options.sortBy === 'tasks') {
      tags.sort((a, b) => b.taskCount - a.taskCount);
    } else {
      tags.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return JSON.stringify({
      tags: tags,
      count: tags.length,
      from_cache: false
    });
    
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to list tags: " + error.toString()
    });
  }
`;

export const CREATE_TAG_SIMPLE = `
  const tagName = {{tagName}};
  
  try {
    const app = Application('OmniFocus');
    const doc = app.defaultDocument;
    
    // Check if tag already exists
    const existingTags = doc.flattenedTags();
    for (let i = 0; i < existingTags.length; i++) {
      if (existingTags[i].name() === tagName) {
        return JSON.stringify({
          error: true,
          message: "Tag already exists: " + tagName
        });
      }
    }
    
    // Create new tag
    const newTag = app.Tag({name: tagName});
    doc.tags.push(newTag);
    
    return JSON.stringify({
      success: true,
      tag: {
        name: tagName,
        id: newTag.id()
      }
    });
    
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: "Failed to create tag: " + error.toString()
    });
  }
`;