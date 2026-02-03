/**
 * Fireflies client tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildSearchQuery,
  getSearchTranscriptsQuery,
  getTranscriptQuery,
  getSummaryQuery,
  parseSearchResults,
  parseTranscript,
  parseSummary,
  convertActionItems,
  getDefaultDateRange,
} from '../../src/sources/fireflies.js';

describe('Fireflies Client', () => {
  describe('buildSearchQuery', () => {
    it('should build a basic keyword query', () => {
      const query = buildSearchQuery('Toyota');
      expect(query).toBe('keyword:"Toyota"');
    });

    it('should include scope when provided', () => {
      const query = buildSearchQuery('Toyota', { scope: 'title' });
      expect(query).toBe('keyword:"Toyota" scope:title');
    });

    it('should include date filters when provided', () => {
      const query = buildSearchQuery('Toyota', {
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
      });
      expect(query).toContain('from:2025-01-01');
      expect(query).toContain('to:2025-01-31');
    });

    it('should include limit when provided', () => {
      const query = buildSearchQuery('Toyota', { limit: 20 });
      expect(query).toContain('limit:20');
    });

    it('should cap limit at 50', () => {
      const query = buildSearchQuery('Toyota', { limit: 100 });
      expect(query).toContain('limit:50');
    });

    it('should include participants filter', () => {
      const query = buildSearchQuery('Toyota', {
        participants: ['user@example.com', 'other@example.com'],
      });
      expect(query).toContain('participants:user@example.com,other@example.com');
    });
  });

  describe('getSearchTranscriptsQuery', () => {
    it('should return correct tool and params', () => {
      const result = getSearchTranscriptsQuery({ accountName: 'Toyota' });
      expect(result.tool).toBe('fireflies__fireflies_search');
      expect(result.params.format).toBe('json');
      expect(result.params.query).toContain('keyword:"Toyota"');
    });
  });

  describe('getTranscriptQuery', () => {
    it('should return correct tool and params', () => {
      const result = getTranscriptQuery('abc123');
      expect(result.tool).toBe('fireflies__fireflies_get_transcript');
      expect(result.params.transcriptId).toBe('abc123');
    });
  });

  describe('getSummaryQuery', () => {
    it('should return correct tool and params', () => {
      const result = getSummaryQuery('abc123');
      expect(result.tool).toBe('fireflies__fireflies_get_summary');
      expect(result.params.transcriptId).toBe('abc123');
    });
  });

  describe('parseSearchResults', () => {
    it('should parse valid search results', () => {
      const mockResponse = [
        {
          id: '123',
          title: 'Toyota Call',
          date: '2025-01-15T10:00:00Z',
          duration: 30,
          participants: ['a@example.com', 'b@example.com'],
          summary: 'Discussion about POC',
        },
      ];

      const results = parseSearchResults(mockResponse);
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('123');
      expect(results[0]?.title).toBe('Toyota Call');
      expect(results[0]?.participantEmails).toEqual(['a@example.com', 'b@example.com']);
    });

    it('should handle empty response', () => {
      const results = parseSearchResults([]);
      expect(results).toHaveLength(0);
    });

    it('should skip invalid items', () => {
      const mockResponse = [
        { id: '123', title: 'Valid', date: '2025-01-15T10:00:00Z', duration: 30 },
        { invalid: 'item' },
      ];

      const results = parseSearchResults(mockResponse);
      expect(results).toHaveLength(1);
    });
  });

  describe('parseTranscript', () => {
    it('should parse valid transcript', () => {
      const mockResponse = {
        id: '123',
        title: 'Toyota Call',
        date: '2025-01-15T10:00:00Z',
        duration: 30,
        participants: ['user@example.com'],
        sentences: [
          {
            index: 0,
            speaker_name: 'John',
            text: 'Hello',
            start_time: 0,
            end_time: 2,
          },
        ],
      };

      const result = parseTranscript(mockResponse);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('123');
      expect(result?.sentences).toHaveLength(1);
      expect(result?.sentences?.[0]?.speaker).toBe('John');
    });

    it('should return null for invalid transcript', () => {
      const result = parseTranscript({ invalid: 'data' });
      expect(result).toBeNull();
    });
  });

  describe('parseSummary', () => {
    it('should parse valid summary', () => {
      const mockResponse = {
        id: '123',
        title: 'Toyota Call',
        summary: 'Discussed POC timeline',
        overview: 'Overview text',
        action_items: [
          { text: 'Send docs', assignee: 'John' },
        ],
        keywords: ['poc', 'timeline'],
      };

      const result = parseSummary(mockResponse);
      expect(result).not.toBeNull();
      expect(result?.summary).toBe('Discussed POC timeline');
      expect(result?.actionItems).toHaveLength(1);
      expect(result?.keywords).toContain('poc');
    });
  });

  describe('convertActionItems', () => {
    it('should convert action items correctly', () => {
      const items = [
        { text: 'Send AWS account IDs', assignee: 'user@external.com' },
        { text: 'Update documentation', assignee: 'internal' },
      ];

      const converted = convertActionItems(items, 'Jan 15 call');
      expect(converted).toHaveLength(2);
      expect(converted[0]?.owner).toBe('theirs'); // External email
      expect(converted[1]?.owner).toBe('ours'); // Internal
      expect(converted[0]?.source).toBe('Jan 15 call');
    });
  });

  describe('getDefaultDateRange', () => {
    it('should return date range with correct span', () => {
      const range = getDefaultDateRange(30);
      const daysDiff = Math.round(
        (range.toDate.getTime() - range.fromDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(31);
    });
  });
});
