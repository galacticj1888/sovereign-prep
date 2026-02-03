/**
 * Account Analyzer tests
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeAccount,
  analyzeTimeline,
  applyAnalysisToAccount,
} from '../../src/intelligence/accountAnalyzer.js';
import type { MergedData } from '../../src/intelligence/merger.js';
import type { TimelineEvent, ActionItem } from '../../src/types/index.js';

describe('Account Analyzer', () => {
  function createMergedData(
    timeline: TimelineEvent[] = [],
    actionItems: ActionItem[] = [],
    participantCount: number = 3
  ): MergedData {
    const participants = new Map();
    for (let i = 0; i < participantCount; i++) {
      participants.set(`user${i}@example.com`, {
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: i === 0 ? 'champion' : 'unknown',
      });
    }

    return {
      account: { name: 'Test Account', domain: 'example.com' },
      participants,
      timeline,
      actionItems,
      meetings: [],
    };
  }

  describe('analyzeAccount', () => {
    it('should return accelerating momentum for active accounts', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      const timeline: TimelineEvent[] = [
        {
          id: '1',
          date: twoDaysAgo,
          type: 'call',
          title: 'Recent call',
          duration: 30,
        },
        {
          id: '2',
          date: fiveDaysAgo,
          type: 'call',
          title: 'Previous call',
          duration: 45,
        },
      ];

      const data = createMergedData(timeline, [], 5);
      const result = analyzeAccount(data);

      expect(result.momentum).toBe('accelerating');
      expect(result.momentumScore).toBeGreaterThanOrEqual(70);
      expect(result.daysSinceLastContact).toBeLessThanOrEqual(3);
    });

    it('should return at-risk momentum for stale accounts', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35);

      const timeline: TimelineEvent[] = [
        {
          id: '1',
          date: thirtyDaysAgo,
          type: 'call',
          title: 'Old call',
          duration: 30,
        },
      ];

      const data = createMergedData(timeline, [], 1);
      const result = analyzeAccount(data);

      expect(result.momentum).toBe('at-risk');
      expect(result.momentumScore).toBeLessThan(30);
      expect(result.daysSinceLastContact).toBeGreaterThan(30);
    });

    it('should detect risks for overdue action items', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const timeline: TimelineEvent[] = [
        {
          id: '1',
          date: fiveDaysAgo,
          type: 'call',
          title: 'Recent call',
        },
      ];

      const actionItems: ActionItem[] = [
        {
          id: '1',
          description: 'Send docs',
          owner: 'ours',
          createdDate: tenDaysAgo,
          status: 'overdue',
        },
        {
          id: '2',
          description: 'Get approval',
          owner: 'theirs',
          createdDate: tenDaysAgo,
          status: 'overdue',
        },
      ];

      const data = createMergedData(timeline, actionItems);
      const result = analyzeAccount(data);

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks.some(r => r.id.includes('overdue'))).toBe(true);
    });

    it('should detect risk for limited stakeholder engagement', () => {
      const now = new Date();
      const timeline: TimelineEvent[] = [
        { id: '1', date: now, type: 'call', title: 'Call' },
      ];

      const data = createMergedData(timeline, [], 1); // Only 1 participant
      const result = analyzeAccount(data);

      expect(result.risks.some(r => r.id === 'risk-single-thread')).toBe(true);
    });

    it('should generate insights', () => {
      const now = new Date();
      const timeline: TimelineEvent[] = [
        { id: '1', date: now, type: 'call', title: 'Call' },
      ];

      const data = createMergedData(timeline);
      const result = analyzeAccount(data);

      expect(result.insights.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeTimeline', () => {
    it('should calculate average call duration', () => {
      const timeline: TimelineEvent[] = [
        { id: '1', date: new Date(), type: 'call', title: 'Call 1', duration: 30 },
        { id: '2', date: new Date(), type: 'call', title: 'Call 2', duration: 60 },
        { id: '3', date: new Date(), type: 'meeting', title: 'Meeting' },
      ];

      const result = analyzeTimeline(timeline);

      expect(result.averageCallDuration).toBe(45);
    });

    it('should calculate call frequency', () => {
      const now = new Date();
      const timeline: TimelineEvent[] = [];

      // Add 4 calls in the last 7 days
      for (let i = 0; i < 4; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        timeline.push({
          id: `${i}`,
          date,
          type: 'call',
          title: `Call ${i}`,
        });
      }

      const result = analyzeTimeline(timeline);

      // 4 calls in 30 days = ~0.93 calls/week
      expect(result.callFrequency).toBeGreaterThan(0);
    });

    it('should find longest gap between interactions', () => {
      const timeline: TimelineEvent[] = [
        { id: '1', date: new Date('2026-01-01'), type: 'call', title: 'Call 1' },
        { id: '2', date: new Date('2026-01-05'), type: 'call', title: 'Call 2' },
        { id: '3', date: new Date('2026-01-20'), type: 'call', title: 'Call 3' }, // 15 day gap
      ];

      const result = analyzeTimeline(timeline);

      expect(result.longestGap).toBe(15);
    });
  });

  describe('applyAnalysisToAccount', () => {
    it('should update account with analysis results', () => {
      const account = {
        id: '123',
        name: 'Test',
        domain: 'test.com',
        dealStage: 'POC',
        dealValue: 100000,
      };

      const analysis = {
        momentum: 'stable' as const,
        momentumScore: 55,
        engagementVelocity: 'medium' as const,
        daysInStage: 14,
        daysSinceLastContact: 3,
        risks: [],
        healthScore: 55,
        insights: [],
      };

      const result = applyAnalysisToAccount(account, analysis);

      expect(result.momentum).toBe('stable');
      expect(result.daysInStage).toBe(14);
      expect(result.risks).toEqual([]);
    });
  });
});
