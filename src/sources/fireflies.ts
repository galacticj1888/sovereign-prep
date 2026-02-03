/**
 * Fireflies MCP Client
 *
 * Wrapper for Fireflies MCP tools via account-intelligence plugin.
 * Provides typed interfaces for transcript search and retrieval.
 *
 * MCP Tools used:
 * - fireflies__fireflies_search: Advanced search with mini grammar
 * - fireflies__fireflies_get_transcript: Get detailed transcript by ID
 * - fireflies__fireflies_get_summary: Get meeting summary and action items
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { formatISODate, getDateDaysAgo } from '../utils/dateUtils.js';
import type { ActionItem } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface FirefliesSearchOptions {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  scope?: 'title' | 'sentences' | 'all';
  participants?: string[];
  organizers?: string[];
}

export interface FirefliesSearchResult {
  id: string;
  title: string;
  date: Date;
  duration: number; // in minutes
  participantEmails: string[];
  summary?: string;
}

export interface FirefliesSentence {
  index: number;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface FirefliesActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: Date;
  duration: number;
  participants: string[];
  organizerEmail?: string;
  summary?: string;
  overview?: string;
  actionItems: FirefliesActionItem[];
  sentences: FirefliesSentence[];
  keywords?: string[];
}

// ============================================================================
// Zod Schemas for MCP Response Validation
// ============================================================================

const FirefliesSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().transform(s => new Date(s)),
  duration: z.number(),
  participants: z.array(z.string()).optional().default([]),
  summary: z.string().optional(),
});

const FirefliesTranscriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().transform(s => new Date(s)),
  duration: z.number().optional().default(0),
  participants: z.array(z.string()).optional().default([]),
  organizer_email: z.string().optional(),
  sentences: z
    .array(
      z.object({
        index: z.number(),
        speaker_name: z.string(),
        text: z.string(),
        start_time: z.number(),
        end_time: z.number(),
      })
    )
    .optional()
    .default([]),
});

const FirefliesSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  overview: z.string().optional(),
  action_items: z
    .array(
      z.object({
        text: z.string(),
        assignee: z.string().optional(),
        due_date: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  keywords: z.array(z.string()).optional().default([]),
});

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Build a Fireflies search query using the mini grammar
 *
 * Grammar syntax:
 * - keyword:"search term" - Search for keywords
 * - scope:title|sentences|all - Define search scope
 * - from:YYYY-MM-DD - Filter meetings from this date
 * - to:YYYY-MM-DD - Filter meetings until this date
 * - limit:N - Limit results (max 50)
 * - participants:email1,email2 - Filter by participant emails
 * - organizers:email1,email2 - Filter by organizer emails
 */
export function buildSearchQuery(
  keyword: string,
  options: FirefliesSearchOptions = {}
): string {
  const parts: string[] = [];

  // Add keyword search
  parts.push(`keyword:"${keyword}"`);

  // Add scope
  if (options.scope) {
    parts.push(`scope:${options.scope}`);
  }

  // Add date filters
  if (options.fromDate) {
    parts.push(`from:${formatISODate(options.fromDate)}`);
  }
  if (options.toDate) {
    parts.push(`to:${formatISODate(options.toDate)}`);
  }

  // Add limit
  if (options.limit) {
    parts.push(`limit:${Math.min(options.limit, 50)}`);
  }

  // Add participants filter
  if (options.participants && options.participants.length > 0) {
    parts.push(`participants:${options.participants.join(',')}`);
  }

  // Add organizers filter
  if (options.organizers && options.organizers.length > 0) {
    parts.push(`organizers:${options.organizers.join(',')}`);
  }

  return parts.join(' ');
}

// ============================================================================
// MCP Tool Interfaces
// ============================================================================

/**
 * Search transcripts by account name or keyword
 *
 * MCP Tool: fireflies__fireflies_search
 *
 * @example
 * // MCP call:
 * fireflies__fireflies_search({
 *   query: 'keyword:"Toyota" scope:all from:2025-01-01 limit:20'
 * })
 */
export interface SearchTranscriptsParams {
  accountName: string;
  options?: FirefliesSearchOptions;
}

export function getSearchTranscriptsQuery(params: SearchTranscriptsParams): {
  tool: string;
  params: { query: string; format: string };
} {
  const query = buildSearchQuery(params.accountName, {
    ...params.options,
    scope: params.options?.scope ?? 'all',
    limit: params.options?.limit ?? 20,
  });

  return {
    tool: 'fireflies__fireflies_search',
    params: { query, format: 'json' },
  };
}

/**
 * Get detailed transcript by ID
 *
 * MCP Tool: fireflies__fireflies_get_transcript
 *
 * @example
 * // MCP call:
 * fireflies__fireflies_get_transcript({
 *   transcriptId: '01KG15APPNMB0D1KQ25TTMQXRE'
 * })
 */
export function getTranscriptQuery(transcriptId: string): {
  tool: string;
  params: { transcriptId: string };
} {
  return {
    tool: 'fireflies__fireflies_get_transcript',
    params: { transcriptId },
  };
}

/**
 * Get meeting summary and action items by ID
 *
 * MCP Tool: fireflies__fireflies_get_summary
 *
 * @example
 * // MCP call:
 * fireflies__fireflies_get_summary({
 *   transcriptId: '01KG15APPNMB0D1KQ25TTMQXRE'
 * })
 */
export function getSummaryQuery(transcriptId: string): {
  tool: string;
  params: { transcriptId: string };
} {
  return {
    tool: 'fireflies__fireflies_get_summary',
    params: { transcriptId },
  };
}

// ============================================================================
// Response Parsers
// ============================================================================

/**
 * Parse search results from MCP response
 */
export function parseSearchResults(response: unknown): FirefliesSearchResult[] {
  const log = logger.child('fireflies');

  try {
    // Handle array response
    const results = Array.isArray(response) ? response : [];
    const parsed: FirefliesSearchResult[] = [];

    for (const item of results) {
      const result = FirefliesSearchResultSchema.safeParse(item);
      if (!result.success) {
        log.warn('Failed to parse search result:', result.error.message);
        continue;
      }
      parsed.push({
        id: result.data.id,
        title: result.data.title,
        date: result.data.date,
        duration: result.data.duration,
        participantEmails: result.data.participants,
        summary: result.data.summary,
      });
    }

    return parsed;
  } catch (error) {
    log.error('Error parsing search results:', error);
    return [];
  }
}

/**
 * Parse transcript details from MCP response
 */
export function parseTranscript(response: unknown): Partial<FirefliesTranscript> | null {
  const log = logger.child('fireflies');

  try {
    const parsed = FirefliesTranscriptSchema.safeParse(response);
    if (!parsed.success) {
      log.warn('Failed to parse transcript:', parsed.error.message);
      return null;
    }

    return {
      id: parsed.data.id,
      title: parsed.data.title,
      date: parsed.data.date,
      duration: parsed.data.duration,
      participants: parsed.data.participants,
      organizerEmail: parsed.data.organizer_email,
      sentences: parsed.data.sentences.map(s => ({
        index: s.index,
        speaker: s.speaker_name,
        text: s.text,
        startTime: s.start_time,
        endTime: s.end_time,
      })),
    };
  } catch (error) {
    log.error('Error parsing transcript:', error);
    return null;
  }
}

/**
 * Parse summary from MCP response
 */
export function parseSummary(
  response: unknown
): Pick<FirefliesTranscript, 'summary' | 'overview' | 'actionItems' | 'keywords'> | null {
  const log = logger.child('fireflies');

  try {
    const parsed = FirefliesSummarySchema.safeParse(response);
    if (!parsed.success) {
      log.warn('Failed to parse summary:', parsed.error.message);
      return null;
    }

    return {
      summary: parsed.data.summary,
      overview: parsed.data.overview,
      actionItems: parsed.data.action_items.map(ai => ({
        text: ai.text,
        assignee: ai.assignee,
        dueDate: ai.due_date,
      })),
      keywords: parsed.data.keywords,
    };
  } catch (error) {
    log.error('Error parsing summary:', error);
    return null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Fireflies action items to our ActionItem type
 */
export function convertActionItems(
  firefliesItems: FirefliesActionItem[],
  source: string
): ActionItem[] {
  return firefliesItems.map((item, index) => ({
    id: `ff-${index}`,
    description: item.text,
    owner: item.assignee?.includes('@') ? 'theirs' : 'ours',
    assignee: item.assignee,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    createdDate: new Date(),
    status: 'pending',
    source,
  }));
}

/**
 * Get the default date range for transcript search (last N days)
 */
export function getDefaultDateRange(daysBack: number = 30): {
  fromDate: Date;
  toDate: Date;
} {
  return {
    fromDate: getDateDaysAgo(daysBack),
    toDate: new Date(),
  };
}
