/**
 * Type definitions index
 * Re-exports all types for convenient imports
 */

// Meeting types
export type {
  ResponseStatus,
  Attendee,
  Meeting,
  MeetingFilter,
} from './meeting.js';

// Account types
export type {
  Momentum,
  ActionItemStatus,
  ActionItemOwner,
  Contact,
  TimelineEvent,
  ActionItem,
  Risk,
  Account,
} from './account.js';

// Participant types
export type {
  ParticipantRole,
  InfluenceLevel,
  Interaction,
  Participant,
  InternalParticipant,
} from './participant.js';

// Dossier types
export type {
  ExecutiveSummary,
  StrategicInsights,
  CompetitiveIntel,
  DossierMetadata,
  Dossier,
  DossierGenerationOptions,
} from './dossier.js';
