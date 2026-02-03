/**
 * Google Calendar MCP Client
 *
 * Wrapper for Google Calendar MCP tools.
 * Provides typed interfaces for meeting discovery and retrieval.
 *
 * MCP Tools used:
 * - mcp__google-calendar-2__list_events: List upcoming events
 * - mcp__google-calendar-2__get_event: Get event details
 * - mcp__google-calendar-2__list_calendars: List available calendars
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { formatISODateTime, getDateDaysFromNow } from '../utils/dateUtils.js';
import type { Meeting, Attendee, ResponseStatus } from '../types/index.js';

// --- Types ---

export interface CalendarListOptions {
  calendarId?: string;
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
  query?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  meetingLink?: string;
  attendees: CalendarAttendee[];
  organizer?: CalendarAttendee;
  recurringEventId?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
}

// --- Zod Schemas for MCP Response Validation ---

const CalendarAttendeeSchema = z.object({
  email: z.string(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
});

const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional().default('(No title)'),
  description: z.string().optional(),
  start: z
    .object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
    })
    .transform(s => new Date(s.dateTime ?? s.date ?? '')),
  end: z
    .object({
      dateTime: z.string().optional(),
      date: z.string().optional(),
    })
    .transform(s => new Date(s.dateTime ?? s.date ?? '')),
  location: z.string().optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z
    .object({
      entryPoints: z
        .array(
          z.object({
            uri: z.string().optional(),
            entryPointType: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  attendees: z.array(CalendarAttendeeSchema).optional().default([]),
  organizer: CalendarAttendeeSchema.optional(),
  recurringEventId: z.string().optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional().default('confirmed'),
});

// --- MCP Tool Interfaces ---

/**
 * List upcoming calendar events
 *
 * MCP Tool: mcp__google-calendar-2__list_events
 *
 * @example
 * // MCP call:
 * mcp__google-calendar-2__list_events({
 *   calendar_id: 'primary',
 *   time_min: '2026-02-03T00:00:00Z',
 *   time_max: '2026-02-05T00:00:00Z',
 *   max_results: 50
 * })
 */
export function getListEventsQuery(options: CalendarListOptions = {}): {
  tool: string;
  params: {
    calendar_id: string;
    time_min?: string;
    time_max?: string;
    max_results: number;
    query?: string;
  };
} {
  return {
    tool: 'mcp__google-calendar-2__list_events',
    params: {
      calendar_id: options.calendarId ?? 'primary',
      time_min: options.timeMin ? formatISODateTime(options.timeMin) : undefined,
      time_max: options.timeMax ? formatISODateTime(options.timeMax) : undefined,
      max_results: options.maxResults ?? 50,
      query: options.query,
    },
  };
}

/**
 * Get a specific calendar event by ID
 *
 * MCP Tool: mcp__google-calendar-2__get_event
 */
export function getEventQuery(
  eventId: string,
  calendarId: string = 'primary'
): {
  tool: string;
  params: { calendar_id: string; event_id: string };
} {
  return {
    tool: 'mcp__google-calendar-2__get_event',
    params: {
      calendar_id: calendarId,
      event_id: eventId,
    },
  };
}

/**
 * List available calendars
 *
 * MCP Tool: mcp__google-calendar-2__list_calendars
 */
export function getListCalendarsQuery(): {
  tool: string;
  params: { showHidden: boolean };
} {
  return {
    tool: 'mcp__google-calendar-2__list_calendars',
    params: { showHidden: false },
  };
}

// --- Response Parsers ---

/**
 * Parse calendar events from MCP response
 */
export function parseEvents(response: unknown): CalendarEvent[] {
  const log = logger.child('calendar');

  try {
    // Handle different response formats
    let items: unknown[] = [];

    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj['items'])) {
        items = obj['items'];
      } else if (Array.isArray(response)) {
        items = response;
      }
    }

    const parsed: CalendarEvent[] = [];

    for (const item of items) {
      const result = CalendarEventSchema.safeParse(item);
      if (!result.success) {
        log.warn('Failed to parse event:', result.error.message);
        continue;
      }

      // Extract meeting link from various sources
      let meetingLink = result.data.hangoutLink;
      if (!meetingLink && result.data.conferenceData?.entryPoints) {
        const videoEntry = result.data.conferenceData.entryPoints.find(
          e => e.entryPointType === 'video'
        );
        meetingLink = videoEntry?.uri;
      }

      parsed.push({
        id: result.data.id,
        summary: result.data.summary,
        description: result.data.description,
        start: result.data.start,
        end: result.data.end,
        location: result.data.location,
        meetingLink,
        attendees: result.data.attendees,
        organizer: result.data.organizer,
        recurringEventId: result.data.recurringEventId,
        status: result.data.status,
      });
    }

    return parsed;
  } catch (error) {
    log.error('Error parsing events:', error);
    return [];
  }
}

/**
 * Parse a single event from MCP response
 */
export function parseEvent(response: unknown): CalendarEvent | null {
  const log = logger.child('calendar');

  try {
    const result = CalendarEventSchema.safeParse(response);
    if (!result.success) {
      log.warn('Failed to parse event:', result.error.message);
      return null;
    }

    let meetingLink = result.data.hangoutLink;
    if (!meetingLink && result.data.conferenceData?.entryPoints) {
      const videoEntry = result.data.conferenceData.entryPoints.find(
        e => e.entryPointType === 'video'
      );
      meetingLink = videoEntry?.uri;
    }

    return {
      id: result.data.id,
      summary: result.data.summary,
      description: result.data.description,
      start: result.data.start,
      end: result.data.end,
      location: result.data.location,
      meetingLink,
      attendees: result.data.attendees,
      organizer: result.data.organizer,
      recurringEventId: result.data.recurringEventId,
      status: result.data.status,
    };
  } catch (error) {
    log.error('Error parsing event:', error);
    return null;
  }
}

// --- Conversion Functions ---

/**
 * Convert CalendarEvent to Meeting type
 */
export function convertToMeeting(event: CalendarEvent): Meeting {
  const duration = Math.round(
    (event.end.getTime() - event.start.getTime()) / (1000 * 60)
  );

  const attendees: Attendee[] = event.attendees.map(a => ({
    email: a.email,
    name: a.displayName,
    responseStatus: mapResponseStatus(a.responseStatus),
    isOrganizer: a.organizer ?? false,
    isExternal: !isInternalEmail(a.email),
  }));

  // Derive accountId from external attendee domains
  const externalDomains = attendees
    .filter(a => a.isExternal)
    .map(a => extractDomain(a.email))
    .filter((d): d is string => d !== null);

  const accountId = externalDomains.length > 0 ? externalDomains[0] : undefined;

  return {
    id: event.id,
    title: event.summary,
    datetime: event.start,
    duration,
    attendees,
    meetingLink: event.meetingLink,
    accountId,
    description: event.description,
    location: event.location,
  };
}

/**
 * Map Google Calendar response status to our type
 */
function mapResponseStatus(status?: string): ResponseStatus | undefined {
  switch (status) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentative':
      return 'tentative';
    case 'needsAction':
      return 'needsAction';
    default:
      return undefined;
  }
}

// --- Utility Functions ---

/** Internal company domains - customize for your organization */
const INTERNAL_DOMAINS = ['runlayer.com', 'anysourcehq.com'];

/**
 * Check if an email is from an internal domain
 */
export function isInternalEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  return INTERNAL_DOMAINS.some(d => domain.toLowerCase() === d.toLowerCase());
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match?.[1] ?? null;
}

/**
 * Filter events to only customer/prospect meetings
 * (meetings with external attendees)
 */
export function filterExternalMeetings(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter(event => {
    // Must have attendees
    if (event.attendees.length === 0) return false;

    // Must have at least one external attendee
    const hasExternal = event.attendees.some(a => !isInternalEmail(a.email));
    return hasExternal;
  });
}

/**
 * Filter events by attendee domain
 */
export function filterByDomain(events: CalendarEvent[], domain: string): CalendarEvent[] {
  const normalizedDomain = domain.toLowerCase();
  return events.filter(event =>
    event.attendees.some(a => {
      const attendeeDomain = extractDomain(a.email);
      return attendeeDomain?.toLowerCase() === normalizedDomain;
    })
  );
}

/**
 * Get query params for tomorrow's meetings
 */
export function getTomorrowMeetingsQuery(): CalendarListOptions {
  const tomorrow = getDateDaysFromNow(1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = getDateDaysFromNow(2);
  dayAfter.setHours(0, 0, 0, 0);

  return {
    timeMin: tomorrow,
    timeMax: dayAfter,
    maxResults: 50,
  };
}

/**
 * Get query params for upcoming meetings (next N hours)
 */
export function getUpcomingMeetingsQuery(hours: number = 48): CalendarListOptions {
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return {
    timeMin: now,
    timeMax: future,
    maxResults: 50,
  };
}
