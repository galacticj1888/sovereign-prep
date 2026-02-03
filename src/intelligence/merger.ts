/**
 * Data Merger & Normalizer
 *
 * Combines data from multiple sources (Fireflies, Slack, Calendar)
 * into unified Account and Participant models.
 */

import { logger } from '../utils/logger.js';
import { daysAgo } from '../utils/dateUtils.js';
import type {
  Account,
  TimelineEvent,
  ActionItem,
  Participant,
  Interaction,
  Meeting,
} from '../types/index.js';
import type { FirefliesTranscript, FirefliesActionItem } from '../sources/fireflies.js';
import type { SlackMessage, SlackMention } from '../sources/slack.js';
import type { CalendarEvent } from '../sources/calendar.js';
import { extractDomain, isInternalEmail } from '../sources/calendar.js';

// ============================================================================
// Types
// ============================================================================

export interface MergedData {
  account: Partial<Account>;
  participants: Map<string, Partial<Participant>>;
  timeline: TimelineEvent[];
  actionItems: ActionItem[];
  meetings: Meeting[];
}

export interface FirefliesData {
  transcripts: FirefliesTranscript[];
}

export interface SlackData {
  mentions: SlackMention[];
  messages: SlackMessage[];
}

export interface CalendarData {
  events: CalendarEvent[];
}

export interface MergeOptions {
  accountName: string;
  accountDomain: string;
  daysOfHistory?: number;
}

// ============================================================================
// Main Merger
// ============================================================================

/**
 * Merge data from all sources into unified models
 */
export function mergeAllData(
  fireflies: FirefliesData,
  slack: SlackData,
  calendar: CalendarData,
  options: MergeOptions
): MergedData {
  const log = logger.child('merger');
  log.info(`Merging data for account: ${options.accountName}`);

  // Initialize result
  const result: MergedData = {
    account: {
      name: options.accountName,
      domain: options.accountDomain,
      contacts: [],
      timeline: [],
      openActionItems: [],
      risks: [],
    },
    participants: new Map(),
    timeline: [],
    actionItems: [],
    meetings: [],
  };

  // Process each data source
  mergeFirefliesData(result, fireflies, options);
  mergeSlackData(result, slack, options);
  mergeCalendarData(result, calendar, options);

  // Post-processing
  deduplicateParticipants(result);
  sortTimeline(result);
  computeAccountMetrics(result);

  log.info(
    `Merged: ${result.timeline.length} events, ${result.participants.size} participants, ${result.actionItems.length} action items`
  );

  return result;
}

// ============================================================================
// Source-Specific Mergers
// ============================================================================

/**
 * Merge Fireflies transcript data
 */
function mergeFirefliesData(
  result: MergedData,
  data: FirefliesData,
  _options: MergeOptions
): void {
  const log = logger.child('merger:fireflies');

  for (const transcript of data.transcripts) {
    // Add to timeline
    const event: TimelineEvent = {
      id: `ff-${transcript.id}`,
      date: transcript.date,
      type: 'call',
      title: transcript.title,
      description: transcript.summary,
      participants: transcript.participants,
      duration: transcript.duration,
      transcriptId: transcript.id,
    };
    result.timeline.push(event);

    // Extract participants
    for (const email of transcript.participants) {
      if (isInternalEmail(email)) continue;

      const existing = result.participants.get(email) ?? {
        email,
        name: '',
        company: extractDomain(email) ?? '',
        title: '',
        role: 'unknown',
        influence: 'medium',
        previousInteractions: [],
      };

      // Add interaction
      const interaction: Interaction = {
        id: `ff-${transcript.id}`,
        date: transcript.date,
        type: 'call',
        title: transcript.title,
        duration: transcript.duration,
        summary: transcript.summary,
      };
      existing.previousInteractions = [
        ...(existing.previousInteractions ?? []),
        interaction,
      ];
      existing.lastInteractionDate = transcript.date;
      existing.totalInteractions = (existing.totalInteractions ?? 0) + 1;

      result.participants.set(email, existing);
    }

    // Extract action items
    if (transcript.actionItems) {
      for (const item of transcript.actionItems) {
        const actionItem = convertFirefliesActionItem(item, transcript);
        result.actionItems.push(actionItem);
      }
    }

    log.debug(`Processed transcript: ${transcript.title}`);
  }
}

/**
 * Merge Slack message data
 */
function mergeSlackData(
  result: MergedData,
  data: SlackData,
  options: MergeOptions
): void {
  const log = logger.child('merger:slack');

  // Group messages by date for timeline events
  const messagesByDate = new Map<string, SlackMessage[]>();

  for (const message of data.messages) {
    const dateKey = new Date(message.timestamp).toISOString().split('T')[0] ?? '';
    const existing = messagesByDate.get(dateKey) ?? [];
    existing.push(message);
    messagesByDate.set(dateKey, existing);
  }

  // Create timeline events for significant Slack activity
  for (const [dateKey, messages] of messagesByDate) {
    if (messages.length >= 3) {
      // Only create event if significant activity
      const event: TimelineEvent = {
        id: `slack-${dateKey}`,
        date: new Date(dateKey),
        type: 'note',
        title: `${messages.length} Slack mentions`,
        description: `Internal discussion about ${options.accountName}`,
      };
      result.timeline.push(event);
    }
  }

  // Process mentions for sentiment analysis
  for (const mention of data.mentions) {
    // Track sentiment patterns (could be used for risk detection later)
    if (mention.sentiment === 'negative') {
      log.debug(`Negative mention: ${mention.context}`);
    }
  }

  log.debug(`Processed ${data.messages.length} Slack messages`);
}

/**
 * Merge Calendar event data
 */
function mergeCalendarData(
  result: MergedData,
  data: CalendarData,
  options: MergeOptions
): void {
  const log = logger.child('merger:calendar');

  for (const event of data.events) {
    // Check if this event involves the target account
    const hasAccountAttendee = event.attendees.some(a => {
      const domain = extractDomain(a.email);
      return domain?.toLowerCase() === options.accountDomain.toLowerCase();
    });

    if (!hasAccountAttendee) continue;

    // Add to timeline
    const timelineEvent: TimelineEvent = {
      id: `cal-${event.id}`,
      date: event.start,
      type: 'meeting',
      title: event.summary,
      description: event.description,
      participants: event.attendees.map(a => a.email),
      duration: Math.round(
        (event.end.getTime() - event.start.getTime()) / (1000 * 60)
      ),
    };
    result.timeline.push(timelineEvent);

    // Extract participants
    for (const attendee of event.attendees) {
      if (isInternalEmail(attendee.email)) continue;

      const existing = result.participants.get(attendee.email) ?? {
        email: attendee.email,
        name: attendee.displayName ?? '',
        company: extractDomain(attendee.email) ?? '',
        title: '',
        role: 'unknown',
        influence: 'medium',
        previousInteractions: [],
      };

      // Update name if we have it
      if (attendee.displayName && !existing.name) {
        existing.name = attendee.displayName;
      }

      result.participants.set(attendee.email, existing);
    }

    log.debug(`Processed calendar event: ${event.summary}`);
  }
}

// ============================================================================
// Post-Processing
// ============================================================================

/**
 * Deduplicate and consolidate participant data
 */
function deduplicateParticipants(result: MergedData): void {
  // Participants are already keyed by email, so no deduplication needed
  // But we can consolidate data from different sources

  for (const participant of result.participants.values()) {
    // Sort interactions by date (newest first)
    if (participant.previousInteractions) {
      participant.previousInteractions.sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
    }

    // Set last interaction date from interactions
    if (participant.previousInteractions && participant.previousInteractions.length > 0) {
      participant.lastInteractionDate = participant.previousInteractions[0]?.date;
    }
  }
}

/**
 * Sort timeline events by date
 */
function sortTimeline(result: MergedData): void {
  result.timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Compute account-level metrics
 */
function computeAccountMetrics(result: MergedData): void {
  const account = result.account;

  // Find last contact date
  if (result.timeline.length > 0) {
    const lastEvent = result.timeline[result.timeline.length - 1];
    if (lastEvent) {
      account.lastContactDate = lastEvent.date;
    }
  }

  // Count open action items
  account.openActionItems = result.actionItems.filter(
    item => item.status === 'pending' || item.status === 'overdue'
  );

  // Convert participants map to contacts array
  account.contacts = Array.from(result.participants.values()).map(p => ({
    id: p.email ?? '',
    email: p.email ?? '',
    name: p.name ?? '',
    title: p.title,
  }));

  // Set timeline
  account.timeline = result.timeline;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Fireflies action item to our ActionItem type
 */
function convertFirefliesActionItem(
  item: FirefliesActionItem,
  transcript: FirefliesTranscript
): ActionItem {
  // Determine owner based on assignee
  const isExternal = item.assignee
    ? !isInternalEmail(item.assignee)
    : false;

  return {
    id: `ff-ai-${transcript.id}-${Math.random().toString(36).slice(2, 8)}`,
    description: item.text,
    owner: isExternal ? 'theirs' : 'ours',
    assignee: item.assignee,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
    createdDate: transcript.date,
    status: 'pending',
    source: transcript.title,
  };
}

/**
 * Mark overdue action items
 */
export function markOverdueItems(items: ActionItem[]): ActionItem[] {
  const now = new Date();

  return items.map(item => {
    if (item.status !== 'pending') return item;
    if (!item.dueDate) return item;

    if (item.dueDate < now) {
      return {
        ...item,
        status: 'overdue',
        daysOverdue: daysAgo(item.dueDate),
      };
    }

    return item;
  });
}

/**
 * Get unique participant emails from merged data
 */
export function getUniqueParticipantEmails(data: MergedData): string[] {
  return Array.from(data.participants.keys());
}

/**
 * Get external participant emails only
 */
export function getExternalParticipantEmails(data: MergedData): string[] {
  return Array.from(data.participants.keys()).filter(
    email => !isInternalEmail(email)
  );
}
