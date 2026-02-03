/**
 * Exa Websets MCP Client
 *
 * Wrapper for Exa MCP tools for company and people research.
 * Uses websets for structured data collection and enrichment.
 *
 * MCP Tools used:
 * - mcp__exa-websets__create_webset: Create a new webset for research
 * - mcp__exa-websets__create_search: Search within a webset
 * - mcp__exa-websets__list_webset_items: Get results from a webset
 * - mcp__exa-websets__get_item: Get details for a specific item
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface CompanyInfo {
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  headquarters?: string;
  founded?: string;
  funding?: string;
  revenue?: string;
  website?: string;
  linkedInUrl?: string;
  recentNews?: NewsItem[];
}

export interface PersonInfo {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  linkedInUrl?: string;
  background?: string;
  education?: string;
  previousCompanies?: string[];
}

export interface NewsItem {
  title: string;
  date?: Date;
  source?: string;
  url?: string;
  summary?: string;
}

export interface WebsetSearchOptions {
  query: string;
  entityType: 'company' | 'person' | 'article';
  criteria?: string[];
  count?: number;
}

// ============================================================================
// Zod Schemas for MCP Response Validation
// ============================================================================

const WebsetItemSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  enrichments: z.record(z.unknown()).optional(),
  source: z.string().optional(),
});

const WebsetSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  itemCount: z.number().optional(),
  status: z.string().optional(),
});

// ============================================================================
// MCP Tool Interfaces
// ============================================================================

/**
 * Create a webset for company research
 *
 * MCP Tool: mcp__exa-websets__create_webset
 */
export function getCreateCompanyWebsetQuery(
  companyName: string,
  domain: string
): {
  tool: string;
  params: {
    name: string;
    searchQuery: string;
    searchCriteria: { description: string }[];
    enrichments: { description: string; format: string }[];
    searchCount: number;
  };
} {
  return {
    tool: 'mcp__exa-websets__create_webset',
    params: {
      name: `Company Research: ${companyName}`,
      searchQuery: `${companyName} ${domain} company information`,
      searchCriteria: [
        { description: `Company domain is ${domain}` },
      ],
      enrichments: [
        { description: 'Company industry', format: 'text' },
        { description: 'Number of employees', format: 'number' },
        { description: 'Company headquarters location', format: 'text' },
        { description: 'Year founded', format: 'text' },
        { description: 'Recent funding or financial news', format: 'text' },
      ],
      searchCount: 5,
    },
  };
}

/**
 * Create a webset for person research
 *
 * MCP Tool: mcp__exa-websets__create_webset
 */
export function getCreatePersonWebsetQuery(
  personName: string,
  company: string
): {
  tool: string;
  params: {
    name: string;
    searchQuery: string;
    searchCriteria: { description: string }[];
    enrichments: { description: string; format: string }[];
    searchCount: number;
  };
} {
  return {
    tool: 'mcp__exa-websets__create_webset',
    params: {
      name: `Person Research: ${personName}`,
      searchQuery: `${personName} ${company} LinkedIn professional`,
      searchCriteria: [
        { description: `Person works at ${company}` },
      ],
      enrichments: [
        { description: 'Current job title', format: 'text' },
        { description: 'Professional background summary', format: 'text' },
        { description: 'Previous companies', format: 'text' },
        { description: 'Education', format: 'text' },
        { description: 'LinkedIn profile URL', format: 'url' },
      ],
      searchCount: 3,
    },
  };
}

/**
 * Create a search for company news
 *
 * MCP Tool: mcp__exa-websets__create_search
 */
export function getCompanyNewsSearchQuery(
  websetId: string,
  companyName: string
): {
  tool: string;
  params: {
    websetId: string;
    query: string;
    entity: { type: string };
    criteria: { description: string }[];
    count: number;
  };
} {
  return {
    tool: 'mcp__exa-websets__create_search',
    params: {
      websetId,
      query: `${companyName} recent news announcements funding`,
      entity: { type: 'article' },
      criteria: [
        { description: 'Article is from the last 30 days' },
        { description: 'Article mentions the company by name' },
      ],
      count: 10,
    },
  };
}

/**
 * List items from a webset
 *
 * MCP Tool: mcp__exa-websets__list_webset_items
 */
export function getListWebsetItemsQuery(
  websetId: string,
  limit: number = 25
): {
  tool: string;
  params: { websetId: string; limit: number };
} {
  return {
    tool: 'mcp__exa-websets__list_webset_items',
    params: { websetId, limit },
  };
}

/**
 * Get a specific webset
 *
 * MCP Tool: mcp__exa-websets__get_webset
 */
export function getWebsetQuery(websetId: string): {
  tool: string;
  params: { websetId: string };
} {
  return {
    tool: 'mcp__exa-websets__get_webset',
    params: { websetId },
  };
}

// ============================================================================
// Response Parsers
// ============================================================================

/**
 * Parse webset items from MCP response
 */
export function parseWebsetItems(response: unknown): Array<{
  id: string;
  url?: string;
  title?: string;
  description?: string;
  enrichments?: Record<string, unknown>;
}> {
  const log = logger.child('exa');

  try {
    let items: unknown[] = [];

    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj['items'])) {
        items = obj['items'];
      } else if (Array.isArray(response)) {
        items = response;
      }
    }

    const parsed: Array<{
      id: string;
      url?: string;
      title?: string;
      description?: string;
      enrichments?: Record<string, unknown>;
    }> = [];

    for (const item of items) {
      const result = WebsetItemSchema.safeParse(item);
      if (!result.success) {
        log.warn('Failed to parse webset item:', result.error.message);
        continue;
      }

      parsed.push({
        id: result.data.id,
        url: result.data.url,
        title: result.data.title,
        description: result.data.description,
        enrichments: result.data.enrichments,
      });
    }

    return parsed;
  } catch (error) {
    log.error('Error parsing webset items:', error);
    return [];
  }
}

/**
 * Parse webset metadata from MCP response
 */
export function parseWebset(response: unknown): {
  id: string;
  name?: string;
  itemCount?: number;
  status?: string;
} | null {
  const log = logger.child('exa');

  try {
    const result = WebsetSchema.safeParse(response);
    if (!result.success) {
      log.warn('Failed to parse webset:', result.error.message);
      return null;
    }

    return {
      id: result.data.id,
      name: result.data.name,
      itemCount: result.data.itemCount,
      status: result.data.status,
    };
  } catch (error) {
    log.error('Error parsing webset:', error);
    return null;
  }
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert webset items to CompanyInfo
 */
export function extractCompanyInfo(
  items: Array<{
    id: string;
    url?: string;
    title?: string;
    description?: string;
    enrichments?: Record<string, unknown>;
  }>,
  companyName: string,
  domain: string
): CompanyInfo {
  const info: CompanyInfo = {
    name: companyName,
    domain,
  };

  // Aggregate info from all items
  for (const item of items) {
    if (item.description && !info.description) {
      info.description = item.description;
    }

    if (item.enrichments) {
      if (item.enrichments['Company industry'] && !info.industry) {
        info.industry = String(item.enrichments['Company industry']);
      }
      if (item.enrichments['Number of employees'] && !info.employeeCount) {
        const count = Number(item.enrichments['Number of employees']);
        if (!isNaN(count)) info.employeeCount = count;
      }
      if (item.enrichments['Company headquarters location'] && !info.headquarters) {
        info.headquarters = String(item.enrichments['Company headquarters location']);
      }
      if (item.enrichments['Year founded'] && !info.founded) {
        info.founded = String(item.enrichments['Year founded']);
      }
      if (item.enrichments['Recent funding or financial news'] && !info.funding) {
        info.funding = String(item.enrichments['Recent funding or financial news']);
      }
    }

    if (item.url && !info.website) {
      info.website = item.url;
    }
  }

  return info;
}

/**
 * Convert webset items to PersonInfo
 */
export function extractPersonInfo(
  items: Array<{
    id: string;
    url?: string;
    title?: string;
    description?: string;
    enrichments?: Record<string, unknown>;
  }>,
  personName: string
): PersonInfo {
  const info: PersonInfo = {
    name: personName,
  };

  // Aggregate info from all items
  for (const item of items) {
    if (item.enrichments) {
      if (item.enrichments['Current job title'] && !info.title) {
        info.title = String(item.enrichments['Current job title']);
      }
      if (item.enrichments['Professional background summary'] && !info.background) {
        info.background = String(item.enrichments['Professional background summary']);
      }
      if (item.enrichments['Previous companies'] && !info.previousCompanies) {
        const companies = String(item.enrichments['Previous companies']);
        info.previousCompanies = companies.split(',').map(c => c.trim());
      }
      if (item.enrichments['Education'] && !info.education) {
        info.education = String(item.enrichments['Education']);
      }
      if (item.enrichments['LinkedIn profile URL'] && !info.linkedInUrl) {
        info.linkedInUrl = String(item.enrichments['LinkedIn profile URL']);
      }
    }

    // Use URL as LinkedIn if it looks like a LinkedIn URL
    if (item.url && item.url.includes('linkedin.com') && !info.linkedInUrl) {
      info.linkedInUrl = item.url;
    }
  }

  return info;
}

/**
 * Convert webset items to news items
 */
export function extractNewsItems(
  items: Array<{
    id: string;
    url?: string;
    title?: string;
    description?: string;
    enrichments?: Record<string, unknown>;
  }>
): NewsItem[] {
  return items
    .filter(item => item.title)
    .map(item => ({
      title: item.title ?? '',
      url: item.url,
      summary: item.description,
    }));
}
