#!/usr/bin/env node
/**
 * Sovereign Prep CLI
 *
 * Command-line interface for dossier generation.
 *
 * Usage:
 *   npm run generate              # Generate dossiers for tomorrow's meetings
 *   npm run generate:account "X"  # Generate for specific account
 *   npm run scheduler             # Start the scheduler daemon
 */

import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import {
  getScheduler,
  SCHEDULES,
  triggerDossierGeneration,
  triggerTomorrowsDossiers,
  nightlyJobHandler,
  generateTriggerReport,
  generateBatchReport,
} from './scheduler/index.js';

// Load environment variables
config();

// ============================================================================
// Types
// ============================================================================

interface CLICommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => void | Promise<void>;
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Generate dossiers for tomorrow's meetings
 */
async function handleGenerate(_args: string[]): Promise<void> {
  const log = logger.child('cli');
  log.info('Generating dossiers for upcoming meetings...');

  const result = await triggerTomorrowsDossiers({
    slackChannel: process.env['SLACK_CHANNEL'],
    driveFolderId: process.env['DRIVE_FOLDER_ID'],
    outputDir: process.env['OUTPUT_DIR'],
  });

  console.log(generateBatchReport(result));

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Generate dossier for a specific account
 */
async function handleGenerateAccount(args: string[]): Promise<void> {
  const log = logger.child('cli');
  const accountName = args[0];

  if (!accountName) {
    console.error('Error: Account name is required');
    console.error('Usage: npm run generate:account "Account Name"');
    process.exit(1);
  }

  log.info(`Generating dossier for account: ${accountName}`);

  const result = await triggerDossierGeneration({
    accountName,
    accountDomain: guessDomainFromName(accountName),
    slackChannel: process.env['SLACK_CHANNEL'],
    driveFolderId: process.env['DRIVE_FOLDER_ID'],
    outputDir: process.env['OUTPUT_DIR'],
  });

  console.log(generateTriggerReport(result));

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Generate quick dossier (no external data fetching)
 */
async function handleQuickGenerate(args: string[]): Promise<void> {
  const log = logger.child('cli');
  const accountName = args[0];

  if (!accountName) {
    console.error('Error: Account name is required');
    console.error('Usage: npm run generate:quick "Account Name"');
    process.exit(1);
  }

  log.info(`Generating quick dossier for account: ${accountName}`);

  const result = await triggerDossierGeneration({
    accountName,
    accountDomain: guessDomainFromName(accountName),
    quickMode: true,
    skipSlack: true,
    skipDrive: true,
  });

  console.log(generateTriggerReport(result));

  if (result.htmlContent) {
    console.log('\nHTML Preview (first 500 chars):');
    console.log(result.htmlContent.slice(0, 500) + '...');
  }

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Start the scheduler daemon
 */
async function handleSchedulerStart(_args: string[]): Promise<void> {
  const log = logger.child('cli');
  log.info('Starting Sovereign Prep scheduler...');

  const scheduler = getScheduler({
    timezone: process.env['TIMEZONE'] ?? 'America/Chicago',
  });

  // Register the nightly job
  scheduler.registerJob({
    id: 'nightly-dossiers',
    name: 'Nightly Dossier Generation',
    schedule: SCHEDULES.NIGHTLY_9PM,
    handler: nightlyJobHandler,
    onSuccess: () => {
      log.info('Nightly job completed successfully');
    },
    onError: (error) => {
      log.error('Nightly job failed:', error);
    },
  });

  // Start the scheduler
  scheduler.start();

  console.log('Sovereign Prep Scheduler Started');
  console.log('--------------------------------');
  console.log(`Timezone: ${process.env['TIMEZONE'] ?? 'America/Chicago'}`);
  console.log('Registered jobs:');
  scheduler.getJobs().forEach(job => {
    console.log(`  - ${job.name}: ${job.schedule}`);
  });
  console.log('');
  console.log('Press Ctrl+C to stop');

  // Handle graceful shutdown
  const shutdown = (): void => {
    console.log('\nShutting down scheduler...');
    scheduler.shutdown().then(() => {
      process.exit(0);
    }).catch((err) => {
      console.error('Shutdown error:', err);
      process.exit(1);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  await new Promise(() => {
    // This promise never resolves, keeping the process alive
  });
}

/**
 * Stop the scheduler (send signal to running process)
 */
function handleSchedulerStop(_args: string[]): void {
  console.log('To stop the scheduler, send SIGINT (Ctrl+C) to the running process');
  console.log('Or use: pkill -f "sovereign-prep"');
}

/**
 * Show scheduler status
 */
function handleSchedulerStatus(_args: string[]): void {
  const scheduler = getScheduler();
  const stats = scheduler.getStats();
  const jobs = scheduler.getJobs();

  console.log('Sovereign Prep Scheduler Status');
  console.log('-------------------------------');
  console.log(`Running: ${scheduler.isSchedulerRunning() ? 'Yes' : 'No'}`);
  console.log(`Total Jobs: ${stats.totalJobs}`);
  console.log(`Running Jobs: ${stats.runningJobs}`);
  console.log(`Successful Runs: ${stats.successfulRuns}`);
  console.log(`Failed Runs: ${stats.failedRuns}`);
  if (stats.lastActivity) {
    console.log(`Last Activity: ${stats.lastActivity.toISOString()}`);
  }
  console.log('');
  console.log('Registered Jobs:');
  jobs.forEach(job => {
    console.log(`  ${job.name}`);
    console.log(`    Schedule: ${job.schedule}`);
    console.log(`    Run Count: ${job.runCount}`);
    if (job.lastRun) {
      console.log(`    Last Run: ${job.lastRun.toISOString()}`);
      console.log(`    Last Status: ${job.lastStatus}`);
    }
    if (job.lastError) {
      console.log(`    Last Error: ${job.lastError}`);
    }
  });
}

/**
 * Run a job manually
 */
function handleRunJob(args: string[]): void {
  const log = logger.child('cli');
  const jobId = args[0];

  if (!jobId) {
    console.error('Error: Job ID is required');
    console.error('Usage: npm run job:run <job-id>');
    process.exit(1);
  }

  log.info(`Running job: ${jobId}`);

  const scheduler = getScheduler();
  scheduler.runJob(jobId);

  console.log(`Job ${jobId} triggered`);
}

/**
 * Show help
 */
function handleHelp(_args: string[]): void {
  console.log(`
Sovereign Prep CLI - Meeting Dossier Generation System

USAGE:
  sovereign-prep <command> [options]

COMMANDS:
  generate                  Generate dossiers for tomorrow's meetings
  generate:account <name>   Generate dossier for a specific account
  generate:quick <name>     Generate quick dossier without external data

  scheduler start           Start the scheduler daemon
  scheduler stop            Stop the scheduler daemon
  scheduler status          Show scheduler status

  job:run <job-id>         Run a specific job manually

  help                      Show this help message
  version                   Show version

ENVIRONMENT VARIABLES:
  SLACK_CHANNEL             Slack channel for posting summaries
  DRIVE_FOLDER_ID           Google Drive folder for uploads
  OUTPUT_DIR                Local output directory
  TIMEZONE                  Timezone for scheduler (default: America/Chicago)

EXAMPLES:
  npm run generate                      # Generate all dossiers for tomorrow
  npm run generate:account "Toyota"     # Generate for Toyota
  npm run generate:quick "Toyota"       # Quick generation (no API calls)
  npm run scheduler                     # Start the nightly scheduler
`);
}

/**
 * Show version
 */
function handleVersion(_args: string[]): void {
  console.log('Sovereign Prep v1.0.0');
}

// ============================================================================
// Command Registry
// ============================================================================

const commands: Record<string, CLICommand> = {
  generate: {
    name: 'generate',
    description: 'Generate dossiers for upcoming meetings',
    usage: 'generate',
    handler: handleGenerate,
  },
  'generate:account': {
    name: 'generate:account',
    description: 'Generate dossier for a specific account',
    usage: 'generate:account <account-name>',
    handler: handleGenerateAccount,
  },
  'generate:quick': {
    name: 'generate:quick',
    description: 'Generate quick dossier without external data',
    usage: 'generate:quick <account-name>',
    handler: handleQuickGenerate,
  },
  'scheduler': {
    name: 'scheduler',
    description: 'Start the scheduler daemon',
    usage: 'scheduler [start|stop|status]',
    handler: handleSchedulerStart,
  },
  'scheduler:start': {
    name: 'scheduler:start',
    description: 'Start the scheduler daemon',
    usage: 'scheduler:start',
    handler: handleSchedulerStart,
  },
  'scheduler:stop': {
    name: 'scheduler:stop',
    description: 'Stop the scheduler daemon',
    usage: 'scheduler:stop',
    handler: handleSchedulerStop,
  },
  'scheduler:status': {
    name: 'scheduler:status',
    description: 'Show scheduler status',
    usage: 'scheduler:status',
    handler: handleSchedulerStatus,
  },
  'job:run': {
    name: 'job:run',
    description: 'Run a specific job manually',
    usage: 'job:run <job-id>',
    handler: handleRunJob,
  },
  help: {
    name: 'help',
    description: 'Show help',
    usage: 'help',
    handler: handleHelp,
  },
  version: {
    name: 'version',
    description: 'Show version',
    usage: 'version',
    handler: handleVersion,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Guess domain from account name
 */
function guessDomainFromName(name: string): string {
  // Simple heuristic: lowercase, remove spaces, add .com
  return name.toLowerCase().replace(/\s+/g, '') + '.com';
}

/**
 * Parse command line arguments
 */
function parseArgs(argv: string[]): { command: string; args: string[] } {
  // Skip node and script path
  const args = argv.slice(2);
  const command = args[0] ?? 'help';
  const commandArgs = args.slice(1);

  return { command, args: commandArgs };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv);
  const log = logger.child('cli');

  log.debug(`Running command: ${command}`, { args });

  const handler = commands[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "sovereign-prep help" for usage information');
    process.exit(1);
  }

  try {
    await handler.handler(args);
  } catch (error) {
    log.error('Command failed:', error);
    console.error('Command failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if this is the main module
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
