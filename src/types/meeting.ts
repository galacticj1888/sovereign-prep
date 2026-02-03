/**
 * Meeting and Attendee types
 * Represents calendar events and their participants
 */

export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'needsAction';

export interface Attendee {
  email: string;
  name?: string;
  responseStatus?: ResponseStatus;
  isOrganizer?: boolean;
  isExternal?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  datetime: Date;
  duration: number; // in minutes
  attendees: Attendee[];
  meetingLink?: string;
  accountId?: string; // Derived from attendee domains
  description?: string;
  location?: string;
  calendarId?: string;
}

export interface MeetingFilter {
  fromDate?: Date;
  toDate?: Date;
  accountDomain?: string;
  excludeInternal?: boolean;
}
