/**
 * Talking Point Generator
 *
 * Generates contextual talking points based on meeting goals,
 * participant profiles, deal stage, and account analysis.
 */

import { logger } from '../utils/logger.js';
import type { Goal } from './goalGenerator.js';
import type { AccountAnalysis } from './accountAnalyzer.js';
import type { ParticipantProfile } from './participantProfiler.js';
import type { MergedData } from './merger.js';
import type { Account } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface TalkingPoint {
  id: string;
  category: TalkingPointCategory;
  point: string;
  context?: string;
  suggestedPhrasing?: string;
  relatedGoalId?: string;
  relatedParticipant?: string;
  priority: 1 | 2 | 3;
}

export type TalkingPointCategory =
  | 'opener'
  | 'goal-support'
  | 'risk-mitigation'
  | 'stakeholder-specific'
  | 'action-follow-up'
  | 'value-proposition'
  | 'next-steps';

export interface TalkingPointContext {
  account: Partial<Account>;
  analysis: AccountAnalysis;
  participants: Map<string, ParticipantProfile>;
  mergedData: MergedData;
  goals: Goal[];
  meetingTitle?: string;
}

// ============================================================================
// Main Talking Point Generation
// ============================================================================

/**
 * Generate talking points for a meeting
 */
export function generateTalkingPoints(context: TalkingPointContext): TalkingPoint[] {
  const log = logger.child('talking-points');
  const points: TalkingPoint[] = [];
  let nextId = 1;

  // 1. Opening talking points
  const openers = generateOpeners(context);
  for (const point of openers) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 2. Goal-supporting points
  const goalPoints = generateGoalSupportPoints(context);
  for (const point of goalPoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 3. Risk mitigation points
  const riskPoints = generateRiskMitigationPoints(context);
  for (const point of riskPoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 4. Stakeholder-specific points
  const stakeholderPoints = generateStakeholderPoints(context);
  for (const point of stakeholderPoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 5. Action item follow-ups
  const actionPoints = generateActionFollowUpPoints(context);
  for (const point of actionPoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 6. Value proposition reinforcement
  const valuePoints = generateValuePoints(context);
  for (const point of valuePoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // 7. Next steps points
  const nextStepsPoints = generateNextStepsPoints(context);
  for (const point of nextStepsPoints) {
    points.push({ ...point, id: `tp-${nextId++}` });
  }

  // Sort by priority and deduplicate
  const sorted = points.sort((a, b) => a.priority - b.priority);

  log.info(`Generated ${sorted.length} talking points`);
  return sorted;
}

// ============================================================================
// Category-Specific Generators
// ============================================================================

/**
 * Generate opening talking points
 */
function generateOpeners(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const { analysis, mergedData, account } = context;

  // Reference last interaction
  if (analysis.daysSinceLastContact < 14 && mergedData.timeline.length > 0) {
    const lastEvent = mergedData.timeline[mergedData.timeline.length - 1];
    if (lastEvent) {
      points.push({
        category: 'opener',
        point: `Reference last interaction: ${lastEvent.title}`,
        context: `Last touchpoint was ${analysis.daysSinceLastContact} days ago`,
        suggestedPhrasing: `"Great to reconnect - I wanted to follow up on our ${lastEvent.type === 'call' ? 'conversation' : 'meeting'} from ${formatDaysAgo(analysis.daysSinceLastContact)}..."`,
        priority: 1,
      });
    }
  }

  // Momentum-based opener
  if (analysis.momentum === 'accelerating') {
    points.push({
      category: 'opener',
      point: 'Acknowledge positive momentum',
      context: 'Account shows accelerating engagement',
      suggestedPhrasing: '"The team has been making great progress together..."',
      priority: 2,
    });
  } else if (analysis.momentum === 'stalling' || analysis.momentum === 'at-risk') {
    points.push({
      category: 'opener',
      point: 'Re-establish engagement',
      context: `Account momentum is ${analysis.momentum}`,
      suggestedPhrasing: '"I wanted to reconnect and make sure we\'re aligned on priorities..."',
      priority: 1,
    });
  }

  // Stage-specific opener
  const stage = account.dealStage?.toLowerCase() ?? '';
  if (stage.includes('poc') || stage.includes('pilot')) {
    points.push({
      category: 'opener',
      point: 'POC progress check',
      suggestedPhrasing: '"I\'m eager to hear how the evaluation is going from your perspective..."',
      priority: 2,
    });
  }

  return points;
}

/**
 * Generate points that support meeting goals
 */
function generateGoalSupportPoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];

  for (const goal of context.goals.slice(0, 3)) {
    // Priority 1 goals get direct support points
    if (goal.priority === 1) {
      points.push({
        category: 'goal-support',
        point: goal.title,
        context: goal.rationale,
        suggestedPhrasing: goal.suggestedApproach
          ? `Approach: ${goal.suggestedApproach}`
          : undefined,
        relatedGoalId: goal.id,
        priority: 1,
      });
    }

    // Add approach-based talking points
    if (goal.suggestedApproach) {
      points.push({
        category: 'goal-support',
        point: `Support: ${goal.title}`,
        context: goal.suggestedApproach,
        relatedGoalId: goal.id,
        priority: goal.priority <= 2 ? 2 : 3,
      });
    }
  }

  return points;
}

/**
 * Generate risk mitigation talking points
 */
function generateRiskMitigationPoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const { analysis } = context;

  for (const risk of analysis.risks) {
    if (risk.severity === 'high') {
      points.push({
        category: 'risk-mitigation',
        point: `Address risk: ${risk.description}`,
        context: risk.mitigationSuggestion,
        suggestedPhrasing: getRiskPhrasing(risk.id),
        priority: 1,
      });
    } else if (risk.severity === 'medium') {
      points.push({
        category: 'risk-mitigation',
        point: `Probe: ${risk.description}`,
        context: risk.mitigationSuggestion,
        priority: 2,
      });
    }
  }

  return points;
}

/**
 * Generate stakeholder-specific talking points
 */
function generateStakeholderPoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const profiles = Array.from(context.participants.values());

  for (const profile of profiles) {
    // Champion - reinforce partnership
    if (profile.role === 'champion') {
      points.push({
        category: 'stakeholder-specific',
        point: `Strengthen champion relationship with ${profile.name || profile.email}`,
        context: 'Champions need to feel supported and equipped',
        suggestedPhrasing: '"What would be most helpful for your internal discussions?"',
        relatedParticipant: profile.email,
        priority: 2,
      });
    }

    // Blocker - address concerns
    if (profile.role === 'blocker') {
      points.push({
        category: 'stakeholder-specific',
        point: `Address ${profile.name || profile.email}'s concerns directly`,
        context: 'Potential blocker identified - proactively engage',
        suggestedPhrasing: '"I want to make sure we address any concerns you might have..."',
        relatedParticipant: profile.email,
        priority: 1,
      });
    }

    // Economic buyer - focus on business value
    if (profile.role === 'economic-buyer') {
      points.push({
        category: 'stakeholder-specific',
        point: `Emphasize ROI and business impact for ${profile.name || profile.email}`,
        context: 'Economic buyer focuses on value and risk',
        suggestedPhrasing: '"From a business perspective, here\'s the impact we\'re seeing..."',
        relatedParticipant: profile.email,
        priority: 1,
      });
    }

    // Technical evaluator - detail and proof
    if (profile.role === 'technical-evaluator') {
      points.push({
        category: 'stakeholder-specific',
        point: `Provide technical depth for ${profile.name || profile.email}`,
        context: 'Technical evaluators need specifics',
        suggestedPhrasing: '"Happy to dive deeper into the architecture if helpful..."',
        relatedParticipant: profile.email,
        priority: 2,
      });
    }

    // If we know what they care about
    if (profile.whatTheyCareAbout && profile.whatTheyCareAbout.length > 0) {
      const concerns = profile.whatTheyCareAbout.slice(0, 2).join(' and ');
      points.push({
        category: 'stakeholder-specific',
        point: `Address ${profile.name || 'participant'}'s priorities: ${concerns}`,
        relatedParticipant: profile.email,
        priority: 2,
      });
    }
  }

  return points;
}

/**
 * Generate action item follow-up points
 */
function generateActionFollowUpPoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const { mergedData } = context;

  const openItems = mergedData.actionItems.filter(
    i => i.status === 'pending' || i.status === 'overdue'
  );

  // Overdue items from customer
  const overdueTheirs = openItems.filter(i => i.owner === 'theirs' && i.status === 'overdue');
  if (overdueTheirs.length > 0) {
    const item = overdueTheirs[0];
    if (item) {
      points.push({
        category: 'action-follow-up',
        point: `Follow up on: ${item.description}`,
        context: `This item is overdue by ${item.daysOverdue ?? 'several'} days`,
        suggestedPhrasing: '"I wanted to check in on [item] - is there anything blocking progress that we can help with?"',
        priority: 1,
      });
    }
  }

  // Our overdue items - acknowledge and set expectations
  const overdueOurs = openItems.filter(i => i.owner === 'ours' && i.status === 'overdue');
  if (overdueOurs.length > 0) {
    const item = overdueOurs[0];
    if (item) {
      points.push({
        category: 'action-follow-up',
        point: `Acknowledge our overdue item: ${item.description}`,
        context: 'Maintain credibility by addressing our delays',
        suggestedPhrasing: '"I want to acknowledge we\'re behind on [item] - here\'s our updated plan..."',
        priority: 1,
      });
    }
  }

  // Pending items worth mentioning
  const pendingTheirs = openItems.filter(i => i.owner === 'theirs' && i.status === 'pending');
  if (pendingTheirs.length > 0 && overdueTheirs.length === 0) {
    points.push({
      category: 'action-follow-up',
      point: `Check status on ${pendingTheirs.length} pending item(s)`,
      context: 'Keep track of customer commitments',
      priority: 3,
    });
  }

  return points;
}

/**
 * Generate value proposition reinforcement points
 */
function generateValuePoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const { account, analysis } = context;
  const stage = account.dealStage?.toLowerCase() ?? '';

  // POC/Pilot - reinforce value seen so far
  if (stage.includes('poc') || stage.includes('pilot') || stage.includes('trial')) {
    points.push({
      category: 'value-proposition',
      point: 'Reinforce value demonstrated in evaluation',
      context: 'Connect POC results to business outcomes',
      suggestedPhrasing: '"Based on what we\'ve seen so far, the impact on [metric] has been..."',
      priority: 2,
    });
  }

  // At-risk accounts - re-emphasize value
  if (analysis.momentum === 'at-risk' || analysis.momentum === 'stalling') {
    points.push({
      category: 'value-proposition',
      point: 'Re-emphasize core value proposition',
      context: 'Account needs re-engagement on value',
      suggestedPhrasing: '"I want to make sure we\'re still aligned on the key problems we\'re solving..."',
      priority: 1,
    });
  }

  // Negotiation stage - ROI focus
  if (stage.includes('negotiation') || stage.includes('proposal') || stage.includes('contract')) {
    points.push({
      category: 'value-proposition',
      point: 'Quantify ROI for final decision',
      context: 'Economic justification for procurement',
      suggestedPhrasing: '"Here\'s how we\'re calculating the return on this investment..."',
      priority: 2,
    });
  }

  return points;
}

/**
 * Generate next steps talking points
 */
function generateNextStepsPoints(context: TalkingPointContext): Omit<TalkingPoint, 'id'>[] {
  const points: Omit<TalkingPoint, 'id'>[] = [];
  const { account, analysis, participants } = context;
  const stage = account.dealStage?.toLowerCase() ?? '';
  const profiles = Array.from(participants.values());

  // Always have a next step ready
  points.push({
    category: 'next-steps',
    point: 'Propose specific next step with timeline',
    context: 'Never leave a meeting without a clear next action',
    suggestedPhrasing: '"For next steps, I\'d suggest we [action] by [date]. Does that work?"',
    priority: 2,
  });

  // Stage-specific next steps
  if (stage.includes('discovery') || stage.includes('qualification')) {
    points.push({
      category: 'next-steps',
      point: 'Propose technical deep-dive or demo',
      suggestedPhrasing: '"Would it be helpful to schedule a technical session with your team?"',
      priority: 2,
    });
  }

  if (stage.includes('poc') || stage.includes('pilot')) {
    // Check for missing economic buyer
    const hasEconomicBuyer = profiles.some(p => p.role === 'economic-buyer');
    if (!hasEconomicBuyer) {
      points.push({
        category: 'next-steps',
        point: 'Request executive briefing',
        context: 'No economic buyer engaged yet',
        suggestedPhrasing: '"Would it make sense to schedule a brief update with [executive] before we conclude the evaluation?"',
        priority: 1,
      });
    }
  }

  if (stage.includes('negotiation') || stage.includes('contract')) {
    points.push({
      category: 'next-steps',
      point: 'Propose implementation kickoff date',
      context: 'Create urgency toward close',
      suggestedPhrasing: '"If we can finalize by [date], we could kick off implementation on [date]."',
      priority: 1,
    });
  }

  // Long gaps need re-engagement plans
  if (analysis.daysSinceLastContact > 14) {
    points.push({
      category: 'next-steps',
      point: 'Establish regular touchpoint cadence',
      context: `${analysis.daysSinceLastContact} days since last contact`,
      suggestedPhrasing: '"To keep momentum, should we set up a regular check-in cadence?"',
      priority: 2,
    });
  }

  return points;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format days ago as human-readable string
 */
function formatDaysAgo(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Get suggested phrasing for risk types
 */
function getRiskPhrasing(riskId: string): string | undefined {
  const phrasings: Record<string, string> = {
    'risk-single-thread': '"Who else on your team should we be engaging with?"',
    'risk-no-champion': '"Is there someone on your side who\'s been driving this internally?"',
    'risk-stalled-momentum': '"I want to make sure we\'re moving at the right pace for your timeline..."',
    'risk-overdue-actions': '"I noticed we have some open items - what can we do to help move those forward?"',
  };
  return phrasings[riskId];
}

/**
 * Get talking points by category
 */
export function getTalkingPointsByCategory(
  points: TalkingPoint[],
  category: TalkingPointCategory
): TalkingPoint[] {
  return points.filter(p => p.category === category);
}

/**
 * Get top N talking points
 */
export function getTopTalkingPoints(points: TalkingPoint[], n: number = 5): TalkingPoint[] {
  return points.slice(0, n);
}

/**
 * Format talking points as text
 */
export function formatTalkingPointsAsText(points: TalkingPoint[]): string {
  const byCategory = new Map<TalkingPointCategory, TalkingPoint[]>();

  for (const point of points) {
    const existing = byCategory.get(point.category) ?? [];
    existing.push(point);
    byCategory.set(point.category, existing);
  }

  const categoryLabels: Record<TalkingPointCategory, string> = {
    opener: 'Opening',
    'goal-support': 'Goal Support',
    'risk-mitigation': 'Risk Mitigation',
    'stakeholder-specific': 'Stakeholder-Specific',
    'action-follow-up': 'Action Follow-ups',
    'value-proposition': 'Value Reinforcement',
    'next-steps': 'Next Steps',
  };

  const sections: string[] = [];

  for (const [category, categoryPoints] of byCategory) {
    const label = categoryLabels[category];
    const items = categoryPoints
      .map(p => {
        let text = `• ${p.point}`;
        if (p.suggestedPhrasing) {
          text += `\n  ${p.suggestedPhrasing}`;
        }
        return text;
      })
      .join('\n');

    sections.push(`**${label}**\n${items}`);
  }

  return sections.join('\n\n');
}
