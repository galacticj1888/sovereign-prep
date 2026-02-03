/**
 * Participant types
 * Represents enriched profiles of meeting attendees
 */

export type ParticipantRole =
  | 'champion'
  | 'blocker'
  | 'economic-buyer'
  | 'technical-evaluator'
  | 'decision-maker'
  | 'influencer'
  | 'unknown';

export type InfluenceLevel = 'high' | 'medium' | 'low';

export interface Interaction {
  id: string;
  date: Date;
  type: 'call' | 'email' | 'meeting' | 'slack';
  title: string;
  duration?: number; // in minutes
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyPoints?: string[];
}

export interface Participant {
  email: string;
  name: string;
  company: string;
  title: string;
  role: ParticipantRole;
  influence: InfluenceLevel;
  linkedInUrl?: string;
  background?: string;
  previousInteractions: Interaction[];
  communicationNotes?: string;
  whatTheyCareAbout?: string[];
  lastInteractionDate?: Date;
  totalInteractions?: number;
  photoUrl?: string;
}

export interface InternalParticipant {
  email: string;
  name: string;
  role: string; // e.g., "Deal owner", "Technical lead"
  lastTouchpoint?: Date;
  notes?: string;
}
