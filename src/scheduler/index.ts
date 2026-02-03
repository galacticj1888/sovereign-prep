/**
 * Scheduler Module
 *
 * Provides scheduled and on-demand dossier generation capabilities.
 */

export {
  Scheduler,
  getScheduler,
  resetScheduler,
  isValidCronExpression,
  describeCronSchedule,
  SCHEDULES,
  type ScheduledJob,
  type JobConfig,
  type SchedulerOptions,
  type SchedulerStats,
} from './cron.js';

export {
  triggerDossierGeneration,
  triggerBatchGeneration,
  triggerTomorrowsDossiers,
  nightlyJobHandler,
  generateTriggerReport,
  generateBatchReport,
  type TriggerOptions,
  type TriggerResult,
  type BatchTriggerResult,
} from './trigger.js';
