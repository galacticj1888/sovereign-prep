/**
 * Data sources index
 * Re-exports all source clients
 */

// Fireflies client
export {
  type FirefliesSearchOptions,
  type FirefliesSearchResult,
  type FirefliesSentence,
  type FirefliesActionItem,
  type FirefliesTranscript,
  buildSearchQuery as buildFirefliesQuery,
  getSearchTranscriptsQuery,
  getTranscriptQuery,
  getSummaryQuery,
  parseSearchResults as parseFirefliesSearchResults,
  parseTranscript,
  parseSummary,
  convertActionItems,
  getDefaultDateRange,
} from './fireflies.js';

// Slack client
export {
  type SlackSearchOptions,
  type SlackMessage,
  type SlackThread,
  type SlackMention,
  buildSearchQuery as buildSlackQuery,
  getSearchMessagesQuery,
  getThreadMessagesQuery,
  getFetchMessageQuery,
  parseSearchResults as parseSlackSearchResults,
  parseThreadMessages,
  getAccountMentionsQuery,
  extractContext,
  detectSentiment,
  convertToMentions,
} from './slack.js';

// Calendar client
export {
  type CalendarListOptions,
  type CalendarEvent,
  type CalendarAttendee,
  getListEventsQuery,
  getEventQuery,
  getListCalendarsQuery,
  parseEvents,
  parseEvent,
  convertToMeeting,
  isInternalEmail,
  extractDomain,
  filterExternalMeetings,
  filterByDomain,
  getTomorrowMeetingsQuery,
  getUpcomingMeetingsQuery,
} from './calendar.js';

// Exa client (company/people research)
export {
  type CompanyInfo,
  type PersonInfo,
  type NewsItem,
  type WebsetSearchOptions,
  getCreateCompanyWebsetQuery,
  getCreatePersonWebsetQuery,
  getCompanyNewsSearchQuery,
  getListWebsetItemsQuery,
  getWebsetQuery,
  parseWebsetItems,
  parseWebset,
  extractCompanyInfo,
  extractPersonInfo,
  extractNewsItems,
} from './exa.js';
