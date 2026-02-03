/**
 * Cron Job Scheduler
 *
 * Handles scheduled execution of dossier generation.
 * Uses node-cron for reliable scheduling.
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';

// --- Types ---

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  task: cron.ScheduledTask;
  lastRun?: Date;
  lastStatus?: 'success' | 'failure';
  lastError?: string;
  runCount: number;
}

export interface JobConfig {
  id: string;
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface SchedulerOptions {
  timezone?: string;
  runOnInit?: boolean;
}

export interface SchedulerStats {
  totalJobs: number;
  runningJobs: number;
  successfulRuns: number;
  failedRuns: number;
  lastActivity?: Date;
}

// --- Scheduler Class ---

export class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private isRunning: boolean = false;
  private stats: SchedulerStats = {
    totalJobs: 0,
    runningJobs: 0,
    successfulRuns: 0,
    failedRuns: 0,
  };
  private options: SchedulerOptions;
  private log = logger.child('scheduler');

  constructor(options: SchedulerOptions = {}) {
    this.options = {
      timezone: options.timezone ?? 'America/Chicago',
      runOnInit: options.runOnInit ?? false,
    };
  }

  /**
   * Register a new scheduled job
   */
  registerJob(config: JobConfig): void {
    if (this.jobs.has(config.id)) {
      this.log.warn(`Job ${config.id} already exists, replacing`);
      this.unregisterJob(config.id);
    }

    // Validate cron expression
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron expression: ${config.schedule}`);
    }

    const task = cron.schedule(
      config.schedule,
      () => {
        // Execute job and catch errors (async but fire-and-forget for cron)
        this.executeJob(config).catch(err => {
          this.log.error(`Job ${config.id} failed:`, err);
        });
      },
      {
        scheduled: false,
        timezone: this.options.timezone,
      }
    );

    const job: ScheduledJob = {
      id: config.id,
      name: config.name,
      schedule: config.schedule,
      task,
      runCount: 0,
    };

    this.jobs.set(config.id, job);
    this.stats.totalJobs = this.jobs.size;
    this.log.info(`Registered job: ${config.name} (${config.schedule})`);

    // Start if scheduler is running
    if (this.isRunning) {
      task.start();
    }

    // Run immediately if configured
    if (this.options.runOnInit) {
      this.log.info(`Running job ${config.id} immediately (runOnInit)`);
      this.executeJob(config).catch(err => {
        this.log.error(`Initial run of ${config.id} failed:`, err);
      });
    }
  }

  /**
   * Unregister a scheduled job
   */
  unregisterJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.task.stop();
    this.jobs.delete(jobId);
    this.stats.totalJobs = this.jobs.size;
    this.log.info(`Unregistered job: ${job.name}`);
    return true;
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      this.log.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    for (const job of this.jobs.values()) {
      job.task.start();
    }
    this.log.info(`Scheduler started with ${this.jobs.size} jobs`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    if (!this.isRunning) {
      this.log.warn('Scheduler is not running');
      return;
    }

    this.isRunning = false;
    for (const job of this.jobs.values()) {
      job.task.stop();
    }
    this.log.info('Scheduler stopped');
  }

  /**
   * Graceful shutdown - wait for running jobs to complete
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    this.log.info('Initiating graceful shutdown...');
    this.stop();

    // Wait for any running jobs to complete
    const startTime = Date.now();
    while (this.stats.runningJobs > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.stats.runningJobs > 0) {
      this.log.warn(`Shutdown timeout: ${this.stats.runningJobs} jobs still running`);
    } else {
      this.log.info('Graceful shutdown complete');
    }
  }

  /**
   * Execute a job manually (triggers the job asynchronously)
   */
  runJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // For manual runs, we trigger the task directly
    this.log.info(`Manually triggering job: ${job.name}`);
    job.task.now();
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Get all registered jobs
   */
  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).map(job => ({
      ...job,
      task: job.task, // Include task reference
    }));
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Execute a job with error handling
   */
  private async executeJob(config: JobConfig): Promise<void> {
    const job = this.jobs.get(config.id);
    if (!job) {
      this.log.error(`Job ${config.id} not found during execution`);
      return;
    }

    this.stats.runningJobs++;
    this.stats.lastActivity = new Date();
    job.lastRun = new Date();
    job.runCount++;

    this.log.info(`Starting job: ${config.name} (run #${job.runCount})`);

    try {
      await config.handler();
      job.lastStatus = 'success';
      job.lastError = undefined;
      this.stats.successfulRuns++;
      this.log.info(`Job completed: ${config.name}`);
      config.onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.lastStatus = 'failure';
      job.lastError = errorMessage;
      this.stats.failedRuns++;
      this.log.error(`Job failed: ${config.name}`, error);
      config.onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      this.stats.runningJobs--;
    }
  }
}

// --- Default Scheduler Instance ---

let defaultScheduler: Scheduler | null = null;

/**
 * Get or create the default scheduler instance
 */
export function getScheduler(options?: SchedulerOptions): Scheduler {
  if (!defaultScheduler) {
    defaultScheduler = new Scheduler(options);
  }
  return defaultScheduler;
}

/**
 * Reset the default scheduler (for testing)
 */
export function resetScheduler(): void {
  if (defaultScheduler) {
    defaultScheduler.stop();
    defaultScheduler = null;
  }
}

// --- Predefined Schedules ---

export const SCHEDULES = {
  /** Every minute (for testing) */
  EVERY_MINUTE: '* * * * *',
  /** Every 5 minutes */
  EVERY_5_MINUTES: '*/5 * * * *',
  /** Every hour */
  HOURLY: '0 * * * *',
  /** Daily at 9 PM */
  NIGHTLY_9PM: '0 21 * * *',
  /** Daily at 6 AM */
  MORNING_6AM: '0 6 * * *',
  /** Weekdays at 9 PM */
  WEEKDAYS_9PM: '0 21 * * 1-5',
  /** Sunday at midnight */
  WEEKLY_SUNDAY: '0 0 * * 0',
} as const;

// --- Utility Functions ---

/**
 * Validate a cron expression
 */
export function isValidCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Get human-readable description of cron schedule
 */
export function describeCronSchedule(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return 'Invalid cron expression';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Handle common patterns with lookup
  const knownSchedules: Record<string, string> = {
    [SCHEDULES.EVERY_MINUTE]: 'Every minute',
    [SCHEDULES.HOURLY]: 'Every hour at minute 0',
    [SCHEDULES.NIGHTLY_9PM]: 'Daily at 9:00 PM',
    [SCHEDULES.MORNING_6AM]: 'Daily at 6:00 AM',
    [SCHEDULES.WEEKDAYS_9PM]: 'Weekdays at 9:00 PM',
    [SCHEDULES.WEEKLY_SUNDAY]: 'Sundays at midnight',
  };
  const knownDescription = knownSchedules[expression];
  if (knownDescription) return knownDescription;

  // Generic description
  let description = '';

  if (minute === '*') {
    description += 'Every minute';
  } else if (minute?.startsWith('*/')) {
    description += `Every ${minute.slice(2)} minutes`;
  } else {
    description += `At minute ${minute}`;
  }

  if (hour !== '*') {
    const hourNum = parseInt(hour ?? '0', 10);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    description += ` at ${hour12}:00 ${ampm}`;
  }

  if (dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dayOfWeek === '1-5') {
      description += ' on weekdays';
    } else {
      const dayNum = parseInt(dayOfWeek ?? '0', 10);
      description += ` on ${days[dayNum]}`;
    }
  }

  if (dayOfMonth !== '*') {
    description += ` on day ${dayOfMonth}`;
  }

  if (month !== '*') {
    description += ` in month ${month}`;
  }

  return description || expression;
}
