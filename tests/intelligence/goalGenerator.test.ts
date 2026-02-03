/**
 * Goal Generator tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateGoals,
  formatGoalsAsText,
  getTopGoals,
} from '../../src/intelligence/goalGenerator.js';
import type { GoalGenerationContext } from '../../src/intelligence/goalGenerator.js';
import type { AccountAnalysis } from '../../src/intelligence/accountAnalyzer.js';
import type { ParticipantProfile } from '../../src/intelligence/participantProfiler.js';
import type { MergedData } from '../../src/intelligence/merger.js';

describe('Goal Generator', () => {
  function createContext(overrides: Partial<GoalGenerationContext> = {}): GoalGenerationContext {
    const defaultAnalysis: AccountAnalysis = {
      momentum: 'stable',
      momentumScore: 50,
      engagementVelocity: 'medium',
      daysInStage: 14,
      daysSinceLastContact: 3,
      risks: [],
      healthScore: 50,
      insights: [],
    };

    const defaultMergedData: MergedData = {
      account: { name: 'Test Account', domain: 'test.com' },
      participants: new Map(),
      timeline: [],
      actionItems: [],
      meetings: [],
    };

    const defaultParticipants = new Map<string, ParticipantProfile>();

    return {
      account: { name: 'Test Account', domain: 'test.com', dealStage: 'POC' },
      analysis: defaultAnalysis,
      participants: defaultParticipants,
      mergedData: defaultMergedData,
      meetingTitle: 'Test Meeting',
      ...overrides,
    };
  }

  describe('generateGoals', () => {
    it('should generate stage-based goals for POC stage', () => {
      const context = createContext({
        account: { dealStage: 'POC' },
      });

      const goals = generateGoals(context);

      expect(goals.length).toBeGreaterThan(0);
      expect(goals.some(g => g.title.toLowerCase().includes('poc') || g.title.toLowerCase().includes('success'))).toBe(true);
    });

    it('should generate stage-based goals for negotiation stage', () => {
      const context = createContext({
        account: { dealStage: 'negotiation' },
      });

      const goals = generateGoals(context);

      expect(goals.length).toBeGreaterThan(0);
      expect(goals.some(g =>
        g.title.toLowerCase().includes('contract') ||
        g.title.toLowerCase().includes('budget') ||
        g.title.toLowerCase().includes('implementation')
      )).toBe(true);
    });

    it('should generate high priority goals for high-severity risks', () => {
      const context = createContext({
        analysis: {
          momentum: 'stable',
          momentumScore: 50,
          engagementVelocity: 'medium',
          daysInStage: 14,
          daysSinceLastContact: 3,
          risks: [
            {
              id: 'risk-1',
              type: 'timeline',
              severity: 'high',
              description: 'Deal is stalling',
              detectedDate: new Date(),
              mitigationSuggestion: 'Re-engage with champion',
            },
          ],
          healthScore: 30,
          insights: [],
        },
      });

      const goals = generateGoals(context);

      const highPriorityGoals = goals.filter(g => g.priority === 1);
      expect(highPriorityGoals.length).toBeGreaterThan(0);
      expect(highPriorityGoals.some(g => g.relatedRisks?.includes('risk-1'))).toBe(true);
    });

    it('should generate goals for overdue customer action items', () => {
      const mergedData: MergedData = {
        account: { name: 'Test', domain: 'test.com' },
        participants: new Map(),
        timeline: [],
        actionItems: [
          {
            id: 'ai-1',
            description: 'Send AWS account IDs',
            owner: 'theirs',
            createdDate: new Date('2025-01-01'),
            status: 'overdue',
            daysOverdue: 7,
          },
        ],
        meetings: [],
      };

      const context = createContext({ mergedData });

      const goals = generateGoals(context);

      expect(goals.some(g => g.title.toLowerCase().includes('overdue'))).toBe(true);
      expect(goals.some(g => g.relatedActionItems?.includes('ai-1'))).toBe(true);
    });

    it('should generate stakeholder goals when economic buyer is missing', () => {
      const participants = new Map<string, ParticipantProfile>();
      participants.set('user1@test.com', {
        email: 'user1@test.com',
        name: 'User 1',
        company: 'Test',
        title: 'Engineer',
        role: 'technical-evaluator',
        influence: 'medium',
        previousInteractions: [],
        confidence: 0.5,
      });
      participants.set('user2@test.com', {
        email: 'user2@test.com',
        name: 'User 2',
        company: 'Test',
        title: 'Manager',
        role: 'champion',
        influence: 'medium',
        previousInteractions: [],
        confidence: 0.5,
      });
      participants.set('user3@test.com', {
        email: 'user3@test.com',
        name: 'User 3',
        company: 'Test',
        title: 'Analyst',
        role: 'influencer',
        influence: 'low',
        previousInteractions: [],
        confidence: 0.5,
      });

      const context = createContext({ participants });

      const goals = generateGoals(context);

      expect(goals.some(g => g.title.toLowerCase().includes('economic buyer'))).toBe(true);
    });

    it('should limit goals to top 5', () => {
      // Create context with many potential goals
      const context = createContext({
        account: { dealStage: 'POC' },
        analysis: {
          momentum: 'at-risk',
          momentumScore: 20,
          engagementVelocity: 'low',
          daysInStage: 60,
          daysSinceLastContact: 20,
          risks: [
            { id: 'r1', type: 'timeline', severity: 'high', description: 'Risk 1', detectedDate: new Date() },
            { id: 'r2', type: 'stakeholder', severity: 'high', description: 'Risk 2', detectedDate: new Date() },
            { id: 'r3', type: 'budget', severity: 'medium', description: 'Risk 3', detectedDate: new Date() },
          ],
          healthScore: 20,
          insights: [],
        },
      });

      const goals = generateGoals(context);

      expect(goals.length).toBeLessThanOrEqual(5);
    });

    it('should sort goals by priority', () => {
      const context = createContext({
        analysis: {
          momentum: 'stable',
          momentumScore: 50,
          engagementVelocity: 'medium',
          daysInStage: 14,
          daysSinceLastContact: 3,
          risks: [
            { id: 'r1', type: 'timeline', severity: 'high', description: 'High risk', detectedDate: new Date() },
            { id: 'r2', type: 'budget', severity: 'medium', description: 'Medium risk', detectedDate: new Date() },
          ],
          healthScore: 40,
          insights: [],
        },
      });

      const goals = generateGoals(context);

      // Verify sorted by priority (1 = highest)
      for (let i = 1; i < goals.length; i++) {
        expect(goals[i]!.priority).toBeGreaterThanOrEqual(goals[i - 1]!.priority);
      }
    });
  });

  describe('formatGoalsAsText', () => {
    it('should format goals as numbered list', () => {
      const goals = [
        { id: 'g1', priority: 1 as const, title: 'Goal 1', rationale: 'Reason 1' },
        { id: 'g2', priority: 2 as const, title: 'Goal 2', rationale: 'Reason 2' },
      ];

      const text = formatGoalsAsText(goals);

      expect(text).toContain('1. Goal 1');
      expect(text).toContain('2. Goal 2');
      expect(text).toContain('Reason 1');
      expect(text).toContain('Reason 2');
    });
  });

  describe('getTopGoals', () => {
    it('should return top N goals', () => {
      const goals = [
        { id: 'g1', priority: 1 as const, title: 'Goal 1', rationale: 'R1' },
        { id: 'g2', priority: 2 as const, title: 'Goal 2', rationale: 'R2' },
        { id: 'g3', priority: 3 as const, title: 'Goal 3', rationale: 'R3' },
      ];

      const top2 = getTopGoals(goals, 2);

      expect(top2.length).toBe(2);
      expect(top2[0]?.id).toBe('g1');
      expect(top2[1]?.id).toBe('g2');
    });
  });
});
