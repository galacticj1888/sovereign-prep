/**
 * Configuration management
 * Loads and validates environment variables using Zod
 */

import { z } from 'zod';

const LogLevel = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevel>;

const ConfigSchema = z.object({
  // API Keys (optional for now - MCP handles auth)
  firefliesApiKey: z.string().optional(),
  slackToken: z.string().optional(),
  hubspotApiKey: z.string().optional(),
  firecrawlApiKey: z.string().optional(),
  exaApiKey: z.string().optional(),
  googleCredentials: z.string().optional(),

  // Output configuration
  outputDir: z.string().default('./output'),
  slackChannel: z.string().optional(),

  // Logging
  logLevel: LogLevel.default('info'),

  // Feature flags
  enableTranscripts: z.boolean().default(true),
  enableSlackMentions: z.boolean().default(true),
  enableLinkedInProfiles: z.boolean().default(true),
  enableCompanyResearch: z.boolean().default(true),

  // Defaults
  defaultDaysOfHistory: z.number().default(30),
  cacheExpirationDays: z.number().default(7),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const rawConfig = {
    firefliesApiKey: process.env['FIREFLIES_API_KEY'],
    slackToken: process.env['SLACK_TOKEN'],
    hubspotApiKey: process.env['HUBSPOT_API_KEY'],
    firecrawlApiKey: process.env['FIRECRAWL_API_KEY'],
    exaApiKey: process.env['EXA_API_KEY'],
    googleCredentials: process.env['GOOGLE_CREDENTIALS'],

    outputDir: process.env['OUTPUT_DIR'],
    slackChannel: process.env['SLACK_CHANNEL'],

    logLevel: process.env['LOG_LEVEL'],

    enableTranscripts: process.env['ENABLE_TRANSCRIPTS'] !== 'false',
    enableSlackMentions: process.env['ENABLE_SLACK_MENTIONS'] !== 'false',
    enableLinkedInProfiles: process.env['ENABLE_LINKEDIN_PROFILES'] !== 'false',
    enableCompanyResearch: process.env['ENABLE_COMPANY_RESEARCH'] !== 'false',

    defaultDaysOfHistory: process.env['DEFAULT_DAYS_OF_HISTORY']
      ? parseInt(process.env['DEFAULT_DAYS_OF_HISTORY'], 10)
      : undefined,
    cacheExpirationDays: process.env['CACHE_EXPIRATION_DAYS']
      ? parseInt(process.env['CACHE_EXPIRATION_DAYS'], 10)
      : undefined,
  };

  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();
