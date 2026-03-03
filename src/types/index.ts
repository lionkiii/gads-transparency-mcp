/**
 * TypeScript types for Google Ads Transparency MCP Server
 */

// Advertiser types
export interface Advertiser {
  id: string;
  name: string;
  verificationStatus: VerificationStatus;
  region: string;
  totalAds: number;
  lastSeen?: string;
}

export type VerificationStatus =
  | 'VERIFIED'
  | 'NOT_VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNKNOWN';

export interface AdvertiserProfile {
  id: string;
  name: string;
  verificationStatus: VerificationStatus;
  region: string;
  totalAds: number;
  adsByFormat: {
    text: number;
    image: number;
    video: number;
  };
  platforms: string[];
  regionsActive: string[];
  lastUpdated: string;
}

// Ad types
export interface Ad {
  id: string;
  advertiserId: string;
  advertiserName: string;
  format: AdFormat;
  content: AdContent;
  firstShown: string;
  lastShown: string;
  region: string;
  platforms: string[];
  targeting?: AdTargeting;
}

export type AdFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'UNKNOWN';

export interface AdContent {
  headline?: string;
  description?: string;
  callToAction?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  landingPageUrl?: string;
}

export interface AdTargeting {
  ageRange?: string;
  gender?: string;
  location?: string;
  interests?: string[];
}

export interface AdDetails extends Ad {
  fullContent: AdContent;
  impressionRange?: string;
  spendRange?: string; // Only for political ads
}

// Search types
export interface SearchResult {
  advertisers: Advertiser[];
  totalResults: number;
  query: string;
  region: string;
}

// Regional analysis types
export interface RegionalPresence {
  region: string;
  totalAds: number;
  adsByFormat: {
    text: number;
    image: number;
    video: number;
  };
}

export interface RegionalAnalysis {
  advertiserId: string;
  advertiserName: string;
  regions: RegionalPresence[];
  comparisonDate: string;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Error types
export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly code: ScraperErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export type ScraperErrorCode =
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'BLOCKED'
  | 'UNKNOWN';

// MCP tool parameter types
export interface SearchAdvertiserParams {
  query: string;
  region?: string;
}

export interface GetAdvertiserAdsParams {
  advertiserId: string;
  region?: string;
  format?: 'text' | 'image' | 'video' | 'all';
  limit?: number;
}

export interface GetAdDetailsParams {
  advertiserId: string;
  creativeId: string;
  region?: string;
}

export interface GetAdvertiserProfileParams {
  advertiserId: string;
  region?: string;
}

export interface CompareAdPresenceParams {
  advertiserId: string;
  regions: string[];
}

// Supported regions
export const SUPPORTED_REGIONS = [
  'US', 'GB', 'IN', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'MX',
  'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'CH',
  'BE', 'IE', 'PT', 'NZ', 'SG', 'HK', 'TW', 'KR', 'PH', 'MY',
  'TH', 'ID', 'VN', 'ZA', 'AE', 'SA', 'EG', 'NG', 'KE', 'AR',
  'CL', 'CO', 'PE'
] as const;

export type SupportedRegion = typeof SUPPORTED_REGIONS[number];
