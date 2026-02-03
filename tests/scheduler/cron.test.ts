/**
 * Cron Scheduler tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Scheduler,
  getScheduler,
  resetScheduler,
  isValidCronExpression,
  describeCronSchedule,
  SCHEDULES,
} from '../../src/scheduler/cron.js';

describe('Cron Scheduler', () => {
  beforeEach(() => {
    resetScheduler();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetScheduler();
    vi.useRealTimers();
  });

  describe('Scheduler class', () => {
    it('should create scheduler with default options', () => {
      const scheduler = new Scheduler();
      expect(scheduler.isSchedulerRunning()).toBe(false);
      expect(scheduler.getJobs()).toHaveLength(0);
    });

    it('should create scheduler with custom timezone', () => {
      const scheduler = new Scheduler({ timezone: 'America/New_York' });
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });

    it('should register a job', () => {
      const scheduler = new Scheduler();
      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        handler,
      });

      expect(scheduler.getJobs()).toHaveLength(1);
      expect(scheduler.getJob('test-job')).toBeDefined();
    });

    it('should throw on invalid cron expression', () => {
      const scheduler = new Scheduler();
      const handler = vi.fn().mockResolvedValue(undefined);

      expect(() => {
        scheduler.registerJob({
          id: 'test-job',
          name: 'Test Job',
          schedule: 'invalid',
          handler,
        });
      }).toThrow('Invalid cron expression');
    });

    it('should replace existing job with same id', () => {
      const scheduler = new Scheduler();
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job 1',
        schedule: '* * * * *',
        handler: handler1,
      });

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job 2',
        schedule: '*/5 * * * *',
        handler: handler2,
      });

      expect(scheduler.getJobs()).toHaveLength(1);
      expect(scheduler.getJob('test-job')?.name).toBe('Test Job 2');
    });

    it('should unregister a job', () => {
      const scheduler = new Scheduler();
      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        handler,
      });

      expect(scheduler.unregisterJob('test-job')).toBe(true);
      expect(scheduler.getJobs()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent job', () => {
      const scheduler = new Scheduler();
      expect(scheduler.unregisterJob('non-existent')).toBe(false);
    });

    it('should start and stop scheduler', () => {
      const scheduler = new Scheduler();
      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        handler,
      });

      scheduler.start();
      expect(scheduler.isSchedulerRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });

    it('should track stats', () => {
      const scheduler = new Scheduler();
      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.registerJob({
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        handler,
      });

      const stats = scheduler.getStats();
      expect(stats.totalJobs).toBe(1);
      expect(stats.runningJobs).toBe(0);
      expect(stats.successfulRuns).toBe(0);
      expect(stats.failedRuns).toBe(0);
    });
  });

  describe('getScheduler singleton', () => {
    it('should return same instance', () => {
      const scheduler1 = getScheduler();
      const scheduler2 = getScheduler();
      expect(scheduler1).toBe(scheduler2);
    });

    it('should reset singleton', () => {
      const scheduler1 = getScheduler();
      resetScheduler();
      const scheduler2 = getScheduler();
      expect(scheduler1).not.toBe(scheduler2);
    });
  });

  describe('isValidCronExpression', () => {
    it('should validate correct expressions', () => {
      expect(isValidCronExpression('* * * * *')).toBe(true);
      expect(isValidCronExpression('0 21 * * *')).toBe(true);
      expect(isValidCronExpression('*/5 * * * *')).toBe(true);
      expect(isValidCronExpression('0 0 * * 0')).toBe(true);
    });

    it('should reject invalid expressions', () => {
      expect(isValidCronExpression('invalid')).toBe(false);
      expect(isValidCronExpression('* * *')).toBe(false);
      expect(isValidCronExpression('')).toBe(false);
    });
  });

  describe('describeCronSchedule', () => {
    it('should describe predefined schedules', () => {
      expect(describeCronSchedule(SCHEDULES.EVERY_MINUTE)).toBe('Every minute');
      expect(describeCronSchedule(SCHEDULES.HOURLY)).toBe('Every hour at minute 0');
      expect(describeCronSchedule(SCHEDULES.NIGHTLY_9PM)).toBe('Daily at 9:00 PM');
      expect(describeCronSchedule(SCHEDULES.MORNING_6AM)).toBe('Daily at 6:00 AM');
      expect(describeCronSchedule(SCHEDULES.WEEKDAYS_9PM)).toBe('Weekdays at 9:00 PM');
      expect(describeCronSchedule(SCHEDULES.WEEKLY_SUNDAY)).toBe('Sundays at midnight');
    });

    it('should handle invalid expression', () => {
      expect(describeCronSchedule('invalid')).toBe('Invalid cron expression');
    });
  });

  describe('SCHEDULES constants', () => {
    it('should have valid cron expressions', () => {
      Object.values(SCHEDULES).forEach(schedule => {
        expect(isValidCronExpression(schedule)).toBe(true);
      });
    });
  });
});
