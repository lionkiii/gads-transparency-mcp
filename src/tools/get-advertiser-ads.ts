/**
 * MCP Tool: get_advertiser_ads
 * Get all ads running for a specific advertiser
 */

import { z } from 'zod';
import { getAdvertiserAds } from '../scraper/ads.js';
import { config } from '../config.js';

export const getAdvertiserAdsSchema = z.object({
  advertiserId: z
    .string()
    .min(1)
    .describe(
      'Advertiser ID from Google Ads Transparency (e.g., "AR07034216898162065409")'
    ),
  region: z
    .string()
    .default(config.defaultRegion)
    .describe('Region code (e.g., "US", "IN", "GB"). Defaults to US.'),
  format: z
    .enum(['text', 'image', 'video', 'all'])
    .default('all')
    .describe('Filter by ad format. Options: text, image, video, all'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of ads to return. Returns all if not specified.'),
});

export type GetAdvertiserAdsParams = z.infer<typeof getAdvertiserAdsSchema>;

export const getAdvertiserAdsTool = {
  name: 'get_advertiser_ads',
  description: `Retrieve all ads currently running for a specific advertiser from Google Ads Transparency Center.

Use this tool to:
- Analyze competitor ad creatives and messaging
- See what types of ads (text/image/video) a brand is running
- Research ad copy and visual strategies
- Track ad activity across different platforms

Returns ad creatives with headlines, descriptions, thumbnails, and run dates.`,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object' as const,
    properties: {
      advertiserId: {
        type: 'string',
        description:
          'Advertiser ID from Google Ads Transparency (e.g., "AR07034216898162065409")',
      },
      region: {
        type: 'string',
        description: 'Region code (e.g., "US", "IN", "GB"). Defaults to US.',
        default: config.defaultRegion,
      },
      format: {
        type: 'string',
        enum: ['text', 'image', 'video', 'all'],
        description: 'Filter by ad format. Options: text, image, video, all',
        default: 'all',
      },
      limit: {
        type: 'number',
        description:
          'Maximum number of ads to return. Returns all if not specified.',
      },
    },
    required: ['advertiserId'],
  },

  async execute(params: GetAdvertiserAdsParams): Promise<string> {
    try {
      const { advertiserId, region, format, limit } =
        getAdvertiserAdsSchema.parse(params);

      const ads = await getAdvertiserAds(advertiserId, region, {
        format,
        limit,
      });

      if (ads.length === 0) {
        return JSON.stringify({
          success: true,
          advertiserId,
          region,
          format,
          totalAds: 0,
          message: `No ${format === 'all' ? '' : format + ' '}ads found for this advertiser in region ${region}`,
          ads: [],
        });
      }

      // Group by format for summary
      const formatCounts = ads.reduce(
        (acc, ad) => {
          acc[ad.format] = (acc[ad.format] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return JSON.stringify({
        success: true,
        advertiserId,
        advertiserName: ads[0]?.advertiserName || 'Unknown',
        region,
        format,
        totalAds: ads.length,
        formatBreakdown: formatCounts,
        ads: ads.map((ad) => ({
          creativeId: ad.id,
          format: ad.format,
          content: {
            headline: ad.content.headline || null,
            description: ad.content.description || null,
            callToAction: ad.content.callToAction || null,
            thumbnailUrl: ad.content.thumbnailUrl || null,
            landingPageUrl: ad.content.landingPageUrl || null,
          },
          dateRange: {
            firstShown: ad.firstShown,
            lastShown: ad.lastShown,
          },
          platforms: ad.platforms,
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
