/**
 * Dossier Assembler tests
 */

import { describe, it, expect } from 'vitest';
import {
  assembleDossier,
  createQuickDossier,
  validateDossier,
} from '../../src/intelligence/dossierAssembler.js';
import type { DataSources, AssemblerContext } from '../../src/intelligence/dossierAssembler.js';
import type { Meeting } from '../../src/types/meeting.js';

describe('Dossier Assembler', () => {
  function createMeeting(): Meeting {
    return {
      id: 'meeting-1',
      title: 'Toyota POC Check-in',
      datetime: new Date('2026-02-03T11:30:00'),
      duration: 30,
      attendees: [
        { email: 'user@toyota.com', name: 'Toyota User' },
        { email: 'andy@runlayer.com', name: 'Andy' },
      ],
      meetingLink: 'https://meet.google.com/abc-def-ghi',
    };
  }

  function createDataSources(): DataSources {
    return {
      fireflies: {
        transcripts: [
          {
            id: 'ff-1',
            title: 'Toyota POC Call',
            date: new Date('2026-01-29'),
            duration: 30,
            participants: ['user@toyota.com', 'andy@runlayer.com'],
            summary: 'Discussed POC timeline and success criteria',
            actionItems: [
              { text: 'Send AWS account IDs', assignee: 'user@toyota.com' },
            ],
            sentences: [],
          },
        ],
      },
      slack: {
        messages: [
          {
            channel: 'C123',
            user: 'U456',
            text: 'Toyota POC going well',
            timestamp: '2026-01-30T10:00:00Z',
          },
        ],
        mentions: [],
      },
      calendar: {
        events: [
          {
            id: 'cal-1',
            summary: 'Toyota Check-in',
            start: new Date('2026-02-03T11:30:00'),
            end: new Date('2026-02-03T12:00:00'),
            attendees: [
              { email: 'user@toyota.com', displayName: 'Toyota User' },
              { email: 'andy@runlayer.com', displayName: 'Andy' },
            ],
            status: 'confirmed',
          },
        ],
      },
    };
  }

  function createContext(): AssemblerContext {
    return {
      meeting: createMeeting(),
      accountName: 'Toyota',
      accountDomain: 'toyota.com',
      options: {
        daysOfHistory: 30,
      },
    };
  }

  describe('assembleDossier', () => {
    it('should assemble a complete dossier', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier).toBeDefined();
      expect(result.dossier.meeting.id).toBe('meeting-1');
      expect(result.dossier.account.name).toBe('Toyota');
    });

    it('should include executive summary', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.executiveSummary).toBeDefined();
      expect(result.dossier.executiveSummary.whyThisMeetingMatters).toBeTruthy();
      expect(result.dossier.executiveSummary.topGoals).toBeInstanceOf(Array);
    });

    it('should include external participants', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.externalParticipants.length).toBeGreaterThan(0);
      expect(result.dossier.externalParticipants.some(p => p.email === 'user@toyota.com')).toBe(true);
    });

    it('should include internal participants', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.internalParticipants.length).toBeGreaterThan(0);
      expect(result.dossier.internalParticipants.some(p => p.email === 'andy@runlayer.com')).toBe(true);
    });

    it('should include strategic insights', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.strategicInsights).toBeDefined();
      expect(result.dossier.strategicInsights.questionsToAsk).toBeInstanceOf(Array);
      expect(result.dossier.strategicInsights.needsAttention).toBeInstanceOf(Array);
    });

    it('should include talking points', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.talkingPoints).toBeInstanceOf(Array);
      expect(result.dossier.talkingPoints.length).toBeGreaterThan(0);
    });

    it('should include metadata', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.dossier.metadata).toBeDefined();
      expect(result.dossier.metadata.generatedAt).toBeInstanceOf(Date);
      expect(result.dossier.metadata.dataSourcesUsed).toContain('Fireflies');
      expect(result.dossier.metadata.dataSourcesUsed).toContain('Calendar');
      expect(result.dossier.metadata.processingTimeMs).toBeDefined();
    });

    it('should return intermediate data', () => {
      const context = createContext();
      const sources = createDataSources();

      const result = assembleDossier(context, sources);

      expect(result.intermediate).toBeDefined();
      expect(result.intermediate.mergedData).toBeDefined();
      expect(result.intermediate.analysis).toBeDefined();
      expect(result.intermediate.profiles).toBeInstanceOf(Map);
      expect(result.intermediate.goals).toBeInstanceOf(Array);
      expect(result.intermediate.talkingPoints).toBeInstanceOf(Array);
    });

    it('should handle empty data sources gracefully', () => {
      const context = createContext();
      const sources: DataSources = {
        fireflies: { transcripts: [] },
        slack: { messages: [], mentions: [] },
        calendar: { events: [] },
      };

      const result = assembleDossier(context, sources);

      expect(result.dossier).toBeDefined();
      expect(result.dossier.account.name).toBe('Toyota');
    });
  });

  describe('createQuickDossier', () => {
    it('should create a minimal dossier', () => {
      const meeting = createMeeting();
      const dossier = createQuickDossier(meeting, 'Toyota', 'toyota.com');

      expect(dossier.meeting).toBe(meeting);
      expect(dossier.account.name).toBe('Toyota');
      expect(dossier.executiveSummary).toBeDefined();
      expect(dossier.talkingPoints.length).toBeGreaterThan(0);
    });

    it('should separate external and internal participants', () => {
      const meeting = createMeeting();
      const dossier = createQuickDossier(meeting, 'Toyota', 'toyota.com');

      expect(dossier.externalParticipants.length).toBe(1);
      expect(dossier.internalParticipants.length).toBe(1);
    });

    it('should include default strategic insights', () => {
      const meeting = createMeeting();
      const dossier = createQuickDossier(meeting, 'Toyota', 'toyota.com');

      expect(dossier.strategicInsights.needsAttention.length).toBeGreaterThan(0);
      expect(dossier.strategicInsights.questionsToAsk.length).toBeGreaterThan(0);
    });
  });

  describe('validateDossier', () => {
    it('should validate a complete dossier', () => {
      const context = createContext();
      const sources = createDataSources();
      const result = assembleDossier(context, sources);

      const validation = validateDossier(result.dossier);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing meeting title', () => {
      const meeting = createMeeting();
      meeting.title = '';
      const dossier = createQuickDossier(meeting, 'Toyota', 'toyota.com');

      const validation = validateDossier(dossier);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Missing meeting title');
    });

    it('should detect missing account name', () => {
      const meeting = createMeeting();
      const dossier = createQuickDossier(meeting, '', 'toyota.com');

      const validation = validateDossier(dossier);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Missing account name');
    });

    it('should detect missing external participants', () => {
      const meeting: Meeting = {
        id: 'meeting-1',
        title: 'Internal Meeting',
        datetime: new Date(),
        duration: 30,
        attendees: [
          { email: 'andy@runlayer.com', name: 'Andy' },
        ],
      };
      const dossier = createQuickDossier(meeting, 'Toyota', 'toyota.com');

      const validation = validateDossier(dossier);

      expect(validation.issues).toContain('No external participants identified');
    });
  });
});
