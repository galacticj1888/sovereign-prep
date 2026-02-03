/**
 * Competitive Intelligence Extractor
 *
 * Extracts competitive mentions from conversations, transcripts,
 * and Slack to build a competitive context for the meeting.
 */

import { logger } from '../utils/logger.js';
import type { MergedData } from './merger.js';
import type { TimelineEvent } from '../types/index.js';

// --- Types ---

export interface CompetitorMention {
  id: string;
  competitor: string;
  context: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  source: 'transcript' | 'slack' | 'calendar' | 'research';
  sourceId?: string;
  date?: Date;
  speaker?: string;
}

export interface CompetitiveIntel {
  competitors: CompetitorProfile[];
  mentions: CompetitorMention[];
  competitiveLandscape: string;
  keyDifferentiators: string[];
  risks: CompetitiveRisk[];
}

export interface CompetitorProfile {
  name: string;
  normalizedName: string;
  mentionCount: number;
  lastMentioned?: Date;
  sentimentSummary: {
    positive: number;
    negative: number;
    neutral: number;
  };
  keyThemes: string[];
}

export interface CompetitiveRisk {
  id: string;
  competitor: string;
  risk: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
  mitigationSuggestion?: string;
}

export interface CompetitiveIntelContext {
  mergedData: MergedData;
  accountName: string;
  accountDomain: string;
}

// --- Known Competitors Database ---

// Common competitors and their aliases
const KNOWN_COMPETITORS: Record<string, string[]> = {
  'Salesforce': ['salesforce', 'sfdc', 'sales cloud', 'service cloud'],
  'Microsoft': ['microsoft', 'msft', 'dynamics', 'azure', 'teams'],
  'Google': ['google', 'gcp', 'google cloud', 'workspace'],
  'AWS': ['aws', 'amazon web services', 'amazon'],
  'Snowflake': ['snowflake'],
  'Databricks': ['databricks'],
  'HubSpot': ['hubspot'],
  'Zendesk': ['zendesk'],
  'ServiceNow': ['servicenow', 'service now'],
  'Workday': ['workday'],
  'SAP': ['sap', 's/4hana'],
  'Oracle': ['oracle', 'oci'],
  'Slack': ['slack'],
  'Zoom': ['zoom'],
  'Datadog': ['datadog'],
  'Splunk': ['splunk'],
  'MongoDB': ['mongodb', 'mongo'],
  'Elastic': ['elastic', 'elasticsearch'],
  'Confluent': ['confluent', 'kafka'],
  'HashiCorp': ['hashicorp', 'terraform', 'vault'],
};

// Competitive signal phrases
const COMPETITIVE_SIGNALS = [
  'competitor',
  'alternative',
  'also looking at',
  'evaluating',
  'compared to',
  'vs',
  'versus',
  'instead of',
  'switch from',
  'migrate from',
  'replace',
  'benchmark',
  'competitive',
  'other vendors',
  'other options',
];

// --- Main Intelligence Extraction ---

/**
 * Extract competitive intelligence from all available data
 */
export function extractCompetitiveIntel(context: CompetitiveIntelContext): CompetitiveIntel {
  const log = logger.child('competitive-intel');
  const mentions: CompetitorMention[] = [];
  let mentionId = 1;

  // Extract from timeline events (transcripts and meetings)
  for (const event of context.mergedData.timeline) {
    const eventMentions = extractMentionsFromEvent(event, mentionId);
    for (const mention of eventMentions) {
      mentions.push(mention);
      mentionId++;
    }
  }

  // Build competitor profiles from mentions
  const profiles = buildCompetitorProfiles(mentions);

  // Identify competitive risks
  const risks = identifyCompetitiveRisks(profiles, mentions);

  // Generate landscape summary
  const landscape = generateLandscapeSummary(profiles, context.accountName);

  // Extract key differentiators based on context
  const differentiators = extractDifferentiators(mentions);

  log.info(
    `Extracted intel: ${profiles.length} competitors, ${mentions.length} mentions, ${risks.length} risks`
  );

  return {
    competitors: profiles,
    mentions,
    competitiveLandscape: landscape,
    keyDifferentiators: differentiators,
    risks,
  };
}

// --- Extraction Functions ---

/**
 * Extract competitor mentions from a timeline event
 */
function extractMentionsFromEvent(
  event: TimelineEvent,
  startId: number
): CompetitorMention[] {
  const mentions: CompetitorMention[] = [];
  let id = startId;

  // Combine searchable text
  const searchText = [
    event.title,
    event.description ?? '',
  ]
    .join(' ')
    .toLowerCase();

  // Check for known competitors
  for (const [competitor, aliases] of Object.entries(KNOWN_COMPETITORS)) {
    for (const alias of aliases) {
      if (searchText.includes(alias.toLowerCase())) {
        const sentiment = analyzeCompetitorSentiment(searchText, alias);

        mentions.push({
          id: `cm-${id++}`,
          competitor,
          context: extractMentionContext(searchText, alias),
          sentiment,
          source: event.type === 'call' ? 'transcript' : event.type === 'meeting' ? 'calendar' : 'slack',
          sourceId: event.id,
          date: event.date,
        });

        // Only count each competitor once per event
        break;
      }
    }
  }

  // Check for generic competitive signals even without known competitors
  const hasCompetitiveSignal = COMPETITIVE_SIGNALS.some(signal =>
    searchText.includes(signal.toLowerCase())
  );

  if (hasCompetitiveSignal && mentions.length === 0) {
    // Generic competitive mention without specific competitor
    mentions.push({
      id: `cm-${id++}`,
      competitor: 'Unknown Competitor',
      context: extractGenericCompetitiveContext(searchText),
      sentiment: 'neutral',
      source: event.type === 'call' ? 'transcript' : event.type === 'meeting' ? 'calendar' : 'slack',
      sourceId: event.id,
      date: event.date,
    });
  }

  return mentions;
}

/**
 * Analyze sentiment around competitor mention
 */
function analyzeCompetitorSentiment(
  text: string,
  competitorAlias: string
): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();
  const aliasIndex = lowerText.indexOf(competitorAlias.toLowerCase());

  if (aliasIndex === -1) return 'neutral';

  // Get context around mention (100 chars before and after)
  const contextStart = Math.max(0, aliasIndex - 100);
  const contextEnd = Math.min(text.length, aliasIndex + competitorAlias.length + 100);
  const context = lowerText.slice(contextStart, contextEnd);

  // Positive signals (competitor is preferred)
  const positiveForCompetitor = [
    'prefer',
    'like',
    'better',
    'love',
    'great experience',
    'already using',
    'happy with',
    'satisfied',
  ];

  // Negative signals (competitor has issues)
  const negativeForCompetitor = [
    'issue',
    'problem',
    'challenge',
    'frustrated',
    'expensive',
    'difficult',
    'complex',
    'migrate from',
    'switch from',
    'moving away',
    'replacing',
    'limitations',
  ];

  const hasPositive = positiveForCompetitor.some(signal => context.includes(signal));
  const hasNegative = negativeForCompetitor.some(signal => context.includes(signal));

  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';
  return 'neutral';
}

/**
 * Extract context around competitor mention
 */
function extractMentionContext(text: string, alias: string): string {
  const lowerText = text.toLowerCase();
  const aliasIndex = lowerText.indexOf(alias.toLowerCase());

  if (aliasIndex === -1) return '';

  // Extract ~150 chars of context around the mention
  const contextStart = Math.max(0, aliasIndex - 75);
  const contextEnd = Math.min(text.length, aliasIndex + alias.length + 75);
  let context = text.slice(contextStart, contextEnd);

  // Clean up partial words at boundaries
  if (contextStart > 0) {
    const firstSpace = context.indexOf(' ');
    if (firstSpace > 0 && firstSpace < 20) {
      context = '...' + context.slice(firstSpace + 1);
    }
  }

  if (contextEnd < text.length) {
    const lastSpace = context.lastIndexOf(' ');
    if (lastSpace > context.length - 20) {
      context = context.slice(0, lastSpace) + '...';
    }
  }

  return context;
}

/**
 * Extract generic competitive context
 */
function extractGenericCompetitiveContext(text: string): string {
  for (const signal of COMPETITIVE_SIGNALS) {
    const index = text.toLowerCase().indexOf(signal.toLowerCase());
    if (index !== -1) {
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + signal.length + 100);
      return text.slice(contextStart, contextEnd);
    }
  }
  return '';
}

// --- Profile Building ---

/**
 * Build competitor profiles from mentions
 */
function buildCompetitorProfiles(mentions: CompetitorMention[]): CompetitorProfile[] {
  const profileMap = new Map<string, CompetitorProfile>();

  for (const mention of mentions) {
    const normalizedName = mention.competitor.toLowerCase();
    const existing = profileMap.get(normalizedName);

    if (existing) {
      existing.mentionCount++;
      existing.sentimentSummary[mention.sentiment]++;
      if (mention.date && (!existing.lastMentioned || mention.date > existing.lastMentioned)) {
        existing.lastMentioned = mention.date;
      }
      // Add context as potential theme
      if (mention.context && !existing.keyThemes.includes(mention.context.slice(0, 50))) {
        existing.keyThemes.push(mention.context.slice(0, 50));
      }
    } else {
      profileMap.set(normalizedName, {
        name: mention.competitor,
        normalizedName,
        mentionCount: 1,
        lastMentioned: mention.date,
        sentimentSummary: {
          positive: mention.sentiment === 'positive' ? 1 : 0,
          negative: mention.sentiment === 'negative' ? 1 : 0,
          neutral: mention.sentiment === 'neutral' ? 1 : 0,
        },
        keyThemes: mention.context ? [mention.context.slice(0, 50)] : [],
      });
    }
  }

  // Sort by mention count
  const profiles = Array.from(profileMap.values());
  profiles.sort((a, b) => b.mentionCount - a.mentionCount);

  return profiles;
}

// --- Risk Identification ---

/**
 * Identify competitive risks from profiles and mentions
 */
function identifyCompetitiveRisks(
  profiles: CompetitorProfile[],
  mentions: CompetitorMention[]
): CompetitiveRisk[] {
  const risks: CompetitiveRisk[] = [];
  let riskId = 1;

  for (const profile of profiles) {
    // Skip unknown competitor
    if (profile.normalizedName === 'unknown competitor') continue;

    // High positive sentiment for competitor is a risk
    const positiveRatio =
      profile.sentimentSummary.positive / profile.mentionCount;
    if (positiveRatio > 0.5 && profile.mentionCount >= 2) {
      risks.push({
        id: `cr-${riskId++}`,
        competitor: profile.name,
        risk: `Customer has positive sentiment toward ${profile.name}`,
        severity: 'high',
        evidence: `${profile.sentimentSummary.positive} positive mentions out of ${profile.mentionCount} total`,
        mitigationSuggestion: `Understand what they value about ${profile.name} and address directly`,
      });
    }

    // Multiple recent mentions is a risk
    const recentMentions = mentions.filter(m => {
      if (m.competitor !== profile.name || !m.date) return false;
      const daysAgo = (Date.now() - m.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo < 30;
    });

    if (recentMentions.length >= 3) {
      risks.push({
        id: `cr-${riskId++}`,
        competitor: profile.name,
        risk: `Frequent recent mentions of ${profile.name}`,
        severity: 'medium',
        evidence: `${recentMentions.length} mentions in the last 30 days`,
        mitigationSuggestion: `Proactively address competitive comparison`,
      });
    }

    // Currently using competitor is highest risk
    const usingSignals = ['using', 'currently on', 'have', 'running'];
    const isCurrentlyUsing = mentions.some(
      m =>
        m.competitor === profile.name &&
        usingSignals.some(signal => m.context.toLowerCase().includes(signal))
    );

    if (isCurrentlyUsing) {
      risks.push({
        id: `cr-${riskId++}`,
        competitor: profile.name,
        risk: `Customer may be currently using ${profile.name}`,
        severity: 'high',
        evidence: 'Detected usage indicators in conversations',
        mitigationSuggestion: `Understand their current experience and pain points with ${profile.name}`,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  risks.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return risks;
}

// --- Summary Generation ---

/**
 * Generate competitive landscape summary
 */
function generateLandscapeSummary(profiles: CompetitorProfile[], accountName: string): string {
  if (profiles.length === 0) {
    return `No competitive mentions detected in ${accountName} conversations.`;
  }

  const topCompetitors = profiles.slice(0, 3);
  const competitorNames = topCompetitors.map(p => p.name).join(', ');

  if (topCompetitors.length === 1) {
    const comp = topCompetitors[0];
    if (!comp) return '';
    const sentiment = getPrimarySentiment(comp.sentimentSummary);
    return `${comp.name} has been mentioned ${comp.mentionCount} time(s). Overall sentiment: ${sentiment}.`;
  }

  return `Competitive landscape includes ${competitorNames}. ${topCompetitors[0]?.name} is most frequently mentioned (${topCompetitors[0]?.mentionCount} times).`;
}

/**
 * Get primary sentiment from summary
 */
function getPrimarySentiment(summary: { positive: number; negative: number; neutral: number }): string {
  const max = Math.max(summary.positive, summary.negative, summary.neutral);
  if (max === summary.positive) return 'positive (risk)';
  if (max === summary.negative) return 'negative (opportunity)';
  return 'neutral';
}

/**
 * Extract key differentiators based on competitive context
 */
function extractDifferentiators(mentions: CompetitorMention[]): string[] {
  const differentiators: string[] = [];

  // Look for mentions with negative competitor sentiment (our opportunity)
  const negativeMentions = mentions.filter(m => m.sentiment === 'negative');
  for (const mention of negativeMentions) {
    if (mention.context.includes('expensive') || mention.context.includes('cost')) {
      differentiators.push('Pricing/value advantage');
    }
    if (mention.context.includes('complex') || mention.context.includes('difficult')) {
      differentiators.push('Ease of use/simplicity');
    }
    if (mention.context.includes('support') || mention.context.includes('help')) {
      differentiators.push('Superior support');
    }
    if (mention.context.includes('integration') || mention.context.includes('connect')) {
      differentiators.push('Better integrations');
    }
  }

  // Deduplicate
  return [...new Set(differentiators)];
}

// --- Utility Functions ---

/**
 * Get competitors sorted by risk level
 */
export function getCompetitorsByRisk(intel: CompetitiveIntel): CompetitorProfile[] {
  const riskScores = new Map<string, number>();

  for (const risk of intel.risks) {
    const current = riskScores.get(risk.competitor) ?? 0;
    const severityScore = risk.severity === 'high' ? 3 : risk.severity === 'medium' ? 2 : 1;
    riskScores.set(risk.competitor, current + severityScore);
  }

  return intel.competitors.sort((a, b) => {
    const scoreA = riskScores.get(a.name) ?? 0;
    const scoreB = riskScores.get(b.name) ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Format competitive intel as text
 */
export function formatCompetitiveIntelAsText(intel: CompetitiveIntel): string {
  const sections: string[] = [];

  // Landscape
  sections.push(`**Competitive Landscape**\n${intel.competitiveLandscape}`);

  // Top competitors
  if (intel.competitors.length > 0) {
    const competitorLines = intel.competitors.slice(0, 5).map(c => {
      const sentiment = getPrimarySentiment(c.sentimentSummary);
      return `• ${c.name}: ${c.mentionCount} mention(s), sentiment: ${sentiment}`;
    });
    sections.push(`**Competitors Mentioned**\n${competitorLines.join('\n')}`);
  }

  // Risks
  if (intel.risks.length > 0) {
    const riskLines = intel.risks.slice(0, 3).map(r => `• [${r.severity}] ${r.risk}`);
    sections.push(`**Competitive Risks**\n${riskLines.join('\n')}`);
  }

  // Differentiators
  if (intel.keyDifferentiators.length > 0) {
    sections.push(`**Potential Differentiators**\n• ${intel.keyDifferentiators.join('\n• ')}`);
  }

  return sections.join('\n\n');
}
