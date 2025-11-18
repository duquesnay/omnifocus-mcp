export interface OmniFocusTask {
  id: string;
  name: string;
  note?: string;
  project?: string;
  projectId?: string;
  dueDate?: Date;
  deferDate?: Date;
  completionDate?: Date;
  flagged: boolean;
  tags: string[];
  estimatedMinutes?: number;
  completed: boolean;
  dropped: boolean;
  effectivelyCompleted: boolean;
  blocked: boolean;
  sequential: boolean;
  inInbox: boolean;
  repetitionRule?: RepetitionRule;
}

export interface OmniFocusProject {
  id: string;
  name: string;
  note?: string;
  status: 'active' | 'onHold' | 'dropped' | 'completed';
  deferDate?: Date;
  dueDate?: Date;
  completionDate?: Date;
  flagged: boolean;
  sequential: boolean;
  containsSingletonActions: boolean;
  lastReviewDate?: Date;
  reviewInterval?: number; // in days
  folder?: string;
  numberOfTasks?: number; // Optional - only included when includeTaskCount is true
  numberOfAvailableTasks?: number;
  numberOfCompletedTasks?: number;
}

export interface OmniFocusTag {
  id: string;
  name: string;
  note?: string;
  allowsNextAction: boolean;
  parent?: string;
  children: string[];
}

export interface RepetitionRule {
  method: 'fixed' | 'startAfterCompletion' | 'dueAfterCompletion';
  interval: string; // e.g., "1 week", "2 days"
}

export interface TaskFilter {
  completed?: boolean;
  flagged?: boolean;
  projectId?: string;
  tags?: string[];
  dueBefore?: Date;
  dueAfter?: Date;
  deferBefore?: Date;
  deferAfter?: Date;
  search?: string;
  inInbox?: boolean;
  available?: boolean;
}

export interface ProjectFilter {
  status?: ('active' | 'onHold' | 'dropped' | 'completed')[];
  flagged?: boolean;
  folder?: string;
  reviewBefore?: Date;
  search?: string;
  includeTaskCount?: boolean; // Default: false. Warning: Expensive on large databases
}

export interface TaskUpdate {
  name?: string;
  note?: string;
  flagged?: boolean;
  dueDate?: Date | null;
  deferDate?: Date | null;
  estimatedMinutes?: number | null;
  tags?: string[];
  projectId?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  note?: string;
  status?: 'active' | 'onHold' | 'dropped' | 'completed';
  flagged?: boolean;
  dueDate?: Date | null;
  deferDate?: Date | null;
  sequential?: boolean;
  reviewInterval?: number;
}

export interface ProductivityStats {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  tasksCompleted: number;
  tasksCreated: number;
  tasksOverdue: number;
  averageCompletionTime?: number; // in minutes
  completionRate: number; // percentage
  topTags: Array<{ tag: string; count: number }>;
  topProjects: Array<{ project: string; count: number }>;
  estimateAccuracy?: number; // percentage
}