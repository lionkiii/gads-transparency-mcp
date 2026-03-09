/**
 * MCP Tool: search_advertiser
 * Find competitor advertisers by domain or brand name
 */

import { z } from 'zod';
import { searchAdvertisers, searchByDomain } from '../scraper/search.js';
import { config } from '../config.js';
import type { SearchResult } from '../types/index.js';

export const searchAdvertiserSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Domain name (e.g., "nike.com") or brand name (e.g., "Nike")'),
  region: z
    .string()
    .default(config.defaultRegion)
    .describe('Region code (e.g., "US", "IN", "GB"). Defaults to US.'),
});

export type SearchAdvertiserParams = z.infer<typeof searchAdvertiserSchema>;

export const searchAdvertiserTool = {
  name: 'search_advertiser',
  description: `Search for an advertiser on Google Ads Transparency Center by domain name or brand name.

Use this tool to:
- Find a competitor's advertiser ID by their website domain
- Search for brands to analyze their ad activity
- Discover related advertisers in a market

Returns advertiser ID, name, verification status, and total ad count.`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Domain name (e.g., "nike.com") or brand name (e.g., "Nike")',
      },
      region: {
        type: 'string',
        description: 'Region code (e.g., "US", "IN", "GB"). Defaults to US.',
        default: config.defaultRegion,
      },
    },
    required: ['query'],
  },

  async execute(params: SearchAdvertiserParams): Promise<string> {
    try {
      const { query, region } = searchAdvertiserSchema.parse(params);

      // Check if it looks like a domain
      const isDomain = query.includes('.') && !query.includes(' ');

      let result: SearchResult;

      if (isDomain) {
        // Search by domain - try to find exact match
        const advertiser = await searchByDomain(query, region);
        if (advertiser) {
          result = {
            advertisers: [advertiser],
            totalResults: 1,
            query,
            region,
          };
        } else {
          result = await searchAdvertisers(query, region);
        }
      } else {
        // Search by brand name
        result = await searchAdvertisers(query, region);
      }

      if (result.advertisers.length === 0) {
        return JSON.stringify({
          success: false,
          message: `No advertisers found for "${query}" in region ${region}`,
          suggestion:
            'Try a different search term or check if the brand runs Google Ads',
        });
      }

      return JSON.stringify({
        success: true,
        query,
        region,
        totalResults: result.totalResults,
        advertisers: result.advertisers.map((a) => ({
          advertiserId: a.id,
          name: a.name,
          verificationStatus: a.verificationStatus,
          totalAds: a.totalAds,
          profileUrl: `https://adstransparency.google.com/advertiser/${a.id}?region=${region}`,
        })),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
