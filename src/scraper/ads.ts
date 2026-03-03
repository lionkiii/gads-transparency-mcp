/**
 * Ads scraper
 * Extracts ad creatives from Google Ads Transparency Center
 */

import { Page } from 'puppeteer';
import { browserManager } from './browser.js';
import { config } from '../config.js';
import { cache, Cache } from '../services/cache.js';
import type { Ad, AdFormat, AdContent, AdDetails } from '../types/index.js';

/**
 * Get all ads for an advertiser
 */
export async function getAdvertiserAds(
  advertiserId: string,
  region: string,
  options: {
    format?: 'text' | 'image' | 'video' | 'all';
    limit?: number;
  } = {}
): Promise<Ad[]> {
  const { format = 'all', limit } = options;

  // Check cache first
  const cacheKey = Cache.adsKey(advertiserId, region, format, limit);
  const cached = cache.get<Ad[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const page = await browserManager.getPage();

  try {
    const url = config.urls.advertiser(advertiserId, region);
    await browserManager.navigateTo(page, url, {
      waitForNetworkIdle: true,
    });

    // Wait for ads to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Extract ads from the page
    let ads = await extractAds(page, advertiserId, region);

    // Filter by format if specified
    if (format !== 'all') {
      const formatUpper = format.toUpperCase() as AdFormat;
      ads = ads.filter((ad) => ad.format === formatUpper);
    }

    // Apply limit if specified
    if (limit && limit > 0) {
      ads = ads.slice(0, limit);
    }

    // Cache the result
    cache.set(cacheKey, ads);

    return ads;
  } finally {
    await browserManager.releasePage(page);
  }
}

/**
 * Extract ads from page
 */
async function extractAds(
  page: Page,
  advertiserId: string,
  region: string
): Promise<Ad[]> {
  // Try to load more ads by scrolling
  await loadMoreAds(page);

  const adsData = await page.evaluate(() => {
    const ads: Array<{
      id: string;
      format: string;
      headline?: string;
      description?: string;
      imageUrl?: string | null;
      thumbnailUrl?: string | null;
      videoUrl?: string | null;
      landingPageUrl?: string | null;
      callToAction?: string;
      firstShown?: string;
      lastShown?: string;
      platforms: string[];
    }> = [];

    // Find all ad elements using various selectors
    const adElements = document.querySelectorAll(
      'creative-preview, [class*="creative-preview"], [data-ad-creative], [class*="ad-card"], [class*="creative-card"]'
    );

    adElements.forEach((adEl, index) => {
      // Generate ID from data attribute or index
      const id =
        adEl.getAttribute('data-creative-id') ||
        adEl.getAttribute('data-ad-id') ||
        `ad-${index}`;

      // Determine format
      const formatAttr = adEl.getAttribute('data-format') || '';
      const classList = adEl.className.toLowerCase();
      let format = 'TEXT';

      if (
        formatAttr.includes('video') ||
        classList.includes('video') ||
        adEl.querySelector('video')
      ) {
        format = 'VIDEO';
      } else if (
        formatAttr.includes('image') ||
        classList.includes('image') ||
        adEl.querySelector('img')
      ) {
        format = 'IMAGE';
      }

      // Extract content
      const headlineEl = adEl.querySelector(
        '[data-headline], [class*="headline"], h3, h4'
      );
      const headline = headlineEl?.textContent?.trim();

      const descEl = adEl.querySelector(
        '[data-description], [class*="description"], [class*="body-text"], p'
      );
      const description = descEl?.textContent?.trim();

      const imgEl = adEl.querySelector('img');
      const imageUrl = imgEl?.src || imgEl?.getAttribute('data-src');
      const thumbnailUrl = imageUrl;

      const videoEl = adEl.querySelector('video');
      const videoUrl = videoEl?.src || videoEl?.querySelector('source')?.src;

      const linkEl = adEl.querySelector('a[href]');
      const landingPageUrl = linkEl?.getAttribute('href');

      const ctaEl = adEl.querySelector('[class*="cta"], [class*="button"], button');
      const callToAction = ctaEl?.textContent?.trim();

      // Extract dates
      const dateEl = adEl.querySelector('[data-date-range], [class*="date"]');
      const dateText = dateEl?.textContent || '';
      const dateMatch = dateText.match(/(\w+ \d+, \d+)/g);
      const firstShown = dateMatch?.[0];
      const lastShown = dateMatch?.[1] || dateMatch?.[0];

      // Extract platforms
      const platformEls = adEl.querySelectorAll('[data-platform], [class*="platform"]');
      const platforms: string[] = [];
      platformEls.forEach((el) => {
        const p = el.textContent?.trim();
        if (p) platforms.push(p);
      });

      ads.push({
        id,
        format,
        headline,
        description,
        imageUrl,
        thumbnailUrl,
        videoUrl,
        landingPageUrl,
        callToAction,
        firstShown,
        lastShown,
        platforms: platforms.length > 0 ? platforms : ['Google'],
      });
    });

    // Get advertiser name
    const nameEl = document.querySelector('h1, [data-advertiser-name]');
    const advertiserName = nameEl?.textContent?.trim() || 'Unknown';

    return { ads, advertiserName };
  });

  return adsData.ads.map((ad) => ({
    id: ad.id,
    advertiserId,
    advertiserName: adsData.advertiserName,
    format: ad.format as AdFormat,
    content: {
      headline: ad.headline,
      description: ad.description,
      callToAction: ad.callToAction,
      imageUrl: ad.imageUrl ?? undefined,
      videoUrl: ad.videoUrl ?? undefined,
      thumbnailUrl: ad.thumbnailUrl ?? undefined,
      landingPageUrl: ad.landingPageUrl ?? undefined,
    },
    firstShown: ad.firstShown || new Date().toISOString().split('T')[0],
    lastShown: ad.lastShown || new Date().toISOString().split('T')[0],
    region,
    platforms: ad.platforms,
  }));
}

/**
 * Load more ads by scrolling and clicking load more buttons
 */
async function loadMoreAds(page: Page, maxScrolls: number = 5): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    // Scroll down
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for potential new content
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try to click "Load More" or "Show More" buttons
    try {
      const loadMoreButton = await page.$(
        '[data-load-more], [class*="load-more"], [class*="show-more"], button:has-text("more")'
      );
      if (loadMoreButton) {
        await loadMoreButton.click();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch {
      // Button not found or not clickable
    }
  }
}

/**
 * Get detailed information about a specific ad
 */
export async function getAdDetails(
  advertiserId: string,
  creativeId: string,
  region: string
): Promise<AdDetails> {
  // Check cache first
  const cacheKey = Cache.adDetailsKey(advertiserId, creativeId, region);
  const cached = cache.get<AdDetails>(cacheKey);
  if (cached) {
    return cached;
  }

  const page = await browserManager.getPage();

  try {
    // Navigate to ad details page if it exists, otherwise extract from list
    const url = config.urls.adDetails(advertiserId, creativeId, region);
    await browserManager.navigateTo(page, url, {
      waitForNetworkIdle: true,
    });

    // Extract detailed ad information
    const details = await extractAdDetails(page, advertiserId, creativeId, region);

    // Cache the result
    cache.set(cacheKey, details);

    return details;
  } catch {
    // Fall back to getting basic ad info from advertiser page
    const ads = await getAdvertiserAds(advertiserId, region);
    const ad = ads.find((a) => a.id === creativeId);

    if (!ad) {
      throw new Error(`Ad ${creativeId} not found for advertiser ${advertiserId}`);
    }

    const details: AdDetails = {
      ...ad,
      fullContent: ad.content,
    };

    cache.set(cacheKey, details);
    return details;
  } finally {
    await browserManager.releasePage(page);
  }
}

/**
 * Extract detailed ad information from page
 */
async function extractAdDetails(
  page: Page,
  advertiserId: string,
  creativeId: string,
  region: string
): Promise<AdDetails> {
  const data = await page.evaluate(() => {
    // Extract all available information
    const headline =
      document.querySelector('[data-headline], [class*="headline"], h1, h2')
        ?.textContent?.trim() || '';

    const description =
      document.querySelector('[data-description], [class*="description"], [class*="body"]')
        ?.textContent?.trim() || '';

    const imgEl = document.querySelector('img[class*="creative"], img[class*="ad"]');
    const imageUrl = (imgEl as HTMLImageElement)?.src || '';

    const videoEl = document.querySelector('video');
    const videoUrl = videoEl?.src || videoEl?.querySelector('source')?.src || '';

    const linkEl = document.querySelector('a[href*="http"]');
    const landingPageUrl = linkEl?.getAttribute('href') || '';

    const ctaEl = document.querySelector('[class*="cta"], button');
    const callToAction = ctaEl?.textContent?.trim() || '';

    // Format detection
    let format = 'TEXT';
    if (videoEl) format = 'VIDEO';
    else if (imgEl) format = 'IMAGE';

    // Date extraction
    const dateText = document.body.textContent || '';
    const dateMatches = dateText.match(/\b\w+ \d{1,2}, \d{4}\b/g);
    const firstShown = dateMatches?.[0] || '';
    const lastShown = dateMatches?.[1] || dateMatches?.[0] || '';

    // Platform extraction
    const platforms: string[] = [];
    document.querySelectorAll('[class*="platform"]').forEach((el) => {
      const p = el.textContent?.trim();
      if (p) platforms.push(p);
    });

    // Impression/spend ranges (for political ads)
    const impressionEl = document.querySelector('[class*="impression"]');
    const impressionRange = impressionEl?.textContent?.trim() || '';

    const spendEl = document.querySelector('[class*="spend"]');
    const spendRange = spendEl?.textContent?.trim() || '';

    // Advertiser name
    const nameEl = document.querySelector('[data-advertiser-name], [class*="advertiser"]');
    const advertiserName = nameEl?.textContent?.trim() || 'Unknown';

    // Targeting info
    const ageEl = document.querySelector('[class*="age"]');
    const genderEl = document.querySelector('[class*="gender"]');
    const locationEl = document.querySelector('[class*="location"]');

    return {
      headline,
      description,
      imageUrl,
      videoUrl,
      landingPageUrl,
      callToAction,
      format,
      firstShown,
      lastShown,
      platforms: platforms.length > 0 ? platforms : ['Google'],
      impressionRange,
      spendRange,
      advertiserName,
      targeting: {
        ageRange: ageEl?.textContent?.trim(),
        gender: genderEl?.textContent?.trim(),
        location: locationEl?.textContent?.trim(),
      },
    };
  });

  return {
    id: creativeId,
    advertiserId,
    advertiserName: data.advertiserName,
    format: data.format as AdFormat,
    content: {
      headline: data.headline || undefined,
      description: data.description || undefined,
      callToAction: data.callToAction || undefined,
      imageUrl: data.imageUrl || undefined,
      videoUrl: data.videoUrl || undefined,
      thumbnailUrl: data.imageUrl || undefined,
      landingPageUrl: data.landingPageUrl || undefined,
    },
    fullContent: {
      headline: data.headline || undefined,
      description: data.description || undefined,
      callToAction: data.callToAction || undefined,
      imageUrl: data.imageUrl || undefined,
      videoUrl: data.videoUrl || undefined,
      thumbnailUrl: data.imageUrl || undefined,
      landingPageUrl: data.landingPageUrl || undefined,
    },
    firstShown: data.firstShown || new Date().toISOString().split('T')[0],
    lastShown: data.lastShown || new Date().toISOString().split('T')[0],
    region,
    platforms: data.platforms,
    targeting: data.targeting.ageRange
      ? {
          ageRange: data.targeting.ageRange,
          gender: data.targeting.gender,
          location: data.targeting.location,
        }
      : undefined,
    impressionRange: data.impressionRange || undefined,
    spendRange: data.spendRange || undefined,
  };
}
