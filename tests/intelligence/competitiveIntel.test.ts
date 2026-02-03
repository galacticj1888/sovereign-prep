/**
 * Competitive Intelligence tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractCompetitiveIntel,
  getCompetitorsByRisk,
  formatCompetitiveIntelAsText,
} from '../../src/intelligence/competitiveIntel.js';
import type { CompetitiveIntelContext } from '../../src/intelligence/competitiveIntel.js';
import type { MergedData } from '../../src/intelligence/merger.js';
import type { TimelineEvent } from '../../src/types/index.js';

describe('Competitive Intelligence', () => {
  function createContext(timeline: TimelineEvent[] = []): CompetitiveIntelContext {
    const mergedData: MergedData = {
      account: { name: 'Test Account', domain: 'test.com' },
      participants: new Map(),
      timeline,
      actionItems: [],
      meetings: [],
    };

    return {
      mergedData,
      accountName: 'Test Account',
      accountDomain: 'test.com',
    };
  }

  describe('extractCompetitiveIntel', () => {
    it('should detect known competitor mentions', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Call discussing Salesforce comparison',
          description: 'Customer mentioned they are currently using Salesforce',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.competitors.length).toBeGreaterThan(0);
      expect(intel.competitors.some(c => c.name === 'Salesforce')).toBe(true);
    });

    it('should detect multiple competitors', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Vendor evaluation call',
          description: 'Comparing us against AWS and Microsoft Azure solutions',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.competitors.length).toBeGreaterThanOrEqual(2);
    });

    it('should analyze competitor sentiment', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Migration discussion',
          description: 'Customer frustrated with Datadog - too expensive and complex',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      const datadogMention = intel.mentions.find(m => m.competitor === 'Datadog');
      expect(datadogMention).toBeDefined();
      expect(datadogMention?.sentiment).toBe('negative');
    });

    it('should detect positive sentiment (risk)', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Status call',
          description: 'Team really likes Snowflake and has great experience with it',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      const mention = intel.mentions.find(m => m.competitor === 'Snowflake');
      expect(mention?.sentiment).toBe('positive');
    });

    it('should identify competitive risks', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date('2026-01-15'),
          type: 'call',
          title: 'Call 1',
          description: 'Currently using ServiceNow for ITSM',
        },
        {
          id: 'e2',
          date: new Date('2026-01-20'),
          type: 'call',
          title: 'Call 2',
          description: 'Happy with ServiceNow so far',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.risks.length).toBeGreaterThan(0);
      expect(intel.risks.some(r => r.competitor === 'ServiceNow')).toBe(true);
    });

    it('should extract key differentiators from negative mentions', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Discussion',
          description: 'Salesforce is too expensive and has integration issues',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.keyDifferentiators).toContain('Pricing/value advantage');
      expect(intel.keyDifferentiators).toContain('Better integrations');
    });

    it('should generate landscape summary', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Evaluation call',
          description: 'Also evaluating HubSpot for CRM',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.competitiveLandscape).toBeTruthy();
      expect(intel.competitiveLandscape).toContain('HubSpot');
    });

    it('should return empty intel when no competitors mentioned', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Status call',
          description: 'Discussed project timeline and requirements',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      expect(intel.competitors.length).toBe(0);
      expect(intel.mentions.length).toBe(0);
    });

    it('should detect generic competitive signals', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Vendor call',
          description: 'We are also evaluating other vendors and alternatives',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);

      // Should detect "Unknown Competitor" for generic mentions
      expect(intel.mentions.length).toBeGreaterThan(0);
    });
  });

  describe('getCompetitorsByRisk', () => {
    it('should sort competitors by risk level', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Call',
          description: 'Using Salesforce, also looking at HubSpot',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);
      const sorted = getCompetitorsByRisk(intel);

      // Competitors with higher risk scores should come first
      expect(sorted.length).toBeGreaterThan(0);
    });
  });

  describe('formatCompetitiveIntelAsText', () => {
    it('should format intel as readable text', () => {
      const timeline: TimelineEvent[] = [
        {
          id: 'e1',
          date: new Date(),
          type: 'call',
          title: 'Evaluation',
          description: 'Comparing against Zendesk for support',
        },
      ];

      const context = createContext(timeline);
      const intel = extractCompetitiveIntel(context);
      const text = formatCompetitiveIntelAsText(intel);

      expect(text).toContain('Competitive Landscape');
      expect(text).toContain('Zendesk');
    });
  });
});
