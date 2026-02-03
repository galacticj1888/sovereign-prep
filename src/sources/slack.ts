/**
 * Slack MCP Client
 *
 * Wrapper for Slack MCP tools via account-intelligence plugin.
 * Provides typed interfaces for message search and retrieval.
 *
 * MCP Tools used:
 * - slack_search: Search messages across all channels
 * - slack_get_thread_messages: Get thread replies
 * - slack_fetch: Fetch specific message by channel/timestamp
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { formatISODate, getDateDaysAgo } from '../utils/dateUtils.js';

// --- Types ---

export interface SlackSearchOptions {
  daysBack?: number;
  afterDate?: Date;
  beforeDate?: Date;
  channels?: string[];
  fromUser?: string;
  limit?: number;
  sort?: 'score' | 'timestamp';
  sortDir?: 'asc' | 'desc';
}

export interface SlackMessage {
  channel: string;
  channelName?: string;
  user: string;
  userName?: string;
  text: string;
  timestamp: string;
  permalink?: string;
  threadTs?: string;
  replyCount?: number;
}

export interface SlackThread {
  parentMessage: SlackMessage;
  replies: SlackMessage[];
}

export interface SlackMention {
  message: SlackMessage;
  context?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

// --- Zod Schemas for MCP Response Validation ---

const SlackMessageSchema = z.object({
  channel: z.string(),
  channel_name: z.string().optional(),
  user: z.string(),
  username: z.string().optional(),
  text: z.string(),
  ts: z.string(),
  permalink: z.string().optional(),
  thread_ts: z.string().optional(),
  reply_count: z.number().optional(),
});

// --- Query Builder ---

/**
 * Build a Slack search query string
 *
 * Slack search modifiers:
 * - from:@username - Messages from a user
 * - to:@username - Messages to a user
 * - in:#channel - Messages in a channel
 * - after:YYYY-MM-DD - Messages after date
 * - before:YYYY-MM-DD - Messages before date
 * - on:YYYY-MM-DD - Messages on specific date
 *
 * Note: Do NOT wrap OR clauses in parentheses - Slack may return 0 results
 */
export function buildSearchQuery(keyword: string, options: SlackSearchOptions = {}): string {
  const parts: string[] = [];

  // Add keyword (quoted for exact match if contains spaces)
  if (keyword.includes(' ')) {
    parts.push(`"${keyword}"`);
  } else {
    parts.push(keyword);
  }

  // Add date filters
  if (options.afterDate) {
    parts.push(`after:${formatISODate(options.afterDate)}`);
  } else if (options.daysBack) {
    parts.push(`after:${formatISODate(getDateDaysAgo(options.daysBack))}`);
  }

  if (options.beforeDate) {
    parts.push(`before:${formatISODate(options.beforeDate)}`);
  }

  // Add channel filters (use OR without parentheses)
  if (options.channels && options.channels.length > 0) {
    const channelFilters = options.channels
      .map(c => `in:${c.startsWith('#') ? c : `#${c}`}`)
      .join(' OR ');
    parts.push(channelFilters);
  }

  // Add user filter
  if (options.fromUser) {
    parts.push(`from:${options.fromUser.startsWith('@') ? options.fromUser : `@${options.fromUser}`}`);
  }

  return parts.join(' ');
}

// --- MCP Tool Interfaces ---

/**
 * Search for messages across all channels
 *
 * MCP Tool: slack_search
 *
 * @example
 * // MCP call:
 * slack_search({
 *   query: 'Toyota after:2025-01-01',
 *   count: 50,
 *   sort: 'timestamp',
 *   sort_dir: 'desc'
 * })
 */
export interface SearchMessagesParams {
  query: string;
  options?: SlackSearchOptions;
}

export function getSearchMessagesQuery(params: SearchMessagesParams): {
  tool: string;
  params: {
    query: string;
    count: number;
    sort: string;
    sort_dir: string;
  };
} {
  const query = buildSearchQuery(params.query, params.options);

  return {
    tool: 'slack_search',
    params: {
      query,
      count: params.options?.limit ?? 50,
      sort: params.options?.sort ?? 'timestamp',
      sort_dir: params.options?.sortDir ?? 'desc',
    },
  };
}

/**
 * Get all messages in a thread
 *
 * MCP Tool: slack_get_thread_messages
 *
 * @example
 * // MCP call:
 * slack_get_thread_messages({
 *   channel: 'sales-deals',
 *   thread_ts: '1234567890.123456'
 * })
 */
export function getThreadMessagesQuery(
  channel: string,
  threadTs: string
): {
  tool: string;
  params: { channel: string; thread_ts: string };
} {
  return {
    tool: 'slack_get_thread_messages',
    params: {
      channel: channel.startsWith('#') ? channel.slice(1) : channel,
      thread_ts: threadTs,
    },
  };
}

/**
 * Fetch a specific message by channel and timestamp
 *
 * MCP Tool: slack_fetch
 *
 * @example
 * // MCP call:
 * slack_fetch({
 *   channel: 'sales-deals',
 *   ts: '1234567890.123456'
 * })
 */
export function getFetchMessageQuery(
  channel: string,
  timestamp: string
): {
  tool: string;
  params: { channel: string; ts: string };
} {
  return {
    tool: 'slack_fetch',
    params: {
      channel: channel.startsWith('#') ? channel.slice(1) : channel,
      ts: timestamp,
    },
  };
}

// --- Response Parsers ---

/**
 * Parse search results from MCP response
 */
export function parseSearchResults(response: unknown): SlackMessage[] {
  const log = logger.child('slack');

  try {
    // Handle different response formats
    let matches: unknown[] = [];

    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;

      // Format 1: { messages: { matches: [...] } }
      if (obj['messages'] && typeof obj['messages'] === 'object') {
        const messages = obj['messages'] as Record<string, unknown>;
        if (Array.isArray(messages['matches'])) {
          matches = messages['matches'];
        }
      }
      // Format 2: Direct array
      else if (Array.isArray(response)) {
        matches = response;
      }
    }

    const parsed: SlackMessage[] = [];

    for (const item of matches) {
      const result = SlackMessageSchema.safeParse(item);
      if (!result.success) {
        log.warn('Failed to parse message:', result.error.message);
        continue;
      }

      parsed.push({
        channel: result.data.channel,
        channelName: result.data.channel_name,
        user: result.data.user,
        userName: result.data.username,
        text: result.data.text,
        timestamp: result.data.ts,
        permalink: result.data.permalink,
        threadTs: result.data.thread_ts,
        replyCount: result.data.reply_count,
      });
    }

    return parsed;
  } catch (error) {
    log.error('Error parsing search results:', error);
    return [];
  }
}

/**
 * Parse thread messages from MCP response
 */
export function parseThreadMessages(response: unknown): SlackMessage[] {
  const log = logger.child('slack');

  try {
    // Thread messages are typically returned as an array
    const messages = Array.isArray(response) ? response : [];
    const parsed: SlackMessage[] = [];

    for (const item of messages) {
      const result = SlackMessageSchema.safeParse(item);
      if (!result.success) {
        log.warn('Failed to parse thread message:', result.error.message);
        continue;
      }

      parsed.push({
        channel: result.data.channel,
        channelName: result.data.channel_name,
        user: result.data.user,
        userName: result.data.username,
        text: result.data.text,
        timestamp: result.data.ts,
        permalink: result.data.permalink,
        threadTs: result.data.thread_ts,
      });
    }

    return parsed;
  } catch (error) {
    log.error('Error parsing thread messages:', error);
    return [];
  }
}

// --- Utility Functions ---

/**
 * Get account mentions with search query
 *
 * Returns the query configuration for searching account mentions
 */
export function getAccountMentionsQuery(
  accountName: string,
  daysBack: number = 30
): ReturnType<typeof getSearchMessagesQuery> {
  return getSearchMessagesQuery({
    query: accountName,
    options: {
      daysBack,
      sort: 'timestamp',
      sortDir: 'desc',
      limit: 50,
    },
  });
}

/**
 * Extract a snippet of context around a keyword in message text
 */
export function extractContext(text: string, keyword: string, contextLength: number = 100): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return text.slice(0, contextLength * 2) + (text.length > contextLength * 2 ? '...' : '');
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + keyword.length + contextLength);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Simple sentiment detection based on keywords
 * (Basic implementation - can be enhanced with ML later)
 */
export function detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    'great',
    'awesome',
    'excellent',
    'good',
    'love',
    'amazing',
    'excited',
    'happy',
    'progress',
    'success',
    'won',
    'closed',
    'signed',
  ];

  const negativeWords = [
    'bad',
    'issue',
    'problem',
    'concerned',
    'worried',
    'risk',
    'delay',
    'stuck',
    'blocked',
    'lost',
    'cancelled',
    'churned',
    'frustrated',
  ];

  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Convert Slack messages to account mentions with context
 */
export function convertToMentions(
  messages: SlackMessage[],
  accountName: string
): SlackMention[] {
  return messages.map(message => ({
    message,
    context: extractContext(message.text, accountName),
    sentiment: detectSentiment(message.text),
  }));
}
