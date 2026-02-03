/**
 * Data Merger tests
 */

import { describe, it, expect } from 'vitest';
import {
  mergeAllData,
  markOverdueItems,
  getUniqueParticipantEmails,
  getExternalParticipantEmails,
} from '../../src/intelligence/merger.js';
import type { FirefliesTranscript } from '../../src/sources/fireflies.js';
import type { SlackMessage, SlackMention } from '../../src/sources/slack.js';
import type { CalendarEvent } from '../../src/sources/calendar.js';
import type { ActionItem } from '../../src/types/index.js';

describe('Data Merger', () => {
  const baseOptions = {
    accountName: 'Toyota',
    accountDomain: 'toyota.com',
    daysOfHistory: 30,
  };

  describe('mergeAllData', () => {
    it('should merge Fireflies transcript data', () => {
      const fireflies = {
        transcripts: [
          {
            id: 'ff-1',
            title: 'Toyota POC Call',
            date: new Date('2026-01-29'),
            duration: 30,
            participants: ['user@toyota.com', 'andy@runlayer.com'],
            summary: 'Discussed POC timeline',
            actionItems: [
              { text: 'Send AWS account IDs', assignee: 'user@toyota.com' },
            ],
            sentences: [],
          } as FirefliesTranscript,
        ],
      };

      const slack = { mentions: [], messages: [] };
      const calendar = { events: [] };

      const result = mergeAllData(fireflies, slack, calendar, baseOptions);

      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0]?.type).toBe('call');
      expect(result.participants.has('user@toyota.com')).toBe(true);
      expect(result.actionItems).toHaveLength(1);
    });

    it('should merge Slack message data', () => {
      const fireflies = { transcripts: [] };
      const slack = {
        messages: [
          {
            channel: 'C123',
            user: 'U456',
            text: 'Toyota update: POC going well',
            timestamp: '2026-01-29T10:00:00Z',
          } as SlackMessage,
          {
            channel: 'C123',
            user: 'U789',
            text: 'Toyota needs AWS IDs',
            timestamp: '2026-01-29T11:00:00Z',
          } as SlackMessage,
          {
            channel: 'C123',
            user: 'U456',
            text: 'Toyota call scheduled',
            timestamp: '2026-01-29T12:00:00Z',
          } as SlackMessage,
        ],
        mentions: [],
      };
      const calendar = { events: [] };

      const result = mergeAllData(fireflies, slack, calendar, baseOptions);

      // Should create a timeline event for significant Slack activity
      expect(result.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it('should merge Calendar event data', () => {
      const fireflies = { transcripts: [] };
      const slack = { mentions: [], messages: [] };
      const calendar = {
        events: [
          {
            id: 'cal-1',
            summary: 'Toyota Check-in',
            description: 'Weekly check-in',
            start: new Date('2026-02-03T11:30:00'),
            end: new Date('2026-02-03T12:00:00'),
            attendees: [
              { email: 'user@toyota.com', displayName: 'User' },
              { email: 'andy@runlayer.com', displayName: 'Andy' },
            ],
            status: 'confirmed',
          } as CalendarEvent,
        ],
      };

      const result = mergeAllData(fireflies, slack, calendar, baseOptions);

      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0]?.type).toBe('meeting');
      expect(result.participants.has('user@toyota.com')).toBe(true);
    });

    it('should deduplicate participants across sources', () => {
      const email = 'user@toyota.com';

      const fireflies = {
        transcripts: [
          {
            id: 'ff-1',
            title: 'Call 1',
            date: new Date('2026-01-25'),
            duration: 30,
            participants: [email],
            sentences: [],
          } as FirefliesTranscript,
        ],
      };

      const slack = { mentions: [], messages: [] };
      const calendar = {
        events: [
          {
            id: 'cal-1',
            summary: 'Meeting',
            start: new Date('2026-01-28'),
            end: new Date('2026-01-28'),
            attendees: [{ email, displayName: 'User Name' }],
            status: 'confirmed',
          } as CalendarEvent,
        ],
      };

      const result = mergeAllData(fireflies, slack, calendar, baseOptions);

      // Should only have one participant entry
      expect(result.participants.size).toBe(1);
      expect(result.participants.get(email)).toBeDefined();

      // Should have combined interactions
      const participant = result.participants.get(email);
      expect(participant?.previousInteractions?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('markOverdueItems', () => {
    it('should mark items with past due dates as overdue', () => {
      const items: ActionItem[] = [
        {
          id: '1',
          description: 'Task 1',
          owner: 'ours',
          createdDate: new Date('2026-01-01'),
          dueDate: new Date('2026-01-15'),
          status: 'pending',
        },
        {
          id: '2',
          description: 'Task 2',
          owner: 'theirs',
          createdDate: new Date('2026-01-01'),
          status: 'pending',
        },
      ];

      const result = markOverdueItems(items);

      expect(result[0]?.status).toBe('overdue');
      expect(result[0]?.daysOverdue).toBeGreaterThan(0);
      expect(result[1]?.status).toBe('pending'); // No due date, stays pending
    });

    it('should not change already completed items', () => {
      const items: ActionItem[] = [
        {
          id: '1',
          description: 'Task 1',
          owner: 'ours',
          createdDate: new Date('2026-01-01'),
          dueDate: new Date('2026-01-15'),
          status: 'completed',
        },
      ];

      const result = markOverdueItems(items);

      expect(result[0]?.status).toBe('completed');
    });
  });

  describe('getUniqueParticipantEmails', () => {
    it('should return all participant emails', () => {
      const result = {
        account: {},
        participants: new Map([
          ['a@example.com', { email: 'a@example.com' }],
          ['b@example.com', { email: 'b@example.com' }],
        ]),
        timeline: [],
        actionItems: [],
        meetings: [],
      };

      const emails = getUniqueParticipantEmails(result as ReturnType<typeof mergeAllData>);

      expect(emails).toHaveLength(2);
      expect(emails).toContain('a@example.com');
      expect(emails).toContain('b@example.com');
    });
  });

  describe('getExternalParticipantEmails', () => {
    it('should return only external participant emails', () => {
      const result = {
        account: {},
        participants: new Map([
          ['a@toyota.com', { email: 'a@toyota.com' }],
          ['b@runlayer.com', { email: 'b@runlayer.com' }],
        ]),
        timeline: [],
        actionItems: [],
        meetings: [],
      };

      const emails = getExternalParticipantEmails(result as ReturnType<typeof mergeAllData>);

      expect(emails).toHaveLength(1);
      expect(emails).toContain('a@toyota.com');
    });
  });
});
