/**
 * Account types
 * Represents a customer/prospect account with deal and engagement data
 */

export type Momentum = 'accelerating' | 'stable' | 'stalling' | 'at-risk';

export type ActionItemStatus = 'pending' | 'completed' | 'overdue';

export type ActionItemOwner = 'ours' | 'theirs';

export interface Contact {
  id: string;
  email: string;
  name: string;
  title?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  type: 'call' | 'email' | 'meeting' | 'note' | 'stage-change' | 'action-item';
  title: string;
  description?: string;
  participants?: string[];
  duration?: number; // in minutes, for calls/meetings
  transcriptId?: string; // Link to Fireflies transcript
  outcome?: string;
}

export interface ActionItem {
  id: string;
  description: string;
  owner: ActionItemOwner;
  assignee?: string;
  dueDate?: Date;
  createdDate: Date;
  status: ActionItemStatus;
  source?: string; // e.g., "Jan 29 call"
  daysOverdue?: number;
}

export interface Risk {
  id: string;
  type: 'timeline' | 'stakeholder' | 'budget' | 'technical' | 'competitive' | 'other';
  severity: 'high' | 'medium' | 'low';
  description: string;
  detectedDate: Date;
  source?: string;
  mitigationSuggestion?: string;
}

export interface Account {
  id: string;
  name: string;
  domain: string;
  dealStage: string;
  dealValue: number;
  closeDate?: Date;
  daysInStage: number;
  lastContactDate: Date;
  momentum: Momentum;
  contacts: Contact[];
  timeline: TimelineEvent[];
  openActionItems: ActionItem[];
  risks: Risk[];
  notes?: string;
  industry?: string;
  employeeCount?: number;
  headquarters?: string;
}
