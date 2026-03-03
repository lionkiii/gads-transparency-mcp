/**
 * Configuration for Google Ads Transparency MCP Server
 * No API keys needed - all data is publicly accessible!
 */

export const config = {
  // Base URL for Google Ads Transparency Center
  baseUrl: 'https://adstransparency.google.com',

  // Rate limiting - IMPORTANT to avoid getting blocked
  rateLimit: {
    requestDelayMs: 2000, // 2 seconds between requests
    maxRequestsPerMinute: 30, // Conservative limit
    randomDelayMs: {
      min: 1000,
      max: 3000,
    },
  },

  // Caching to reduce scraping load
  cache: {
    enabled: true,
    ttlSeconds: 3600, // 1 hour cache
    maxEntries: 1000,
  },

  // Browser/Puppeteer settings
  browser: {
    headless: true,
    timeout: 30000, // 30 seconds
    navigationTimeout: 60000, // 60 seconds for page loads
    waitForSelector: 5000, // Wait up to 5 seconds for elements
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ],
    viewports: [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
    ],
  },

  // Default region
  defaultRegion: 'US',

  // Retry settings
  retry: {
    maxAttempts: 3,
    baseDelayMs: 5000,
    maxDelayMs: 30000,
  },

  // Scraper selectors (may need updates if Google changes the site)
  selectors: {
    // Search page selectors
    searchInput: 'input[type="text"]',
    searchButton: 'button[type="submit"]',
    searchResults: '[data-advertiser-id]',

    // Advertiser page selectors
    advertiserName: 'h1',
    verificationBadge: '[data-verification-status]',
    adCount: '[data-ad-count]',
    adGrid: '[data-ad-grid]',
    adCard: '[data-ad-creative]',

    // Ad card details
    adFormat: '[data-format]',
    adThumbnail: 'img[data-thumbnail]',
    adHeadline: '[data-headline]',
    adDescription: '[data-description]',
    adDateRange: '[data-date-range]',
    adPlatforms: '[data-platforms]',

    // Pagination
    loadMoreButton: '[data-load-more]',
    nextPageButton: '[data-next-page]',
  },

  // URL patterns
  urls: {
    advertiser: (advertiserId: string, region: string) =>
      `https://adstransparency.google.com/advertiser/${advertiserId}?region=${region}`,
    search: (query: string, region: string) =>
      `https://adstransparency.google.com/?region=${region}&query=${encodeURIComponent(query)}`,
    adDetails: (advertiserId: string, creativeId: string, region: string) =>
      `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creativeId}?region=${region}`,
  },
} as const;

export type Config = typeof config;
