/**
 * Dossier Assembler
 *
 * Main orchestrator that combines all data sources and intelligence
 * modules to produce a complete meeting prep dossier.
 */

import { logger } from '../utils/logger.js';
import { mergeAllData } from './merger.js';
import type { MergedData, FirefliesData, SlackData, CalendarData } from './merger.js';
import { analyzeAccount, applyAnalysisToAccount } from './accountAnalyzer.js';
import type { AccountAnalysis } from './accountAnalyzer.js';
import { profileParticipants, identifyMissingStakeholders } from './participantProfiler.js';
import type { ParticipantProfile } from './participantProfiler.js';
import { generateGoals } from './goalGenerator.js';
import type { Goal } from './goalGenerator.js';
import { generateTalkingPoints, getTalkingPointsByCategory } from './talkingPointGenerator.js';
import type { TalkingPoint } from './talkingPointGenerator.js';
import { extractCompetitiveIntel } from './competitiveIntel.js';
import type { CompetitiveIntel as ExtractedCompetitiveIntel } from './competitiveIntel.js';
import type {
  Dossier,
  DossierGenerationOptions,
  DossierMetadata,
  ExecutiveSummary,
  StrategicInsights,
  CompetitiveIntel as DossierCompetitiveIntel,
} from '../types/dossier.js';
import type { Meeting, Attendee } from '../types/meeting.js';
import type { Account } from '../types/account.js';
import type { Participant, InternalParticipant } from '../types/participant.js';
import type { PersonInfo } from '../sources/exa.js';

// ============================================================================
// Types
// ============================================================================

export interface DataSources {
  fireflies: FirefliesData;
  slack: SlackData;
  calendar: CalendarData;
  personInfo?: Map<string, PersonInfo>;
  companyInfo?: {
    name: string;
    domain: string;
    description?: string;
    industry?: string;
    employeeCount?: number;
    headquarters?: string;
    recentNews?: Array<{ title: string; summary?: string }>;
  };
}

export interface AssemblerContext {
  meeting: Meeting;
  accountName: string;
  accountDomain: string;
  options: DossierGenerationOptions;
}

export interface AssemblerResult {
  dossier: Dossier;
  intermediate: {
    mergedData: MergedData;
    analysis: AccountAnalysis;
    profiles: Map<string, ParticipantProfile>;
    goals: Goal[];
    talkingPoints: TalkingPoint[];
    competitiveIntel: ExtractedCompetitiveIntel;
  };
}

// ============================================================================
// Main Assembler
// ============================================================================

/**
 * Assemble a complete meeting prep dossier
 */
export function assembleDossier(
  context: AssemblerContext,
  sources: DataSources
): AssemblerResult {
  const log = logger.child('assembler');
  const startTime = Date.now();

  log.info(`Assembling dossier for: ${context.meeting.title}`);

  // Track data sources used
  const sourcesUsed: string[] = [];
  const sourcesFailed: string[] = [];

  if (sources.fireflies.transcripts.length > 0) sourcesUsed.push('Fireflies');
  if (sources.slack.messages.length > 0 || sources.slack.mentions.length > 0) sourcesUsed.push('Slack');
  if (sources.calendar.events.length > 0) sourcesUsed.push('Calendar');
  if (sources.personInfo && sources.personInfo.size > 0) sourcesUsed.push('Exa (People)');
  if (sources.companyInfo) sourcesUsed.push('Exa (Company)');

  // 1. Merge all data sources
  log.debug('Merging data sources...');
  const mergedData = mergeAllData(sources.fireflies, sources.slack, sources.calendar, {
    accountName: context.accountName,
    accountDomain: context.accountDomain,
    daysOfHistory: context.options.daysOfHistory ?? 30,
  });

  // 2. Analyze account
  log.debug('Analyzing account...');
  const analysis = analyzeAccount(mergedData);

  // 3. Profile participants
  log.debug('Profiling participants...');
  const profiles = profileParticipants(mergedData.participants, sources.personInfo);

  // 4. Generate goals
  log.debug('Generating goals...');
  const goalContext = {
    account: mergedData.account,
    analysis,
    participants: profiles,
    mergedData,
    meetingTitle: context.meeting.title,
  };
  const goals = generateGoals(goalContext);

  // 5. Generate talking points
  log.debug('Generating talking points...');
  const talkingPointContext = {
    ...goalContext,
    goals,
  };
  const talkingPoints = generateTalkingPoints(talkingPointContext);

  // 6. Extract competitive intelligence
  log.debug('Extracting competitive intelligence...');
  const competitiveIntel = extractCompetitiveIntel({
    mergedData,
    accountName: context.accountName,
    accountDomain: context.accountDomain,
  });

  // 7. Build the account object
  const account = buildAccount(mergedData, analysis, sources.companyInfo);

  // 8. Build participant lists
  const { external, internal, missing } = buildParticipantLists(
    context.meeting.attendees,
    profiles
  );

  // 9. Build executive summary
  const executiveSummary = buildExecutiveSummary(
    context.meeting,
    account,
    goals,
    analysis
  );

  // 10. Build strategic insights
  const strategicInsights = buildStrategicInsights(
    analysis,
    talkingPoints,
    profiles
  );

  // 11. Build competitive intel section
  const competitiveSection = buildCompetitiveSection(competitiveIntel);

  // 12. Build metadata
  const metadata: DossierMetadata = {
    generatedAt: new Date(),
    generatedBy: 'Sovereign Prep v0.1.0',
    dataSourcesUsed: sourcesUsed,
    dataSourcesFailed: sourcesFailed.length > 0 ? sourcesFailed : undefined,
    processingTimeMs: Date.now() - startTime,
    version: '1.0',
  };

  // 13. Assemble final dossier
  const dossier: Dossier = {
    meeting: context.meeting,
    account,
    externalParticipants: external,
    internalParticipants: internal,
    missingStakeholders: missing.length > 0 ? missing : undefined,
    executiveSummary,
    strategicInsights,
    talkingPoints: formatTalkingPointsForDossier(talkingPoints),
    competitiveIntel: competitiveSection,
    metadata,
  };

  log.info(`Dossier assembled in ${metadata.processingTimeMs}ms`);

  return {
    dossier,
    intermediate: {
      mergedData,
      analysis,
      profiles,
      goals,
      talkingPoints,
      competitiveIntel,
    },
  };
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Build the Account object from merged data and analysis
 */
function buildAccount(
  mergedData: MergedData,
  analysis: AccountAnalysis,
  companyInfo?: DataSources['companyInfo']
): Account {
  const baseAccount = applyAnalysisToAccount(
    {
      id: mergedData.account.domain ?? 'unknown',
      name: mergedData.account.name ?? '',
      domain: mergedData.account.domain ?? '',
      dealStage: mergedData.account.dealStage ?? 'unknown',
      dealValue: mergedData.account.dealValue ?? 0,
      closeDate: mergedData.account.closeDate,
      daysInStage: 0,
      lastContactDate: mergedData.account.lastContactDate ?? new Date(),
      momentum: 'stable',
      contacts: mergedData.account.contacts ?? [],
      timeline: mergedData.account.timeline ?? [],
      openActionItems: mergedData.account.openActionItems ?? [],
      risks: [],
    },
    analysis
  );

  // Enrich with company info if available
  if (companyInfo) {
    baseAccount.industry = companyInfo.industry;
    baseAccount.employeeCount = companyInfo.employeeCount;
    baseAccount.headquarters = companyInfo.headquarters;
    if (companyInfo.description) {
      baseAccount.notes = companyInfo.description;
    }
  }

  return baseAccount;
}

/**
 * Build participant lists from meeting attendees and profiles
 */
function buildParticipantLists(
  attendees: Attendee[],
  profiles: Map<string, ParticipantProfile>
): {
  external: Participant[];
  internal: InternalParticipant[];
  missing: string[];
} {
  const external: Participant[] = [];
  const internal: InternalParticipant[] = [];

  for (const attendee of attendees) {
    const profile = profiles.get(attendee.email);
    const isInternal = isInternalEmail(attendee.email);

    if (isInternal) {
      internal.push({
        email: attendee.email,
        name: attendee.name ?? profile?.name ?? '',
        role: 'ae', // Default, could be inferred
      });
    } else {
      external.push({
        email: attendee.email,
        name: attendee.name ?? profile?.name ?? '',
        company: profile?.company ?? '',
        title: profile?.title ?? '',
        role: profile?.role ?? 'unknown',
        influence: profile?.influence ?? 'medium',
        linkedInUrl: profile?.linkedInUrl,
        background: profile?.background,
        previousInteractions: profile?.previousInteractions ?? [],
        communicationNotes: profile?.communicationNotes,
        whatTheyCareAbout: profile?.whatTheyCareAbout,
        lastInteractionDate: profile?.lastInteractionDate,
        totalInteractions: profile?.totalInteractions,
      });
    }
  }

  // Identify missing stakeholders
  const missing = identifyMissingStakeholders(profiles);

  return { external, internal, missing };
}

/**
 * Build executive summary
 */
function buildExecutiveSummary(
  meeting: Meeting,
  account: Account,
  goals: Goal[],
  analysis: AccountAnalysis
): ExecutiveSummary {
  // Why this meeting matters
  const whyItMatters = generateWhyThisMeetingMatters(meeting, account, analysis);

  // Top goals (priority 1 and 2)
  const topGoals = goals
    .filter(g => g.priority <= 2)
    .slice(0, 3)
    .map(g => g.title);

  // Red flags (high severity risks)
  const redFlags = analysis.risks
    .filter(r => r.severity === 'high')
    .slice(0, 3)
    .map(r => r.description);

  return {
    whyThisMeetingMatters: whyItMatters,
    topGoals,
    redFlags,
  };
}

/**
 * Generate the "why this meeting matters" summary
 */
function generateWhyThisMeetingMatters(
  _meeting: Meeting,
  account: Account,
  analysis: AccountAnalysis
): string {
  const parts: string[] = [];

  // Deal stage context
  const stage = account.dealStage?.toLowerCase() ?? '';
  if (stage.includes('poc') || stage.includes('pilot')) {
    parts.push(`${account.name} is in active evaluation.`);
  } else if (stage.includes('negotiation') || stage.includes('contract')) {
    parts.push(`${account.name} is in late-stage negotiations.`);
  } else if (stage.includes('discovery') || stage.includes('qualification')) {
    parts.push(`${account.name} is in early discovery phase.`);
  }

  // Momentum context
  if (analysis.momentum === 'at-risk') {
    parts.push('This deal is at risk and needs attention.');
  } else if (analysis.momentum === 'accelerating') {
    parts.push('Momentum is strong - maintain engagement.');
  } else if (analysis.momentum === 'stalling') {
    parts.push('Engagement has slowed - use this meeting to re-energize.');
  }

  // Value context
  if (account.dealValue > 0) {
    const valueStr = formatDealValue(account.dealValue);
    parts.push(`Deal value: ${valueStr}.`);
  }

  // Days since contact
  if (analysis.daysSinceLastContact > 14) {
    parts.push(`${analysis.daysSinceLastContact} days since last contact.`);
  }

  return parts.join(' ') || `Meeting with ${account.name} - stay aligned and drive next steps.`;
}

/**
 * Build strategic insights
 */
function buildStrategicInsights(
  analysis: AccountAnalysis,
  talkingPoints: TalkingPoint[],
  profiles: Map<string, ParticipantProfile>
): StrategicInsights {
  // What's working
  const whatsWorking: string[] = [];
  if (analysis.momentum === 'accelerating') {
    whatsWorking.push('Strong engagement momentum');
  }
  if (analysis.daysSinceLastContact < 7) {
    whatsWorking.push('Recent touchpoints maintaining relationship');
  }
  const champions = Array.from(profiles.values()).filter(p => p.role === 'champion');
  if (champions.length > 0) {
    whatsWorking.push(`Active champion: ${champions[0]?.name ?? champions[0]?.email}`);
  }

  // Needs attention
  const needsAttention: string[] = [];
  for (const risk of analysis.risks.slice(0, 3)) {
    needsAttention.push(risk.description);
  }

  // Questions to ask
  const questionsToAsk: string[] = [];
  const goalSupport = getTalkingPointsByCategory(talkingPoints, 'goal-support');
  for (const point of goalSupport.slice(0, 3)) {
    if (point.suggestedPhrasing?.includes('?')) {
      questionsToAsk.push(point.suggestedPhrasing.replace(/"/g, ''));
    }
  }
  // Add default questions if none extracted
  if (questionsToAsk.length === 0) {
    questionsToAsk.push('What would success look like for you?');
    questionsToAsk.push('Are there any concerns we should address?');
  }

  // Things to avoid
  const thingsToAvoid: string[] = [];
  const blockers = Array.from(profiles.values()).filter(p => p.role === 'blocker');
  if (blockers.length > 0) {
    thingsToAvoid.push(`Don't ignore ${blockers[0]?.name ?? 'skeptical stakeholder'}'s concerns`);
  }
  if (analysis.momentum === 'at-risk') {
    thingsToAvoid.push('Avoid being pushy - focus on understanding their situation');
  }

  return {
    whatsWorking,
    needsAttention,
    questionsToAsk,
    thingsToAvoid,
  };
}

/**
 * Build competitive intel section for dossier
 */
function buildCompetitiveSection(
  intel: ExtractedCompetitiveIntel
): DossierCompetitiveIntel | undefined {
  if (intel.competitors.length === 0 && intel.mentions.length === 0) {
    return undefined;
  }

  const competitorsDetected = intel.competitors
    .filter(c => c.normalizedName !== 'unknown competitor')
    .slice(0, 5)
    .map(c => c.name);

  const competitorMentions = intel.mentions
    .slice(0, 5)
    .map(m => `${m.competitor}: ${m.context.slice(0, 100)}...`);

  const watchList = intel.risks.map(r => `${r.competitor}: ${r.risk}`);

  return {
    competitorsDetected,
    competitorMentions: competitorMentions.length > 0 ? competitorMentions : undefined,
    watchList,
    notes: intel.competitiveLandscape,
  };
}

/**
 * Format talking points for dossier (as string array)
 */
function formatTalkingPointsForDossier(points: TalkingPoint[]): string[] {
  // Group by priority, take top points
  const top = points
    .filter(p => p.priority <= 2)
    .slice(0, 7);

  return top.map(p => {
    if (p.suggestedPhrasing) {
      return `${p.point}\n→ ${p.suggestedPhrasing}`;
    }
    return p.point;
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if email is internal (our domain)
 */
function isInternalEmail(email: string): boolean {
  const internalDomains = ['runlayer.com', 'anthropic.com'];
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return internalDomains.some(d => domain === d);
}

/**
 * Format deal value as currency string
 */
function formatDealValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Create a minimal dossier for quick prep
 */
export function createQuickDossier(
  meeting: Meeting,
  accountName: string,
  accountDomain: string
): Dossier {
  const now = new Date();

  return {
    meeting,
    account: {
      id: accountDomain,
      name: accountName,
      domain: accountDomain,
      dealStage: 'unknown',
      dealValue: 0,
      daysInStage: 0,
      lastContactDate: now,
      momentum: 'stable',
      contacts: [],
      timeline: [],
      openActionItems: [],
      risks: [],
    },
    externalParticipants: meeting.attendees
      .filter(a => !isInternalEmail(a.email))
      .map(a => ({
        email: a.email,
        name: a.name ?? '',
        company: accountName,
        title: '',
        role: 'unknown' as const,
        influence: 'medium' as const,
        previousInteractions: [],
      })),
    internalParticipants: meeting.attendees
      .filter(a => isInternalEmail(a.email))
      .map(a => ({
        email: a.email,
        name: a.name ?? '',
        role: 'ae' as const,
      })),
    executiveSummary: {
      whyThisMeetingMatters: `Meeting with ${accountName}`,
      topGoals: ['Understand their current status', 'Identify next steps'],
      redFlags: [],
    },
    strategicInsights: {
      whatsWorking: [],
      needsAttention: ['Limited data available - gather context during meeting'],
      questionsToAsk: [
        'What are your current priorities?',
        'How can we help you succeed?',
      ],
      thingsToAvoid: [],
    },
    talkingPoints: [
      'Introduce yourself and your role',
      'Understand their current challenges',
      'Propose specific next steps',
    ],
    metadata: {
      generatedAt: now,
      generatedBy: 'Sovereign Prep v0.1.0 (Quick Mode)',
      dataSourcesUsed: [],
      version: '1.0',
    },
  };
}

/**
 * Validate a dossier has minimum required content
 */
export function validateDossier(dossier: Dossier): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!dossier.meeting.title) {
    issues.push('Missing meeting title');
  }

  if (!dossier.account.name) {
    issues.push('Missing account name');
  }

  if (dossier.externalParticipants.length === 0) {
    issues.push('No external participants identified');
  }

  if (dossier.executiveSummary.topGoals.length === 0) {
    issues.push('No goals generated');
  }

  if (dossier.talkingPoints.length === 0) {
    issues.push('No talking points generated');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
