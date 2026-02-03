/**
 * Manual Trigger Handler
 *
 * Handles on-demand dossier generation for specific accounts or meetings.
 * This is the main orchestrator that coordinates data fetching, analysis,
 * and output generation.
 */

import { logger } from '../utils/logger.js';
import { assembleDossier, createQuickDossier, validateDossier } from '../intelligence/dossierAssembler.js';
import { generateHtml } from '../output/htmlGenerator.js';
import { generateSlackMessage } from '../output/slackPoster.js';
import { prepareDossierUpload } from '../output/driveUploader.js';
import type { Meeting } from '../types/meeting.js';
import type { Dossier } from '../types/dossier.js';
import type { AssemblerContext, DataSources } from '../intelligence/dossierAssembler.js';

// --- Types ---

/** Raw MCP response from Fireflies search */
export interface MCPFirefliesTranscript {
  id: string;
  title: string;
  dateString: string;
  duration: number;
  organizerEmail?: string;
  meetingLink?: string;
  summary?: {
    short_summary?: string;
    keywords?: string[];
    action_items?: string;
  };
  meetingAttendees?: Array<{ displayName?: string; email: string }>;
  participants?: string[];
}

/** Raw MCP response from Slack search */
export interface MCPSlackMessage {
  type: string;
  channel: { id: string; name: string; is_private: boolean };
  user: string;
  user_name: string;
  username: string;
  text: string;
  ts: string;
  timestamp: string;
  permalink?: string;
}

/** Pre-fetched MCP data to avoid stubs */
export interface MCPData {
  fireflies?: {
    transcripts: MCPFirefliesTranscript[];
  };
  slack?: {
    messages: MCPSlackMessage[];
  };
  calendar?: {
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      attendees?: string[];
      location?: string;
    }>;
  };
}

export interface TriggerOptions {
  /** Account name to generate dossier for */
  accountName?: string;
  /** Account domain */
  accountDomain?: string;
  /** Specific meeting to generate for */
  meeting?: Meeting;
  /** Days ahead to look for meetings */
  daysAhead?: number;
  /** Skip Slack posting */
  skipSlack?: boolean;
  /** Skip Drive upload */
  skipDrive?: boolean;
  /** Output directory for local saves */
  outputDir?: string;
  /** Slack channel for posting */
  slackChannel?: string;
  /** Drive folder ID for uploads */
  driveFolderId?: string;
  /** Generate quick dossier without external data */
  quickMode?: boolean;
  /** Pre-fetched MCP data (bypasses stub fetchers) */
  mcpData?: MCPData;
}

export interface TriggerResult {
  success: boolean;
  dossier?: Dossier;
  htmlContent?: string;
  outputs: {
    html?: { path?: string; content: string };
    slack?: { channel: string; posted: boolean; error?: string };
    drive?: { uploaded: boolean; fileId?: string; webViewLink?: string; error?: string };
  };
  errors: string[];
  warnings: string[];
  timing: {
    startTime: Date;
    endTime: Date;
    durationMs: number;
  };
}

export interface BatchTriggerResult {
  success: boolean;
  totalMeetings: number;
  successfulDossiers: number;
  failedDossiers: number;
  results: TriggerResult[];
  errors: string[];
}

// --- Main Trigger Functions ---

/**
 * Generate a dossier for a specific meeting or account
 */
export async function triggerDossierGeneration(
  options: TriggerOptions
): Promise<TriggerResult> {
  const log = logger.child('trigger');
  const startTime = new Date();
  const errors: string[] = [];
  const warnings: string[] = [];
  const outputs: TriggerResult['outputs'] = {};

  log.info('Starting dossier generation', {
    accountName: options.accountName,
    quickMode: options.quickMode,
  });

  try {
    // Step 1: Get or create meeting
    const meeting = options.meeting ?? createDefaultMeeting(options);

    // Step 2: Generate dossier
    let dossier: Dossier;

    if (options.quickMode) {
      // Quick mode - minimal data, no external fetches
      log.info('Using quick mode - generating minimal dossier');
      dossier = createQuickDossier(
        meeting,
        options.accountName ?? 'Unknown Account',
        options.accountDomain ?? 'unknown.com'
      );
    } else {
      // Full mode - assemble with all available data
      const context = createAssemblerContext(meeting, options);
      const sources = await fetchDataSources(options);
      const result = assembleDossier(context, sources);
      dossier = result.dossier;
      // Note: AssemblerResult doesn't have warnings; validation will catch issues
    }

    // Step 3: Validate dossier
    const validation = validateDossier(dossier);
    if (!validation.isValid) {
      warnings.push(...validation.issues);
    }

    // Step 4: Generate HTML
    const htmlContent = generateHtml(dossier);
    outputs.html = { content: htmlContent };
    log.info('HTML generated successfully');

    // Step 5: Post to Slack (if enabled)
    if (!options.skipSlack && options.slackChannel) {
      try {
        // Generate message (actual posting would be done via MCP)
        generateSlackMessage(dossier);
        outputs.slack = {
          channel: options.slackChannel,
          posted: false, // Would be true after MCP execution
          error: undefined,
        };
        log.info(`Slack message prepared for ${options.slackChannel}`);
      } catch (slackError) {
        const errorMsg = slackError instanceof Error ? slackError.message : String(slackError);
        outputs.slack = {
          channel: options.slackChannel,
          posted: false,
          error: errorMsg,
        };
        warnings.push(`Slack posting failed: ${errorMsg}`);
      }
    }

    // Step 6: Upload to Drive (if enabled)
    if (!options.skipDrive) {
      try {
        const uploadPrep = prepareDossierUpload(
          dossier,
          htmlContent,
          options.driveFolderId
        );
        // Note: Actual upload would be done via MCP
        outputs.drive = {
          uploaded: false, // Would be true after MCP execution
          fileId: undefined,
          webViewLink: undefined,
        };
        log.info(`Drive upload prepared: ${uploadPrep.folderPath.join('/')}`);
      } catch (driveError) {
        const errorMsg = driveError instanceof Error ? driveError.message : String(driveError);
        outputs.drive = {
          uploaded: false,
          error: errorMsg,
        };
        warnings.push(`Drive upload failed: ${errorMsg}`);
      }
    }

    const endTime = new Date();

    log.info('Dossier generation complete', {
      account: dossier.account.name,
      durationMs: endTime.getTime() - startTime.getTime(),
      warnings: warnings.length,
    });

    return {
      success: true,
      dossier,
      htmlContent,
      outputs,
      errors,
      warnings,
      timing: {
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);
    log.error('Dossier generation failed:', error);

    return {
      success: false,
      outputs,
      errors,
      warnings,
      timing: {
        startTime,
        endTime: new Date(),
        durationMs: new Date().getTime() - startTime.getTime(),
      },
    };
  }
}

/**
 * Generate dossiers for all upcoming meetings
 */
export async function triggerBatchGeneration(
  meetings: Meeting[],
  options: Omit<TriggerOptions, 'meeting'>
): Promise<BatchTriggerResult> {
  const log = logger.child('batch-trigger');
  const results: TriggerResult[] = [];
  const errors: string[] = [];

  log.info(`Starting batch generation for ${meetings.length} meetings`);

  for (const meeting of meetings) {
    try {
      const result = await triggerDossierGeneration({
        ...options,
        meeting,
      });
      results.push(result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Meeting ${meeting.id}: ${errorMsg}`);
      log.error(`Failed to generate dossier for meeting ${meeting.id}:`, error);
    }
  }

  const successfulDossiers = results.filter(r => r.success).length;
  const failedDossiers = results.filter(r => !r.success).length;

  log.info('Batch generation complete', {
    total: meetings.length,
    successful: successfulDossiers,
    failed: failedDossiers,
  });

  return {
    success: failedDossiers === 0,
    totalMeetings: meetings.length,
    successfulDossiers,
    failedDossiers,
    results,
    errors,
  };
}

/**
 * Generate dossier for tomorrow's meetings
 */
export async function triggerTomorrowsDossiers(
  options: Omit<TriggerOptions, 'meeting' | 'daysAhead'>
): Promise<BatchTriggerResult> {
  const log = logger.child('tomorrow-trigger');
  log.info('Generating dossiers for tomorrow\'s meetings');

  // In a real implementation, this would fetch from Google Calendar
  // For now, we return an empty batch
  const tomorrowMeetings: Meeting[] = [];

  if (tomorrowMeetings.length === 0) {
    log.info('No meetings found for tomorrow');
    return {
      success: true,
      totalMeetings: 0,
      successfulDossiers: 0,
      failedDossiers: 0,
      results: [],
      errors: [],
    };
  }

  return triggerBatchGeneration(tomorrowMeetings, options);
}

// --- Helper Functions ---

/**
 * Create a default meeting when none is provided
 */
function createDefaultMeeting(options: TriggerOptions): Meeting {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + (options.daysAhead ?? 1));
  tomorrow.setHours(10, 0, 0, 0);

  return {
    id: `meeting-${Date.now()}`,
    title: `${options.accountName ?? 'Account'} Meeting`,
    datetime: tomorrow,
    duration: 30,
    attendees: [],
  };
}

/**
 * Create assembler context from options
 */
function createAssemblerContext(
  meeting: Meeting,
  options: TriggerOptions
): AssemblerContext {
  return {
    meeting,
    accountName: options.accountName ?? 'Unknown Account',
    accountDomain: options.accountDomain ?? 'unknown.com',
    options: {
      accountName: options.accountName,
      includeTranscripts: true,
      includeSlackMentions: true,
      daysOfHistory: 30,
    },
  };
}

/**
 * Fetch data from all sources in parallel
 *
 * If mcpData is provided, transforms and uses that data.
 * Otherwise falls back to stub fetchers.
 */
async function fetchDataSources(options: TriggerOptions): Promise<DataSources> {
  const log = logger.child('data-fetch');
  const accountName = options.accountName ?? 'Unknown';

  log.info(`Fetching data for: ${accountName}`);
  const startTime = Date.now();

  // If MCP data is provided, transform and use it
  if (options.mcpData) {
    log.info('Using pre-fetched MCP data');
    const fireflies = transformMCPFireflies(options.mcpData.fireflies);
    const slack = transformMCPSlack(options.mcpData.slack);
    const calendar = transformMCPCalendar(options.mcpData.calendar);

    const duration = Date.now() - startTime;
    log.info(`MCP data transformed in ${duration}ms`, {
      transcripts: fireflies.transcripts.length,
      slackMessages: slack.messages.length,
      calendarEvents: calendar.events.length,
    });

    return { fireflies, slack, calendar };
  }

  // Fallback: Execute all fetches in parallel with graceful error handling
  const [firefliesResult, slackResult, calendarResult] = await Promise.allSettled([
    fetchFirefliesData(accountName),
    fetchSlackData(accountName),
    fetchCalendarData(options.meeting),
  ]);

  // Extract results with fallbacks for failures
  const fireflies = firefliesResult.status === 'fulfilled'
    ? firefliesResult.value
    : { transcripts: [] };

  const slack = slackResult.status === 'fulfilled'
    ? slackResult.value
    : { mentions: [], messages: [] };

  const calendar = calendarResult.status === 'fulfilled'
    ? calendarResult.value
    : { events: [] };

  // Log any failures
  if (firefliesResult.status === 'rejected') {
    log.warn('Fireflies fetch failed:', firefliesResult.reason);
  }
  if (slackResult.status === 'rejected') {
    log.warn('Slack fetch failed:', slackResult.reason);
  }
  if (calendarResult.status === 'rejected') {
    log.warn('Calendar fetch failed:', calendarResult.reason);
  }

  const duration = Date.now() - startTime;
  log.info(`Data fetch complete in ${duration}ms`, {
    transcripts: fireflies.transcripts.length,
    slackMessages: slack.messages.length,
    calendarEvents: calendar.events.length,
  });

  return { fireflies, slack, calendar };
}

/**
 * Fetch Fireflies transcripts for an account
 * In production, this would use MCP: fireflies__fireflies_search
 */
async function fetchFirefliesData(_accountName: string): Promise<{ transcripts: never[] }> {
  // Placeholder - would be replaced with actual MCP call:
  // const results = await mcp.call('fireflies__fireflies_search', { query: accountName });
  // return { transcripts: results };
  return await Promise.resolve({ transcripts: [] });
}

/**
 * Fetch Slack messages for an account
 * In production, this would use MCP: slack_search
 */
async function fetchSlackData(_accountName: string): Promise<{ mentions: never[]; messages: never[] }> {
  // Placeholder - would be replaced with actual MCP call:
  // const results = await mcp.call('slack_search', { query: accountName });
  // return { mentions: [], messages: results };
  return await Promise.resolve({ mentions: [], messages: [] });
}

/**
 * Fetch calendar events
 * In production, this would use MCP: mcp__google-calendar-2__list_events
 */
async function fetchCalendarData(_meeting?: Meeting): Promise<{ events: never[] }> {
  // Placeholder - would be replaced with actual MCP call:
  // const results = await mcp.call('mcp__google-calendar-2__list_events', { ... });
  // return { events: results };
  return await Promise.resolve({ events: [] });
}

// --- MCP Data Transformers ---

import type { FirefliesTranscript, FirefliesActionItem } from '../sources/fireflies.js';
import type { SlackMessage, SlackMention } from '../sources/slack.js';
import type { CalendarEvent } from '../sources/calendar.js';

/**
 * Transform raw MCP Fireflies response to internal format
 */
function transformMCPFireflies(
  data?: { transcripts: MCPFirefliesTranscript[] }
): { transcripts: FirefliesTranscript[] } {
  if (!data || !data.transcripts) {
    return { transcripts: [] };
  }

  const transcripts: FirefliesTranscript[] = data.transcripts.map(t => {
    // Parse action items from the summary string
    const actionItems: FirefliesActionItem[] = [];
    if (t.summary?.action_items) {
      // Action items format: "**Person**\nItem1\nItem2\n\n**Person2**\nItem3"
      const lines = t.summary.action_items.split('\n');
      let currentAssignee = '';
      for (const line of lines) {
        const assigneeMatch = line.match(/^\*\*(.+?)\*\*$/);
        if (assigneeMatch && assigneeMatch[1]) {
          currentAssignee = assigneeMatch[1];
        } else if (line.trim() && !line.startsWith('**')) {
          actionItems.push({
            text: line.trim(),
            assignee: currentAssignee || undefined,
          });
        }
      }
    }

    return {
      id: t.id,
      title: t.title,
      date: new Date(t.dateString),
      duration: Math.round(t.duration),
      participants: t.participants ?? t.meetingAttendees?.map(a => a.email) ?? [],
      organizerEmail: t.organizerEmail,
      summary: t.summary?.short_summary,
      overview: t.summary?.short_summary,
      actionItems,
      sentences: [], // Detailed sentences require separate fetch
      keywords: t.summary?.keywords,
    };
  });

  return { transcripts };
}

/**
 * Transform raw MCP Slack response to internal format
 */
function transformMCPSlack(
  data?: { messages: MCPSlackMessage[] }
): { mentions: SlackMention[]; messages: SlackMessage[] } {
  if (!data || !data.messages) {
    return { mentions: [], messages: [] };
  }

  const messages: SlackMessage[] = data.messages.map(m => {
    // Slack timestamp is Unix epoch in seconds (e.g., "1769624113.326679")
    // Convert to ISO string for consistent handling
    const unixSeconds = parseFloat(m.ts);
    const isoTimestamp = new Date(unixSeconds * 1000).toISOString();

    return {
      channel: m.channel.id,
      channelName: m.channel.name,
      user: m.user,
      userName: m.user_name,
      text: m.text,
      timestamp: isoTimestamp,
      permalink: m.permalink,
      threadTs: undefined,
      replyCount: undefined,
    };
  });

  // Extract mentions from messages (SlackMention wraps SlackMessage)
  const mentions: SlackMention[] = messages.map(m => ({
    message: m,
    context: m.text.slice(0, 200),
    sentiment: 'neutral' as const,
  }));

  return { mentions, messages };
}

/**
 * Transform raw MCP Calendar response to internal format
 */
function transformMCPCalendar(
  data?: { events: Array<{ id: string; title: string; start: string; end: string; attendees?: string[]; location?: string }> }
): { events: CalendarEvent[] } {
  if (!data || !data.events) {
    return { events: [] };
  }

  const events: CalendarEvent[] = data.events.map(e => ({
    id: e.id,
    summary: e.title,
    start: new Date(e.start),
    end: new Date(e.end),
    attendees: (e.attendees ?? []).map(email => ({
      email,
      responseStatus: 'accepted',
    })),
    location: e.location,
    meetingLink: e.location?.startsWith('http') ? e.location : undefined,
    status: 'confirmed' as const,
  }));

  return { events };
}

// --- Nightly Job Handler ---

/**
 * Handler for the nightly cron job
 * Generates dossiers for all meetings in the next 24 hours
 */
export async function nightlyJobHandler(): Promise<void> {
  const log = logger.child('nightly-job');
  log.info('Starting nightly dossier generation job');

  try {
    const result = await triggerTomorrowsDossiers({
      skipSlack: false,
      skipDrive: false,
    });

    log.info('Nightly job complete', {
      totalMeetings: result.totalMeetings,
      successful: result.successfulDossiers,
      failed: result.failedDossiers,
    });

    if (result.failedDossiers > 0) {
      log.warn(`${result.failedDossiers} dossiers failed to generate`);
    }
  } catch (error) {
    log.error('Nightly job failed:', error);
    throw error;
  }
}

// --- Status Reporting ---

/**
 * Generate a summary report of trigger results
 */
export function generateTriggerReport(result: TriggerResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('DOSSIER GENERATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  if (result.dossier) {
    lines.push(`Account: ${result.dossier.account.name}`);
    lines.push(`Meeting: ${result.dossier.meeting.title}`);
    lines.push('');
  }

  lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  lines.push(`Duration: ${result.timing.durationMs}ms`);
  lines.push('');

  lines.push('Outputs:');
  if (result.outputs.html) {
    lines.push(`  HTML: Generated (${result.outputs.html.content.length} bytes)`);
  }
  if (result.outputs.slack) {
    lines.push(`  Slack: ${result.outputs.slack.posted ? 'Posted' : 'Prepared'} to ${result.outputs.slack.channel}`);
    if (result.outputs.slack.error) {
      lines.push(`    Error: ${result.outputs.slack.error}`);
    }
  }
  if (result.outputs.drive) {
    lines.push(`  Drive: ${result.outputs.drive.uploaded ? 'Uploaded' : 'Prepared'}`);
    if (result.outputs.drive.webViewLink) {
      lines.push(`    Link: ${result.outputs.drive.webViewLink}`);
    }
    if (result.outputs.drive.error) {
      lines.push(`    Error: ${result.outputs.drive.error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    result.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Generate a batch summary report
 */
export function generateBatchReport(result: BatchTriggerResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('BATCH DOSSIER GENERATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`Total Meetings: ${result.totalMeetings}`);
  lines.push(`Successful: ${result.successfulDossiers}`);
  lines.push(`Failed: ${result.failedDossiers}`);
  lines.push(`Success Rate: ${result.totalMeetings > 0 ? Math.round((result.successfulDossiers / result.totalMeetings) * 100) : 0}%`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('Errors:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
    lines.push('');
  }

  lines.push('Individual Results:');
  result.results.forEach((r, i) => {
    const account = r.dossier?.account.name ?? 'Unknown';
    const status = r.success ? 'OK' : 'FAILED';
    lines.push(`  ${i + 1}. ${account}: ${status} (${r.timing.durationMs}ms)`);
  });

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
