/**
 * Demo script for Phase 1
 *
 * Demonstrates the Fireflies and Slack MCP client capabilities.
 * This script shows how to use the query builders and parsers.
 *
 * Run with: npm run demo
 */

import 'dotenv/config';
import { logger } from './utils/logger.js';
import {
  buildSearchQuery as buildFirefliesQuery,
  getSearchTranscriptsQuery,
  getTranscriptQuery,
  getSummaryQuery,
  getDefaultDateRange,
} from './sources/fireflies.js';
import {
  buildSearchQuery as buildSlackQuery,
  getSearchMessagesQuery,
  getAccountMentionsQuery,
  getThreadMessagesQuery,
  detectSentiment,
} from './sources/slack.js';
import { formatISODate, daysAgoText } from './utils/dateUtils.js';

async function demo(): Promise<void> {
  logger.info('='.repeat(60));
  logger.info('Sovereign Prep - Phase 1 Demo');
  logger.info('='.repeat(60));

  const accountName = 'Toyota';
  const dateRange = getDefaultDateRange(30);

  // ============================================================
  // Fireflies Demo
  // ============================================================
  logger.info('\n--- Fireflies MCP Client Demo ---\n');

  // Show how to build search queries
  logger.info('1. Building Fireflies search query:');
  const ffQuery = buildFirefliesQuery(accountName, {
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    scope: 'all',
    limit: 20,
  });
  logger.info(`   Query: ${ffQuery}`);

  // Show the MCP tool call format
  logger.info('\n2. MCP tool call for searching transcripts:');
  const searchTool = getSearchTranscriptsQuery({ accountName, options: { limit: 10 } });
  logger.info(`   Tool: ${searchTool.tool}`);
  logger.info(`   Params: ${JSON.stringify(searchTool.params, null, 2)}`);

  // Show transcript fetch
  logger.info('\n3. MCP tool call for fetching a transcript:');
  const transcriptTool = getTranscriptQuery('EXAMPLE_TRANSCRIPT_ID');
  logger.info(`   Tool: ${transcriptTool.tool}`);
  logger.info(`   Params: ${JSON.stringify(transcriptTool.params)}`);

  // Show summary fetch
  logger.info('\n4. MCP tool call for fetching a summary:');
  const summaryTool = getSummaryQuery('EXAMPLE_TRANSCRIPT_ID');
  logger.info(`   Tool: ${summaryTool.tool}`);
  logger.info(`   Params: ${JSON.stringify(summaryTool.params)}`);

  // ============================================================
  // Slack Demo
  // ============================================================
  logger.info('\n--- Slack MCP Client Demo ---\n');

  // Show how to build search queries
  logger.info('1. Building Slack search query:');
  const slackQuery = buildSlackQuery(accountName, {
    daysBack: 30,
    channels: ['sales-deals', 'customer-success'],
  });
  logger.info(`   Query: ${slackQuery}`);

  // Show the MCP tool call format
  logger.info('\n2. MCP tool call for searching messages:');
  const slackSearchTool = getSearchMessagesQuery({
    query: accountName,
    options: { daysBack: 30, limit: 50 },
  });
  logger.info(`   Tool: ${slackSearchTool.tool}`);
  logger.info(`   Params: ${JSON.stringify(slackSearchTool.params, null, 2)}`);

  // Show account mentions helper
  logger.info('\n3. Account mentions query (convenience wrapper):');
  const mentionsTool = getAccountMentionsQuery(accountName, 30);
  logger.info(`   Tool: ${mentionsTool.tool}`);
  logger.info(`   Query: ${mentionsTool.params.query}`);

  // Show thread fetch
  logger.info('\n4. MCP tool call for fetching thread messages:');
  const threadTool = getThreadMessagesQuery('sales-deals', '1234567890.123456');
  logger.info(`   Tool: ${threadTool.tool}`);
  logger.info(`   Params: ${JSON.stringify(threadTool.params)}`);

  // Show sentiment detection
  logger.info('\n5. Sentiment detection examples:');
  const examples = [
    'Great progress on the Toyota deal!',
    'Concerned about the timeline slipping',
    'Meeting scheduled for next week',
  ];
  for (const text of examples) {
    const sentiment = detectSentiment(text);
    logger.info(`   "${text}" → ${sentiment}`);
  }

  // ============================================================
  // Summary
  // ============================================================
  logger.info('\n' + '='.repeat(60));
  logger.info('Demo Complete!');
  logger.info('='.repeat(60));
  logger.info('\nTo actually call these MCP tools, use Claude Code with:');
  logger.info(`  1. fireflies__fireflies_search with query="${accountName}"`);
  logger.info(`  2. slack_search with query="${accountName} after:${formatISODate(dateRange.fromDate)}"`);
  logger.info('\nDate range: ' + daysAgoText(dateRange.fromDate) + ' to today');

  await Promise.resolve(); // Satisfy async requirement
}

demo().catch((error: unknown) => {
  logger.error('Demo failed:', error);
  process.exit(1);
});
