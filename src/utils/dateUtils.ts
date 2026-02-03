/**
 * Date utility functions
 * Helpers for date formatting, calculations, and timezone handling
 */

/**
 * Format a date as ISO 8601 date string (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Format a date as ISO 8601 datetime string
 */
export function formatISODateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Format a date for display (e.g., "Feb 3, 2026")
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a time for display (e.g., "11:30 AM")
 */
export function formatDisplayTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date and time for display (e.g., "Feb 3, 2026 at 11:30 AM")
 */
export function formatDisplayDateTime(date: Date): string {
  return `${formatDisplayDate(date)} at ${formatDisplayTime(date)}`;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days ago from now
 */
export function daysAgo(date: Date): number {
  return daysBetween(date, new Date());
}

/**
 * Get a human-readable "days ago" string
 */
export function daysAgoText(date: Date): string {
  const days = daysAgo(date);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'last month';
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Get a date N days ago
 */
export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Get a date N days from now
 */
export function getDateDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Check if a date is within a range
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

/**
 * Parse an ISO date string to Date object
 */
export function parseISODate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * Get the start of today (midnight)
 */
export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get the end of today (23:59:59.999)
 */
export function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Format duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}
