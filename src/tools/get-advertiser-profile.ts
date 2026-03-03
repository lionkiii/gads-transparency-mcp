/**
 * MCP Tool: get_advertiser_profile
 * Get summary profile of an advertiser's ad activity
 */

import { z } from 'zod';
import { getAdvertiserProfile } from '../scraper/advertiser.js';
import { config } from '../config.js';

export const getAdvertiserProfileSchema = z.object({
  advertiserId: z
    .string()
    .min(1)
    .describe('Advertiser ID from Google Ads Transparency'),
  region: z
    .string()
    .default(config.defaultRegion)
    .describe('Region code (e.g., "US", "IN", "GB"). Defaults to US.'),
});

export type GetAdvertiserProfileParams = z.infer<
  typeof getAdvertiserProfileSchema
>;

export const getAdvertiserProfileTool = {
  name: 'get_advertiser_profile',
  description: `Get a summary profile of an advertiser's ad activity on Google Ads Transparency Center.

Use this tool to:
- Get an overview of a brand's advertising presence
- See verification status and total ad counts
- Understand ad format distribution (text/image/video)
- Identify which platforms they advertise on

Returns name, verification status, ad count by format, and platforms.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      advertiserId: {
        type: 'string',
        description: 'Advertiser ID from Google Ads Transparency',
      },
      region: {
        type: 'string',
        description: 'Region code (e.g., "US", "IN", "GB"). Defaults to US.',
        default: config.defaultRegion,
      },
    },
    required: ['advertiserId'],
  },

  async execute(params: GetAdvertiserProfileParams): Promise<string> {
    try {
      const { advertiserId, region } =
        getAdvertiserProfileSchema.parse(params);

      const profile = await getAdvertiserProfile(advertiserId, region);

      return JSON.stringify({
        success: true,
        advertiserId: profile.id,
        name: profile.name,
        verificationStatus: profile.verificationStatus,
        region: profile.region,
        profileUrl: `https://adstransparency.google.com/advertiser/${advertiserId}?region=${region}`,
        statistics: {
          totalAds: profile.totalAds,
          adsByFormat: profile.adsByFormat,
        },
        platforms: profile.platforms,
        regionsActive: profile.regionsActive,
        lastUpdated: profile.lastUpdated,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
