/**
 * Intelligence module index
 * Re-exports all intelligence components
 */

// Data merger
export {
  type MergedData,
  type FirefliesData,
  type SlackData,
  type CalendarData,
  type MergeOptions,
  mergeAllData,
  markOverdueItems,
  getUniqueParticipantEmails,
  getExternalParticipantEmails,
} from './merger.js';

// Participant profiler
export {
  type ParticipantProfile,
  type ProfileEnrichmentOptions,
  enrichParticipant,
  profileParticipants,
  inferRole,
  inferInfluence,
  analyzeInterests,
  generateCommunicationNotes,
  identifyMissingStakeholders,
} from './participantProfiler.js';

// Account analyzer
export {
  type AccountAnalysis,
  type AnalysisOptions,
  analyzeAccount,
  applyAnalysisToAccount,
  analyzeTimeline,
} from './accountAnalyzer.js';

// Goal generator
export {
  type Goal,
  type GoalGenerationContext,
  generateGoals,
  formatGoalsAsText,
  getTopGoals,
} from './goalGenerator.js';

// Talking point generator
export {
  type TalkingPoint,
  type TalkingPointCategory,
  type TalkingPointContext,
  generateTalkingPoints,
  getTalkingPointsByCategory,
  getTopTalkingPoints,
  formatTalkingPointsAsText,
} from './talkingPointGenerator.js';

// Competitive intelligence
export {
  type CompetitorMention,
  type CompetitiveIntel,
  type CompetitorProfile,
  type CompetitiveRisk,
  type CompetitiveIntelContext,
  extractCompetitiveIntel,
  getCompetitorsByRisk,
  formatCompetitiveIntelAsText,
} from './competitiveIntel.js';

// Dossier assembler
export {
  type DataSources,
  type AssemblerContext,
  type AssemblerResult,
  assembleDossier,
  createQuickDossier,
  validateDossier,
} from './dossierAssembler.js';
