/**
 * Date utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatISODate,
  formatISODateTime,
  formatDisplayDate,
  formatDisplayTime,
  daysBetween,
  daysAgo,
  daysAgoText,
  getDateDaysAgo,
  getDateDaysFromNow,
  isDateInRange,
  parseISODate,
  formatDuration,
} from '../../src/utils/dateUtils.js';

describe('Date Utilities', () => {
  describe('formatISODate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      expect(formatISODate(date)).toBe('2025-01-15');
    });
  });

  describe('formatISODateTime', () => {
    it('should format as ISO 8601 datetime', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      expect(formatISODateTime(date)).toBe('2025-01-15T10:30:00.000Z');
    });
  });

  describe('formatDisplayDate', () => {
    it('should format for human display', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = formatDisplayDate(date);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });
  });

  describe('formatDisplayTime', () => {
    it('should format time with AM/PM', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = formatDisplayTime(date);
      // Time depends on timezone, just check format
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between two dates', () => {
      const date1 = new Date('2025-01-01');
      const date2 = new Date('2025-01-11');
      expect(daysBetween(date1, date2)).toBe(10);
    });

    it('should handle reverse order', () => {
      const date1 = new Date('2025-01-11');
      const date2 = new Date('2025-01-01');
      expect(daysBetween(date1, date2)).toBe(10);
    });
  });

  describe('daysAgo', () => {
    it('should calculate days from now', () => {
      const past = getDateDaysAgo(5);
      expect(daysAgo(past)).toBeGreaterThanOrEqual(4);
      expect(daysAgo(past)).toBeLessThanOrEqual(6);
    });
  });

  describe('daysAgoText', () => {
    it('should return "today" for today', () => {
      expect(daysAgoText(new Date())).toBe('today');
    });

    it('should return "yesterday" for yesterday', () => {
      const yesterday = getDateDaysAgo(1);
      expect(daysAgoText(yesterday)).toBe('yesterday');
    });

    it('should return "X days ago" for recent dates', () => {
      const fiveDaysAgo = getDateDaysAgo(5);
      expect(daysAgoText(fiveDaysAgo)).toBe('5 days ago');
    });

    it('should return weeks ago for older dates', () => {
      const twoWeeksAgo = getDateDaysAgo(14);
      expect(daysAgoText(twoWeeksAgo)).toBe('2 weeks ago');
    });
  });

  describe('getDateDaysAgo', () => {
    it('should return a date in the past', () => {
      const past = getDateDaysAgo(10);
      expect(past.getTime()).toBeLessThan(new Date().getTime());
    });
  });

  describe('getDateDaysFromNow', () => {
    it('should return a date in the future', () => {
      const future = getDateDaysFromNow(10);
      expect(future.getTime()).toBeGreaterThan(new Date().getTime());
    });
  });

  describe('isDateInRange', () => {
    it('should return true for date in range', () => {
      const date = new Date('2025-01-15');
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      expect(isDateInRange(date, start, end)).toBe(true);
    });

    it('should return false for date outside range', () => {
      const date = new Date('2025-02-15');
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      expect(isDateInRange(date, start, end)).toBe(false);
    });

    it('should include boundary dates', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      expect(isDateInRange(start, start, end)).toBe(true);
      expect(isDateInRange(end, start, end)).toBe(true);
    });
  });

  describe('parseISODate', () => {
    it('should parse valid ISO date string', () => {
      const date = parseISODate('2025-01-15T10:30:00Z');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(15);
    });

    it('should throw for invalid date string', () => {
      expect(() => parseISODate('invalid')).toThrow('Invalid date string');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(30)).toBe('30 min');
      expect(formatDuration(45)).toBe('45 min');
    });

    it('should format hours only', () => {
      expect(formatDuration(60)).toBe('1 hr');
      expect(formatDuration(120)).toBe('2 hr');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1 hr 30 min');
      expect(formatDuration(150)).toBe('2 hr 30 min');
    });
  });
});
