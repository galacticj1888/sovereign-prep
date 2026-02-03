/**
 * Talking Point Generator tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateTalkingPoints,
  getTalkingPointsByCategory,
  getTopTalkingPoints,
  formatTalkingPointsAsText,
} from '../../src/intelligence/talkingPointGenerator.js';
import type { TalkingPointContext } from '../../src/intelligence/talkingPointGenerator.js';
import type { AccountAnalysis } from '../../src/intelligence/accountAnalyzer.js';
import type { ParticipantProfile } from '../../src/intelligence/participantProfiler.js';
import type { MergedData } from '../../src/intelligence/merger.js';
import type { Goal } from '../../src/intelligence/goalGenerator.js';

describe('Talking Point Generator', () => {
  function createContext(overrides: Partial<TalkingPointContext> = {}): TalkingPointContext {
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
      timeline: [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Previous Call',
        },
      ],
      actionItems: [],
      meetings: [],
    };

    const defaultGoals: Goal[] = [
      { id: 'g1', priority: 1, title: 'Confirm timeline', rationale: 'Important' },
    ];

    return {
      account: { name: 'Test Account', domain: 'test.com', dealStage: 'POC' },
      analysis: defaultAnalysis,
      participants: new Map<string, ParticipantProfile>(),
      mergedData: defaultMergedData,
      goals: defaultGoals,
      meetingTitle: 'Test Meeting',
      ...overrides,
    };
  }

  describe('generateTalkingPoints', () => {
    it('should generate opener talking points', () => {
      const context = createContext();
      const points = generateTalkingPoints(context);

      const openers = points.filter(p => p.category === 'opener');
      expect(openers.length).toBeGreaterThan(0);
    });

    it('should generate goal-support talking points', () => {
      const context = createContext({
        goals: [
          {
            id: 'g1',
            priority: 1,
            title: 'Confirm POC success criteria',
            rationale: 'Critical for deal',
            suggestedApproach: 'Review each criterion',
          },
        ],
      });

      const points = generateTalkingPoints(context);

      const goalSupport = points.filter(p => p.category === 'goal-support');
      expect(goalSupport.length).toBeGreaterThan(0);
      expect(goalSupport.some(p => p.relatedGoalId === 'g1')).toBe(true);
    });

    it('should generate risk-mitigation points for high-severity risks', () => {
      const context = createContext({
        analysis: {
          momentum: 'at-risk',
          momentumScore: 20,
          engagementVelocity: 'low',
          daysInStage: 30,
          daysSinceLastContact: 14,
          risks: [
            {
              id: 'r1',
              type: 'stakeholder',
              severity: 'high',
              description: 'No champion identified',
              detectedDate: new Date(),
              mitigationSuggestion: 'Identify internal advocate',
            },
          ],
          healthScore: 30,
          insights: [],
        },
      });

      const points = generateTalkingPoints(context);

      const riskPoints = points.filter(p => p.category === 'risk-mitigation');
      expect(riskPoints.length).toBeGreaterThan(0);
      expect(riskPoints.some(p => p.priority === 1)).toBe(true);
    });

    it('should generate stakeholder-specific points for champion', () => {
      const participants = new Map<string, ParticipantProfile>();
      participants.set('champion@test.com', {
        email: 'champion@test.com',
        name: 'Champion User',
        company: 'Test',
        title: 'Manager',
        role: 'champion',
        influence: 'high',
        previousInteractions: [],
        confidence: 0.7,
      });

      const context = createContext({ participants });

      const points = generateTalkingPoints(context);

      const stakeholderPoints = points.filter(p => p.category === 'stakeholder-specific');
      expect(stakeholderPoints.some(p => p.relatedParticipant === 'champion@test.com')).toBe(true);
    });

    it('should generate stakeholder-specific points for blocker', () => {
      const participants = new Map<string, ParticipantProfile>();
      participants.set('blocker@test.com', {
        email: 'blocker@test.com',
        name: 'Skeptical User',
        company: 'Test',
        title: 'Security Lead',
        role: 'blocker',
        influence: 'high',
        previousInteractions: [],
        confidence: 0.6,
      });

      const context = createContext({ participants });

      const points = generateTalkingPoints(context);

      const stakeholderPoints = points.filter(p => p.category === 'stakeholder-specific');
      expect(stakeholderPoints.some(p =>
        p.relatedParticipant === 'blocker@test.com' &&
        p.priority === 1
      )).toBe(true);
    });

    it('should generate action follow-up points for overdue items', () => {
      const mergedData: MergedData = {
        account: { name: 'Test', domain: 'test.com' },
        participants: new Map(),
        timeline: [],
        actionItems: [
          {
            id: 'ai-1',
            description: 'Send technical docs',
            owner: 'theirs',
            createdDate: new Date('2025-01-01'),
            status: 'overdue',
            daysOverdue: 5,
          },
        ],
        meetings: [],
      };

      const context = createContext({ mergedData });

      const points = generateTalkingPoints(context);

      const actionPoints = points.filter(p => p.category === 'action-follow-up');
      expect(actionPoints.length).toBeGreaterThan(0);
    });

    it('should generate next-steps points', () => {
      const context = createContext();
      const points = generateTalkingPoints(context);

      const nextSteps = points.filter(p => p.category === 'next-steps');
      expect(nextSteps.length).toBeGreaterThan(0);
    });

    it('should sort points by priority', () => {
      const context = createContext({
        analysis: {
          momentum: 'at-risk',
          momentumScore: 20,
          engagementVelocity: 'low',
          daysInStage: 30,
          daysSinceLastContact: 20,
          risks: [
            { id: 'r1', type: 'timeline', severity: 'high', description: 'Risk', detectedDate: new Date() },
          ],
          healthScore: 20,
          insights: [],
        },
      });

      const points = generateTalkingPoints(context);

      // Verify sorted by priority
      for (let i = 1; i < points.length; i++) {
        expect(points[i]!.priority).toBeGreaterThanOrEqual(points[i - 1]!.priority);
      }
    });
  });

  describe('getTalkingPointsByCategory', () => {
    it('should filter points by category', () => {
      const points = [
        { id: 'tp-1', category: 'opener' as const, point: 'Open', priority: 1 as const },
        { id: 'tp-2', category: 'goal-support' as const, point: 'Goal', priority: 2 as const },
        { id: 'tp-3', category: 'opener' as const, point: 'Open 2', priority: 1 as const },
      ];

      const openers = getTalkingPointsByCategory(points, 'opener');

      expect(openers.length).toBe(2);
      expect(openers.every(p => p.category === 'opener')).toBe(true);
    });
  });

  describe('getTopTalkingPoints', () => {
    it('should return top N points', () => {
      const points = [
        { id: 'tp-1', category: 'opener' as const, point: 'P1', priority: 1 as const },
        { id: 'tp-2', category: 'opener' as const, point: 'P2', priority: 1 as const },
        { id: 'tp-3', category: 'opener' as const, point: 'P3', priority: 2 as const },
      ];

      const top2 = getTopTalkingPoints(points, 2);

      expect(top2.length).toBe(2);
    });
  });

  describe('formatTalkingPointsAsText', () => {
    it('should format points grouped by category', () => {
      const points = [
        { id: 'tp-1', category: 'opener' as const, point: 'Opening point', priority: 1 as const },
        { id: 'tp-2', category: 'next-steps' as const, point: 'Next step', priority: 2 as const },
      ];

      const text = formatTalkingPointsAsText(points);

      expect(text).toContain('Opening');
      expect(text).toContain('Next Steps');
      expect(text).toContain('Opening point');
      expect(text).toContain('Next step');
    });
  });
});
