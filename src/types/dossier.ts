/**
 * Dossier types
 * Represents the final meeting prep dossier output
 */

import type { Meeting } from './meeting.js';
import type { Account } from './account.js';
import type { Participant, InternalParticipant } from './participant.js';

export interface ExecutiveSummary {
  whyThisMeetingMatters: string;
  topGoals: string[];
  redFlags: string[];
}

export interface StrategicInsights {
  whatsWorking: string[];
  needsAttention: string[];
  questionsToAsk: string[];
  thingsToAvoid: string[];
}

export interface CompetitiveIntel {
  competitorsDetected: string[];
  competitorMentions?: string[];
  watchList: string[];
  notes?: string;
}

export interface DossierMetadata {
  generatedAt: Date;
  generatedBy: string;
  dataSourcesUsed: string[];
  dataSourcesFailed?: string[];
  processingTimeMs?: number;
  version: string;
}

export interface Dossier {
  // Meeting info
  meeting: Meeting;

  // Account context
  account: Account;

  // People
  externalParticipants: Participant[];
  internalParticipants: InternalParticipant[];
  missingStakeholders?: string[];

  // Insights
  executiveSummary: ExecutiveSummary;
  strategicInsights: StrategicInsights;
  talkingPoints: string[];

  // Optional sections
  competitiveIntel?: CompetitiveIntel;

  // Metadata
  metadata: DossierMetadata;
}

export interface DossierGenerationOptions {
  accountName?: string;
  meetingId?: string;
  includeTranscripts?: boolean;
  includeSlackMentions?: boolean;
  daysOfHistory?: number;
  outputFormat?: 'json' | 'html' | 'pdf';
}
