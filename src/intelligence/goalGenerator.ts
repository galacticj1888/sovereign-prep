/**
 * Goal Generator
 *
 * Generates meeting goals based on deal stage, account state,
 * open action items, and engagement history.
 */

import { logger } from '../utils/logger.js';
import type { Account } from '../types/index.js';
import type { MergedData } from './merger.js';
import type { AccountAnalysis } from './accountAnalyzer.js';
import type { ParticipantProfile } from './participantProfiler.js';

// ============================================================================
// Types
// ============================================================================

export interface Goal {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  title: string;
  rationale: string;
  suggestedApproach?: string;
  relatedRisks?: string[];
  relatedActionItems?: string[];
}

export interface GoalGenerationContext {
  account: Partial<Account>;
  analysis: AccountAnalysis;
  participants: Map<string, ParticipantProfile>;
  mergedData: MergedData;
  meetingTitle?: string;
}

// ============================================================================
// Deal Stage Goal Templates
// ============================================================================

interface StageGoalTemplate {
  stages: string[];
  goals: Array<{
    title: string;
    rationale: string;
    approach?: string;
    condition?: (ctx: GoalGenerationContext) => boolean;
  }>;
}

const STAGE_GOAL_TEMPLATES: StageGoalTemplate[] = [
  {
    stages: ['discovery', 'qualification', 'initial'],
    goals: [
      {
        title: 'Confirm decision-making process and timeline',
        rationale: 'Early-stage deals need clarity on how decisions are made',
        approach: 'Ask about evaluation criteria and who needs to sign off',
      },
      {
        title: 'Identify all key stakeholders',
        rationale: 'Multi-threading early improves win rates',
        approach: 'Ask who else should be involved in the evaluation',
      },
      {
        title: 'Understand current solution and pain points',
        rationale: 'Establishes baseline for value proposition',
        approach: 'Ask about current workflows and biggest challenges',
      },
    ],
  },
  {
    stages: ['poc', 'proof of concept', 'pilot', 'trial', 'evaluation'],
    goals: [
      {
        title: 'Confirm POC success criteria are on track',
        rationale: 'Early identification of blockers prevents surprises',
        approach: 'Review each success criterion and current status',
      },
      {
        title: 'Address any technical blockers',
        rationale: 'Technical issues in POC can derail entire deal',
        approach: 'Ask directly about any challenges or concerns',
      },
      {
        title: 'Schedule executive briefing before POC ends',
        rationale: 'Economic buyers need to see value before procurement',
        approach: 'Request intro to leadership for a brief status update',
        condition: ctx => !hasEconomicBuyerEngaged(ctx),
      },
      {
        title: 'Verify procurement timeline',
        rationale: 'Procurement often takes longer than expected',
        approach: 'Ask specific questions about approval process and timing',
      },
    ],
  },
  {
    stages: ['negotiation', 'proposal', 'contract', 'legal'],
    goals: [
      {
        title: 'Resolve outstanding contract terms',
        rationale: 'Legal back-and-forth can delay close significantly',
        approach: 'Identify remaining open items and decision makers',
      },
      {
        title: 'Confirm budget approval status',
        rationale: 'Budget surprises at this stage are deal killers',
        approach: 'Directly confirm budget has been allocated',
      },
      {
        title: 'Lock in implementation timeline',
        rationale: 'Urgency creates momentum toward close',
        approach: 'Propose specific dates for kickoff',
      },
    ],
  },
  {
    stages: ['closed', 'won', 'customer', 'implementation'],
    goals: [
      {
        title: 'Confirm implementation milestones',
        rationale: 'Successful implementation drives expansion',
        approach: 'Review timeline and identify any risks',
      },
      {
        title: 'Identify expansion opportunities',
        rationale: 'Happy customers are best source of growth',
        approach: 'Ask about other teams or use cases',
      },
    ],
  },
];

// ============================================================================
// Main Goal Generation
// ============================================================================

/**
 * Generate prioritized goals for a meeting
 */
export function generateGoals(context: GoalGenerationContext): Goal[] {
  const log = logger.child('goals');
  const goals: Goal[] = [];
  let nextId = 1;

  // 1. Stage-based goals
  const stageGoals = generateStageGoals(context);
  for (const goal of stageGoals) {
    goals.push({ ...goal, id: `goal-${nextId++}` });
  }

  // 2. Risk-based goals
  const riskGoals = generateRiskGoals(context);
  for (const goal of riskGoals) {
    goals.push({ ...goal, id: `goal-${nextId++}` });
  }

  // 3. Action item follow-up goals
  const actionGoals = generateActionItemGoals(context);
  for (const goal of actionGoals) {
    goals.push({ ...goal, id: `goal-${nextId++}` });
  }

  // 4. Stakeholder-based goals
  const stakeholderGoals = generateStakeholderGoals(context);
  for (const goal of stakeholderGoals) {
    goals.push({ ...goal, id: `goal-${nextId++}` });
  }

  // Sort by priority and deduplicate similar goals
  const deduped = deduplicateGoals(goals);
  const sorted = deduped.sort((a, b) => a.priority - b.priority);

  // Return top 5 goals
  const topGoals = sorted.slice(0, 5);

  log.info(`Generated ${topGoals.length} goals for meeting`);
  return topGoals;
}

// ============================================================================
// Goal Generation by Category
// ============================================================================

/**
 * Generate goals based on deal stage
 */
function generateStageGoals(context: GoalGenerationContext): Omit<Goal, 'id'>[] {
  const dealStage = context.account.dealStage?.toLowerCase() ?? 'unknown';
  const goals: Omit<Goal, 'id'>[] = [];

  // Find matching stage template
  const template = STAGE_GOAL_TEMPLATES.find(t =>
    t.stages.some(s => dealStage.includes(s))
  );

  if (!template) {
    // Default goals for unknown stage
    goals.push({
      priority: 2,
      title: 'Understand current status and next steps',
      rationale: 'Maintain momentum and clarity on path forward',
    });
    return goals;
  }

  // Apply template goals
  for (const goalTemplate of template.goals) {
    // Check condition if present
    if (goalTemplate.condition && !goalTemplate.condition(context)) {
      continue;
    }

    goals.push({
      priority: 2,
      title: goalTemplate.title,
      rationale: goalTemplate.rationale,
      suggestedApproach: goalTemplate.approach,
    });
  }

  return goals;
}

/**
 * Generate goals based on identified risks
 */
function generateRiskGoals(context: GoalGenerationContext): Omit<Goal, 'id'>[] {
  const goals: Omit<Goal, 'id'>[] = [];

  for (const risk of context.analysis.risks) {
    // High severity risks become priority 1 goals
    if (risk.severity === 'high') {
      goals.push({
        priority: 1,
        title: `Address: ${risk.description}`,
        rationale: `High-severity risk that needs immediate attention`,
        suggestedApproach: risk.mitigationSuggestion,
        relatedRisks: [risk.id],
      });
    }

    // Medium severity risks become priority 3 goals
    if (risk.severity === 'medium') {
      goals.push({
        priority: 3,
        title: `Discuss: ${risk.description}`,
        rationale: `Medium risk worth addressing proactively`,
        suggestedApproach: risk.mitigationSuggestion,
        relatedRisks: [risk.id],
      });
    }
  }

  return goals;
}

/**
 * Generate goals based on open action items
 */
function generateActionItemGoals(context: GoalGenerationContext): Omit<Goal, 'id'>[] {
  const goals: Omit<Goal, 'id'>[] = [];
  const openItems = context.mergedData.actionItems.filter(
    i => i.status === 'pending' || i.status === 'overdue'
  );

  // Group by owner
  const theirItems = openItems.filter(i => i.owner === 'theirs');
  const ourItems = openItems.filter(i => i.owner === 'ours');

  // Overdue items from customer side
  const overdueTheirs = theirItems.filter(i => i.status === 'overdue');
  if (overdueTheirs.length > 0) {
    const itemDescriptions = overdueTheirs
      .slice(0, 3)
      .map(i => i.description)
      .join('; ');

    goals.push({
      priority: 1,
      title: 'Follow up on overdue customer action items',
      rationale: `${overdueTheirs.length} items are past due: ${itemDescriptions}`,
      suggestedApproach: 'Ask for status update and offer assistance if blocked',
      relatedActionItems: overdueTheirs.map(i => i.id),
    });
  }

  // Pending items from customer side
  const pendingTheirs = theirItems.filter(i => i.status === 'pending');
  if (pendingTheirs.length > 0 && overdueTheirs.length === 0) {
    goals.push({
      priority: 3,
      title: 'Check status on pending customer items',
      rationale: `${pendingTheirs.length} items pending on customer side`,
      relatedActionItems: pendingTheirs.map(i => i.id),
    });
  }

  // Our overdue items - we should address these
  if (ourItems.filter(i => i.status === 'overdue').length > 0) {
    goals.push({
      priority: 2,
      title: 'Deliver on our overdue commitments',
      rationale: 'We have overdue items - address these to maintain credibility',
      suggestedApproach: 'Either complete before the call or set new expectations',
    });
  }

  return goals;
}

/**
 * Generate goals based on stakeholder analysis
 */
function generateStakeholderGoals(context: GoalGenerationContext): Omit<Goal, 'id'>[] {
  const goals: Omit<Goal, 'id'>[] = [];
  const profiles = Array.from(context.participants.values());

  // Check for missing economic buyer
  const hasEconomicBuyer = profiles.some(p => p.role === 'economic-buyer');
  if (!hasEconomicBuyer && profiles.length >= 3) {
    goals.push({
      priority: 2,
      title: 'Get introduction to economic buyer',
      rationale: 'No budget holder engaged yet - critical for deal progression',
      suggestedApproach: 'Ask champion for intro to person who approves budget',
    });
  }

  // Check for blockers in the meeting
  const blockers = profiles.filter(p => p.role === 'blocker');
  if (blockers.length > 0) {
    goals.push({
      priority: 2,
      title: 'Address concerns of skeptical stakeholders',
      rationale: `${blockers.length} potential blocker(s) identified`,
      suggestedApproach: 'Proactively ask about and address their concerns',
    });
  }

  // Champion engagement
  const champion = profiles.find(p => p.role === 'champion');
  if (champion) {
    goals.push({
      priority: 4,
      title: 'Equip champion with internal selling points',
      rationale: 'Champions need ammunition to advocate internally',
      suggestedApproach: 'Share ROI data, case studies, or talking points',
    });
  }

  return goals;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if economic buyer is engaged
 */
function hasEconomicBuyerEngaged(context: GoalGenerationContext): boolean {
  const profiles = Array.from(context.participants.values());
  return profiles.some(p => p.role === 'economic-buyer');
}

/**
 * Deduplicate similar goals
 */
function deduplicateGoals(goals: Goal[]): Goal[] {
  const seen = new Set<string>();
  const deduped: Goal[] = [];

  for (const goal of goals) {
    // Create a simple key from the title
    const key = goal.title.toLowerCase().slice(0, 30);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(goal);
    }
  }

  return deduped;
}

/**
 * Format goals as a simple string list
 */
export function formatGoalsAsText(goals: Goal[]): string {
  return goals
    .map((g, i) => `${i + 1}. ${g.title}\n   → ${g.rationale}`)
    .join('\n\n');
}

/**
 * Get the top N goals
 */
export function getTopGoals(goals: Goal[], n: number = 3): Goal[] {
  return goals.slice(0, n);
}
