/**
 * MCP Tool: compare_ad_presence
 * Analyze advertiser's ad presence across multiple regions
 */

import { z } from 'zod';
import { getAdvertiserProfile } from '../scraper/advertiser.js';
import { getAdvertiserAds } from '../scraper/ads.js';
import { cache, Cache } from '../services/cache.js';
import { SUPPORTED_REGIONS } from '../types/index.js';
import type { RegionalAnalysis, RegionalPresence } from '../types/index.js';

export const compareAdPresenceSchema = z.object({
  advertiserId: z
    .string()
    .min(1)
    .describe('Advertiser ID from Google Ads Transparency'),
  regions: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe(
      'Array of region codes to compare (e.g., ["US", "GB", "IN"]). Max 10 regions.'
    ),
});

export type CompareAdPresenceParams = z.infer<typeof compareAdPresenceSchema>;

export const compareAdPresenceTool = {
  name: 'compare_ad_presence',
  description: `Compare an advertiser's ad presence across multiple geographic regions.

Use this tool to:
- See where a competitor is most active geographically
- Compare ad volumes and formats across markets
- Identify regional advertising strategies
- Find markets where a brand isn't advertising yet

Returns ad counts and format distribution per region.`,
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
        description: 'Advertiser ID from Google Ads Transparency',
      },
      regions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Array of region codes to compare (e.g., ["US", "GB", "IN"]). Max 10 regions.',
        minItems: 1,
        maxItems: 10,
      },
    },
    required: ['advertiserId', 'regions'],
  },

  async execute(params: CompareAdPresenceParams): Promise<string> {
    try {
      const { advertiserId, regions } = compareAdPresenceSchema.parse(params);

      // Check cache
      const cacheKey = Cache.regionalKey(advertiserId, regions);
      const cached = cache.get<RegionalAnalysis>(cacheKey);
      if (cached) {
        return JSON.stringify({
          success: true,
          ...cached,
          fromCache: true,
        });
      }

      // Validate regions
      const invalidRegions = regions.filter(
        (r) => !SUPPORTED_REGIONS.includes(r as typeof SUPPORTED_REGIONS[number])
      );
      if (invalidRegions.length > 0) {
        return JSON.stringify({
          success: false,
          error: `Invalid region codes: ${invalidRegions.join(', ')}`,
          validRegions: SUPPORTED_REGIONS,
        });
      }

      // Fetch data for each region (with rate limiting)
      const regionalData: RegionalPresence[] = [];
      let advertiserName = 'Unknown';

      for (const region of regions) {
        try {
          // Get profile for the region
          const profile = await getAdvertiserProfile(advertiserId, region);

          if (advertiserName === 'Unknown') {
            advertiserName = profile.name;
          }

          // Get detailed ad counts
          const ads = await getAdvertiserAds(advertiserId, region, {
            limit: 100, // Sample size
          });

          const formatCounts = ads.reduce(
            (acc, ad) => {
              const format = ad.format.toLowerCase() as 'text' | 'image' | 'video';
              if (format in acc) {
                acc[format]++;
              }
              return acc;
            },
            { text: 0, image: 0, video: 0 }
          );

          regionalData.push({
            region,
            totalAds: profile.totalAds || ads.length,
            adsByFormat: formatCounts,
          });
        } catch (error) {
          // Region may have no ads
          regionalData.push({
            region,
            totalAds: 0,
            adsByFormat: { text: 0, image: 0, video: 0 },
          });
        }
      }

      // Sort by total ads
      regionalData.sort((a, b) => b.totalAds - a.totalAds);

      const analysis: RegionalAnalysis = {
        advertiserId,
        advertiserName,
        regions: regionalData,
        comparisonDate: new Date().toISOString(),
      };

      // Cache the result
      cache.set(cacheKey, analysis);

      // Calculate summary statistics
      const totalAdsAcrossRegions = regionalData.reduce(
        (sum, r) => sum + r.totalAds,
        0
      );
      const mostActiveRegion = regionalData[0];
      const leastActiveRegion = regionalData[regionalData.length - 1];

      return JSON.stringify({
        success: true,
        advertiserId,
        advertiserName,
        comparisonDate: analysis.comparisonDate,
        summary: {
          totalRegionsAnalyzed: regions.length,
          totalAdsAcrossRegions,
          mostActiveRegion: mostActiveRegion?.region || 'N/A',
          mostActiveAds: mostActiveRegion?.totalAds || 0,
          leastActiveRegion: leastActiveRegion?.region || 'N/A',
          leastActiveAds: leastActiveRegion?.totalAds || 0,
        },
        regionalBreakdown: regionalData.map((r) => ({
          region: r.region,
          totalAds: r.totalAds,
          adsByFormat: r.adsByFormat,
          percentageOfTotal:
            totalAdsAcrossRegions > 0
              ? Math.round((r.totalAds / totalAdsAcrossRegions) * 100)
              : 0,
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
