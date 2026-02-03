/**
 * Account State Analyzer
 *
 * Computes deal momentum, engagement metrics, risks,
 * and overall account health from merged data.
 */

import { logger } from '../utils/logger.js';
import { daysAgo, daysBetween } from '../utils/dateUtils.js';
import type {
  Account,
  Momentum,
  Risk,
  TimelineEvent,
  ActionItem,
} from '../types/index.js';
import type { MergedData } from './merger.js';

// ============================================================================
// Types
// ============================================================================

export interface AccountAnalysis {
  momentum: Momentum;
  momentumScore: number; // 0-100
  engagementVelocity: 'high' | 'medium' | 'low';
  daysInStage: number;
  daysSinceLastContact: number;
  risks: Risk[];
  healthScore: number; // 0-100
  insights: string[];
}

export interface AnalysisOptions {
  currentDealStage?: string;
  currentDealValue?: number;
  stageStartDate?: Date;
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Analyze account state from merged data
 */
export function analyzeAccount(
  data: MergedData,
  options: AnalysisOptions = {}
): AccountAnalysis {
  const log = logger.child('analyzer');

  // Calculate core metrics
  const daysSinceLastContact = calculateDaysSinceLastContact(data.timeline);
  const daysInStage = options.stageStartDate
    ? daysAgo(options.stageStartDate)
    : 0;
  const engagementVelocity = calculateEngagementVelocity(data.timeline);
  const momentumScore = calculateMomentumScore(data, daysSinceLastContact);
  const momentum = scoreMomentum(momentumScore);

  // Detect risks
  const risks = detectRisks(data, daysSinceLastContact, daysInStage);

  // Calculate overall health
  const healthScore = calculateHealthScore(
    momentumScore,
    risks,
    data.actionItems
  );

  // Generate insights
  const insights = generateInsights(data, momentum, risks);

  log.info(
    `Account analysis: momentum=${momentum}, health=${healthScore}, risks=${risks.length}`
  );

  return {
    momentum,
    momentumScore,
    engagementVelocity,
    daysInStage,
    daysSinceLastContact,
    risks,
    healthScore,
    insights,
  };
}

/**
 * Update account object with analysis results
 */
export function applyAnalysisToAccount(
  account: Partial<Account>,
  analysis: AccountAnalysis
): Account {
  return {
    id: account.id ?? '',
    name: account.name ?? '',
    domain: account.domain ?? '',
    dealStage: account.dealStage ?? 'unknown',
    dealValue: account.dealValue ?? 0,
    closeDate: account.closeDate,
    daysInStage: analysis.daysInStage,
    lastContactDate: account.lastContactDate ?? new Date(),
    momentum: analysis.momentum,
    contacts: account.contacts ?? [],
    timeline: account.timeline ?? [],
    openActionItems: account.openActionItems ?? [],
    risks: analysis.risks,
  };
}

// ============================================================================
// Metric Calculations
// ============================================================================

/**
 * Calculate days since last contact
 */
function calculateDaysSinceLastContact(timeline: TimelineEvent[]): number {
  if (timeline.length === 0) return 999;

  // Find most recent event
  const sorted = [...timeline].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const lastEvent = sorted[0];
  if (!lastEvent) return 999;

  return daysAgo(lastEvent.date);
}

/**
 * Calculate engagement velocity (events per week)
 */
function calculateEngagementVelocity(
  timeline: TimelineEvent[]
): 'high' | 'medium' | 'low' {
  // Look at last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentEvents = timeline.filter(e => e.date >= thirtyDaysAgo);
  const eventsPerWeek = (recentEvents.length / 30) * 7;

  if (eventsPerWeek >= 2) return 'high';
  if (eventsPerWeek >= 0.5) return 'medium';
  return 'low';
}

/**
 * Calculate momentum score (0-100)
 */
function calculateMomentumScore(
  data: MergedData,
  daysSinceLastContact: number
): number {
  let score = 50; // Start neutral

  // Recent contact is positive
  if (daysSinceLastContact <= 3) score += 20;
  else if (daysSinceLastContact <= 7) score += 10;
  else if (daysSinceLastContact > 14) score -= 20;
  else if (daysSinceLastContact > 30) score -= 40;

  // Multiple stakeholders engaged is positive
  const participantCount = data.participants.size;
  if (participantCount >= 5) score += 15;
  else if (participantCount >= 3) score += 10;
  else if (participantCount < 2) score -= 10;

  // Recent meetings/calls are positive
  const recentCalls = data.timeline.filter(
    e => e.type === 'call' && daysAgo(e.date) <= 14
  );
  if (recentCalls.length >= 2) score += 15;
  else if (recentCalls.length >= 1) score += 5;

  // Open action items (ours) that are overdue is negative
  const overdueOurs = data.actionItems.filter(
    i => i.owner === 'ours' && i.status === 'overdue'
  );
  score -= overdueOurs.length * 5;

  // Open action items (theirs) that are overdue - could go either way
  const overdueTheirs = data.actionItems.filter(
    i => i.owner === 'theirs' && i.status === 'overdue'
  );
  score -= overdueTheirs.length * 3;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Convert momentum score to category
 */
function scoreMomentum(score: number): Momentum {
  if (score >= 70) return 'accelerating';
  if (score >= 50) return 'stable';
  if (score >= 30) return 'stalling';
  return 'at-risk';
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(
  momentumScore: number,
  risks: Risk[],
  actionItems: ActionItem[]
): number {
  let score = momentumScore;

  // High severity risks have big impact
  const highRisks = risks.filter(r => r.severity === 'high').length;
  const mediumRisks = risks.filter(r => r.severity === 'medium').length;

  score -= highRisks * 15;
  score -= mediumRisks * 5;

  // Overdue action items impact score
  const overdueItems = actionItems.filter(i => i.status === 'overdue').length;
  score -= overdueItems * 3;

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Risk Detection
// ============================================================================

/**
 * Detect risks from account data
 */
function detectRisks(
  data: MergedData,
  daysSinceLastContact: number,
  daysInStage: number
): Risk[] {
  const risks: Risk[] = [];
  const now = new Date();

  // Risk: Stale communication
  if (daysSinceLastContact > 7) {
    risks.push({
      id: 'risk-stale-comm',
      type: 'timeline',
      severity: daysSinceLastContact > 14 ? 'high' : 'medium',
      description: `No contact in ${daysSinceLastContact} days`,
      detectedDate: now,
      mitigationSuggestion: 'Schedule a check-in call or send an update',
    });
  }

  // Risk: Long time in stage
  if (daysInStage > 30) {
    risks.push({
      id: 'risk-stuck-stage',
      type: 'timeline',
      severity: daysInStage > 60 ? 'high' : 'medium',
      description: `Deal has been in current stage for ${daysInStage} days`,
      detectedDate: now,
      mitigationSuggestion: 'Identify and address blockers to move forward',
    });
  }

  // Risk: Limited stakeholder engagement
  if (data.participants.size < 3) {
    risks.push({
      id: 'risk-single-thread',
      type: 'stakeholder',
      severity: 'medium',
      description: 'Limited multi-threading - only engaging few stakeholders',
      detectedDate: now,
      mitigationSuggestion: 'Identify and engage additional decision makers',
    });
  }

  // Risk: Overdue action items (ours)
  const overdueOurs = data.actionItems.filter(
    i => i.owner === 'ours' && i.status === 'overdue'
  );
  if (overdueOurs.length > 0) {
    risks.push({
      id: 'risk-overdue-ours',
      type: 'timeline',
      severity: overdueOurs.length > 2 ? 'high' : 'medium',
      description: `${overdueOurs.length} overdue action items on our side`,
      detectedDate: now,
      mitigationSuggestion: 'Complete overdue items or communicate new timeline',
    });
  }

  // Risk: Overdue action items (theirs)
  const overdueTheirs = data.actionItems.filter(
    i => i.owner === 'theirs' && i.status === 'overdue'
  );
  if (overdueTheirs.length > 0) {
    risks.push({
      id: 'risk-overdue-theirs',
      type: 'timeline',
      severity: overdueTheirs.length > 2 ? 'high' : 'medium',
      description: `${overdueTheirs.length} overdue action items waiting on customer`,
      detectedDate: now,
      mitigationSuggestion: 'Follow up on pending items and offer assistance',
    });
  }

  // Risk: No champion identified
  const profiles = Array.from(data.participants.values());
  const hasChampion = profiles.some(p => p.role === 'champion');
  if (!hasChampion && data.participants.size > 0) {
    risks.push({
      id: 'risk-no-champion',
      type: 'stakeholder',
      severity: 'medium',
      description: 'No clear internal champion identified',
      detectedDate: now,
      mitigationSuggestion: 'Identify and cultivate an internal advocate',
    });
  }

  // Risk: No economic buyer engaged
  const hasEconomicBuyer = profiles.some(p => p.role === 'economic-buyer');
  if (!hasEconomicBuyer && data.participants.size >= 3) {
    risks.push({
      id: 'risk-no-buyer',
      type: 'stakeholder',
      severity: 'high',
      description: 'Economic buyer not yet engaged',
      detectedDate: now,
      mitigationSuggestion: 'Get introduction to budget holder before POC ends',
    });
  }

  return risks;
}

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Generate human-readable insights
 */
function generateInsights(
  data: MergedData,
  momentum: Momentum,
  risks: Risk[]
): string[] {
  const insights: string[] = [];

  // Momentum insight
  switch (momentum) {
    case 'accelerating':
      insights.push('Strong momentum - deal is progressing well');
      break;
    case 'stable':
      insights.push('Stable engagement - maintain current cadence');
      break;
    case 'stalling':
      insights.push('Momentum slowing - proactive outreach recommended');
      break;
    case 'at-risk':
      insights.push('Deal at risk - immediate action needed');
      break;
  }

  // Multi-threading insight
  const participantCount = data.participants.size;
  if (participantCount >= 5) {
    insights.push(`Strong multi-threading with ${participantCount}+ stakeholders engaged`);
  }

  // High-value actions
  const highSeverityRisks = risks.filter(r => r.severity === 'high');
  if (highSeverityRisks.length > 0) {
    for (const risk of highSeverityRisks) {
      if (risk.mitigationSuggestion) {
        insights.push(`Action needed: ${risk.mitigationSuggestion}`);
      }
    }
  }

  // Timeline activity
  const recentActivity = data.timeline.filter(e => daysAgo(e.date) <= 7);
  if (recentActivity.length >= 3) {
    insights.push('High recent activity indicates active engagement');
  }

  return insights;
}

// ============================================================================
// Timeline Analysis
// ============================================================================

/**
 * Analyze timeline for patterns
 */
export function analyzeTimeline(timeline: TimelineEvent[]): {
  averageCallDuration: number;
  callFrequency: number; // calls per week
  longestGap: number; // days between interactions
  trend: 'increasing' | 'stable' | 'decreasing';
} {
  const calls = timeline.filter(e => e.type === 'call');

  // Average call duration
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  const averageCallDuration = calls.length > 0 ? totalDuration / calls.length : 0;

  // Calculate call frequency (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCalls = calls.filter(c => c.date >= thirtyDaysAgo);
  const callFrequency = (recentCalls.length / 30) * 7;

  // Find longest gap
  const sorted = [...timeline].sort((a, b) => a.date.getTime() - b.date.getTime());
  let longestGap = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr) {
      const gap = daysBetween(prev.date, curr.date);
      if (gap > longestGap) longestGap = gap;
    }
  }

  // Determine trend (compare first half to second half of activity)
  const midIndex = Math.floor(timeline.length / 2);
  const firstHalf = timeline.slice(0, midIndex);
  const secondHalf = timeline.slice(midIndex);

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (secondHalf.length > firstHalf.length * 1.5) {
    trend = 'increasing';
  } else if (secondHalf.length < firstHalf.length * 0.5) {
    trend = 'decreasing';
  }

  return {
    averageCallDuration,
    callFrequency,
    longestGap,
    trend,
  };
}
