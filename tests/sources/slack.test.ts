/**
 * Slack client tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildSearchQuery,
  getSearchMessagesQuery,
  getThreadMessagesQuery,
  getFetchMessageQuery,
  parseSearchResults,
  parseThreadMessages,
  getAccountMentionsQuery,
  extractContext,
  detectSentiment,
  convertToMentions,
} from '../../src/sources/slack.js';

describe('Slack Client', () => {
  describe('buildSearchQuery', () => {
    it('should build a basic keyword query', () => {
      const query = buildSearchQuery('Toyota');
      expect(query).toBe('Toyota');
    });

    it('should quote keywords with spaces', () => {
      const query = buildSearchQuery('Toyota POC');
      expect(query).toBe('"Toyota POC"');
    });

    it('should include date filters', () => {
      const query = buildSearchQuery('Toyota', {
        afterDate: new Date('2025-01-01'),
        beforeDate: new Date('2025-01-31'),
      });
      expect(query).toContain('after:2025-01-01');
      expect(query).toContain('before:2025-01-31');
    });

    it('should calculate date from daysBack', () => {
      const query = buildSearchQuery('Toyota', { daysBack: 30 });
      expect(query).toContain('after:');
    });

    it('should include channel filters without parentheses', () => {
      const query = buildSearchQuery('Toyota', {
        channels: ['sales-deals', 'general'],
      });
      expect(query).toContain('in:#sales-deals OR in:#general');
      expect(query).not.toContain('(');
    });

    it('should include user filter', () => {
      const query = buildSearchQuery('Toyota', { fromUser: 'john.doe' });
      expect(query).toContain('from:@john.doe');
    });
  });

  describe('getSearchMessagesQuery', () => {
    it('should return correct tool and params', () => {
      const result = getSearchMessagesQuery({
        query: 'Toyota',
        options: { limit: 50, sort: 'timestamp' },
      });
      expect(result.tool).toBe('slack_search');
      expect(result.params.count).toBe(50);
      expect(result.params.sort).toBe('timestamp');
    });
  });

  describe('getThreadMessagesQuery', () => {
    it('should return correct tool and params', () => {
      const result = getThreadMessagesQuery('sales-deals', '1234567890.123456');
      expect(result.tool).toBe('slack_get_thread_messages');
      expect(result.params.channel).toBe('sales-deals');
      expect(result.params.thread_ts).toBe('1234567890.123456');
    });

    it('should strip # from channel name', () => {
      const result = getThreadMessagesQuery('#sales-deals', '1234567890.123456');
      expect(result.params.channel).toBe('sales-deals');
    });
  });

  describe('getFetchMessageQuery', () => {
    it('should return correct tool and params', () => {
      const result = getFetchMessageQuery('sales-deals', '1234567890.123456');
      expect(result.tool).toBe('slack_fetch');
      expect(result.params.channel).toBe('sales-deals');
      expect(result.params.ts).toBe('1234567890.123456');
    });
  });

  describe('parseSearchResults', () => {
    it('should parse valid search results', () => {
      const mockResponse = {
        messages: {
          matches: [
            {
              channel: 'C123',
              channel_name: 'sales-deals',
              user: 'U456',
              username: 'john.doe',
              text: 'Toyota POC update',
              ts: '1234567890.123456',
              permalink: 'https://slack.com/...',
            },
          ],
        },
      };

      const results = parseSearchResults(mockResponse);
      expect(results).toHaveLength(1);
      expect(results[0]?.channel).toBe('C123');
      expect(results[0]?.channelName).toBe('sales-deals');
      expect(results[0]?.text).toBe('Toyota POC update');
    });

    it('should handle direct array response', () => {
      const mockResponse = [
        {
          channel: 'C123',
          user: 'U456',
          text: 'Message',
          ts: '1234567890.123456',
        },
      ];

      const results = parseSearchResults(mockResponse);
      expect(results).toHaveLength(1);
    });

    it('should handle empty response', () => {
      const results = parseSearchResults({ messages: { matches: [] } });
      expect(results).toHaveLength(0);
    });
  });

  describe('parseThreadMessages', () => {
    it('should parse thread messages', () => {
      const mockResponse = [
        {
          channel: 'C123',
          user: 'U456',
          text: 'Reply 1',
          ts: '1234567890.123457',
          thread_ts: '1234567890.123456',
        },
        {
          channel: 'C123',
          user: 'U789',
          text: 'Reply 2',
          ts: '1234567890.123458',
          thread_ts: '1234567890.123456',
        },
      ];

      const results = parseThreadMessages(mockResponse);
      expect(results).toHaveLength(2);
      expect(results[0]?.text).toBe('Reply 1');
      expect(results[1]?.text).toBe('Reply 2');
    });
  });

  describe('getAccountMentionsQuery', () => {
    it('should return query for account mentions', () => {
      const result = getAccountMentionsQuery('Toyota', 30);
      expect(result.tool).toBe('slack_search');
      expect(result.params.query).toContain('Toyota');
      expect(result.params.sort).toBe('timestamp');
    });
  });

  describe('extractContext', () => {
    it('should extract context around keyword', () => {
      const text = 'This is a long message about Toyota and their POC progress.';
      const context = extractContext(text, 'Toyota', 10);
      expect(context).toContain('Toyota');
    });

    it('should handle keyword not found', () => {
      const text = 'This message does not mention the company.';
      const context = extractContext(text, 'Toyota', 10);
      expect(context.length).toBeGreaterThan(0);
    });
  });

  describe('detectSentiment', () => {
    it('should detect positive sentiment', () => {
      expect(detectSentiment('Great progress on the Toyota deal!')).toBe('positive');
      expect(detectSentiment('Excellent meeting, they loved it')).toBe('positive');
    });

    it('should detect negative sentiment', () => {
      expect(detectSentiment('There is a problem with the timeline')).toBe('negative');
      expect(detectSentiment('Deal is at risk, concerned about delays')).toBe('negative');
    });

    it('should detect neutral sentiment', () => {
      expect(detectSentiment('Meeting scheduled for tomorrow')).toBe('neutral');
    });
  });

  describe('convertToMentions', () => {
    it('should convert messages to mentions with context and sentiment', () => {
      const messages = [
        {
          channel: 'C123',
          user: 'U456',
          text: 'Great progress on Toyota POC!',
          timestamp: '1234567890.123456',
        },
      ];

      const mentions = convertToMentions(messages, 'Toyota');
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.context).toContain('Toyota');
      expect(mentions[0]?.sentiment).toBe('positive');
    });
  });
});
