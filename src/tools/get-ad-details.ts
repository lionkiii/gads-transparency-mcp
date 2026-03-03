/**
 * MCP Tool: get_ad_details
 * Get full details about a specific ad creative
 */

import { z } from 'zod';
import { getAdDetails } from '../scraper/ads.js';
import { config } from '../config.js';

export const getAdDetailsSchema = z.object({
  advertiserId: z
    .string()
    .min(1)
    .describe('Advertiser ID from Google Ads Transparency'),
  creativeId: z
    .string()
    .min(1)
    .describe('Creative/Ad ID from get_advertiser_ads results'),
  region: z
    .string()
    .default(config.defaultRegion)
    .describe('Region code (e.g., "US", "IN", "GB"). Defaults to US.'),
});

export type GetAdDetailsParams = z.infer<typeof getAdDetailsSchema>;

export const getAdDetailsTool = {
  name: 'get_ad_details',
  description: `Get complete information about a specific ad creative from Google Ads Transparency Center.

Use this tool to:
- Get full ad copy and media URLs
- See targeting information (when available)
- Get impression/spend ranges for political ads
- Deep dive into a specific ad creative

Returns full content, media URLs, targeting info, and run dates.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      advertiserId: {
        type: 'string',
        description: 'Advertiser ID from Google Ads Transparency',
      },
      creativeId: {
        type: 'string',
        description: 'Creative/Ad ID from get_advertiser_ads results',
      },
      region: {
        type: 'string',
        description: 'Region code (e.g., "US", "IN", "GB"). Defaults to US.',
        default: config.defaultRegion,
      },
    },
    required: ['advertiserId', 'creativeId'],
  },

  async execute(params: GetAdDetailsParams): Promise<string> {
    try {
      const { advertiserId, creativeId, region } =
        getAdDetailsSchema.parse(params);

      const details = await getAdDetails(advertiserId, creativeId, region);

      return JSON.stringify({
        success: true,
        advertiserId,
        advertiserName: details.advertiserName,
        creativeId: details.id,
        region,
        format: details.format,
        content: {
          headline: details.fullContent.headline || null,
          description: details.fullContent.description || null,
          callToAction: details.fullContent.callToAction || null,
          imageUrl: details.fullContent.imageUrl || null,
          videoUrl: details.fullContent.videoUrl || null,
          thumbnailUrl: details.fullContent.thumbnailUrl || null,
          landingPageUrl: details.fullContent.landingPageUrl || null,
        },
        dateRange: {
          firstShown: details.firstShown,
          lastShown: details.lastShown,
        },
        platforms: details.platforms,
        targeting: details.targeting || null,
        // Political ad info (if available)
        impressionRange: details.impressionRange || null,
        spendRange: details.spendRange || null,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
