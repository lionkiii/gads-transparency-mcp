/**
 * Advertiser profile scraper
 * Extracts advertiser information from Google Ads Transparency Center
 */

import { Page } from 'puppeteer';
import { browserManager } from './browser.js';
import { config } from '../config.js';
import { cache, Cache } from '../services/cache.js';
import type {
  AdvertiserProfile,
  VerificationStatus,
  ScraperError,
} from '../types/index.js';

/**
 * Get advertiser profile by ID and region
 */
export async function getAdvertiserProfile(
  advertiserId: string,
  region: string
): Promise<AdvertiserProfile> {
  // Check cache first
  const cacheKey = Cache.advertiserKey(advertiserId, region);
  const cached = cache.get<AdvertiserProfile>(cacheKey);
  if (cached) {
    return cached;
  }

  const page = await browserManager.getPage();

  try {
    const url = config.urls.advertiser(advertiserId, region);
    await browserManager.navigateTo(page, url, {
      waitForNetworkIdle: true,
    });

    // Wait for page to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Extract profile data
    const profile = await extractAdvertiserProfile(page, advertiserId, region);

    // Cache the result
    cache.set(cacheKey, profile);

    return profile;
  } finally {
    await browserManager.releasePage(page);
  }
}

/**
 * Extract advertiser profile from page
 */
async function extractAdvertiserProfile(
  page: Page,
  advertiserId: string,
  region: string
): Promise<AdvertiserProfile> {
  const data = await page.evaluate(() => {
    // Try to find advertiser name
    const nameElement =
      document.querySelector('h1') ||
      document.querySelector('[data-advertiser-name]') ||
      document.querySelector('[class*="advertiser-name"]');
    const name = nameElement?.textContent?.trim() || 'Unknown Advertiser';

    // Try to find verification status
    const verificationElement =
      document.querySelector('[data-verification-status]') ||
      document.querySelector('[class*="verification"]') ||
      document.querySelector('[class*="verified"]');
    const verificationText = verificationElement?.textContent?.toLowerCase() || '';
    let verification = 'UNKNOWN';
    if (verificationText.includes('verified')) {
      verification = 'VERIFIED';
    } else if (verificationText.includes('not verified')) {
      verification = 'NOT_VERIFIED';
    } else if (verificationText.includes('partial')) {
      verification = 'PARTIALLY_VERIFIED';
    }

    // Try to find ad count
    const adCountElement =
      document.querySelector('[data-ad-count]') ||
      document.querySelector('[class*="ad-count"]') ||
      document.querySelector('[class*="total-ads"]');
    const adCountText = adCountElement?.textContent || '0';
    const adCountMatch = adCountText.match(/(\d+)/);
    const totalAds = adCountMatch ? parseInt(adCountMatch[1], 10) : 0;

    // Count ads by format from visible elements
    const allAds = document.querySelectorAll('[data-ad-creative], [class*="ad-card"], [class*="creative"]');
    let textAds = 0;
    let imageAds = 0;
    let videoAds = 0;

    allAds.forEach((ad) => {
      const formatAttr = ad.getAttribute('data-format') || '';
      const classList = ad.className.toLowerCase();

      if (formatAttr.includes('video') || classList.includes('video')) {
        videoAds++;
      } else if (formatAttr.includes('image') || classList.includes('image') || ad.querySelector('img')) {
        imageAds++;
      } else {
        textAds++;
      }
    });

    // Estimate total if we couldn't count
    if (totalAds === 0 && allAds.length > 0) {
      // Use visible count as estimate
    }

    // Try to find platforms
    const platformElements = document.querySelectorAll('[data-platform], [class*="platform"]');
    const platforms: string[] = [];
    platformElements.forEach((el) => {
      const platform = el.textContent?.trim();
      if (platform && !platforms.includes(platform)) {
        platforms.push(platform);
      }
    });

    // Default platforms if none found
    if (platforms.length === 0) {
      platforms.push('Google Search', 'YouTube', 'Display Network');
    }

    return {
      name,
      verification,
      totalAds: totalAds || allAds.length,
      adsByFormat: {
        text: textAds,
        image: imageAds,
        video: videoAds,
      },
      platforms,
    };
  });

  return {
    id: advertiserId,
    name: data.name,
    verificationStatus: data.verification as VerificationStatus,
    region,
    totalAds: data.totalAds,
    adsByFormat: data.adsByFormat,
    platforms: data.platforms,
    regionsActive: [region], // We only know about the requested region
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Check if advertiser exists
 */
export async function advertiserExists(
  advertiserId: string,
  region: string
): Promise<boolean> {
  const page = await browserManager.getPage();

  try {
    const url = config.urls.advertiser(advertiserId, region);
    await browserManager.navigateTo(page, url, {
      waitForNetworkIdle: true,
    });

    // Check for error indicators
    const notFound = await page.evaluate(() => {
      const body = document.body.textContent?.toLowerCase() || '';
      return (
        body.includes('not found') ||
        body.includes('no ads') ||
        body.includes('doesn\'t exist') ||
        document.querySelector('[class*="error"]') !== null
      );
    });

    return !notFound;
  } catch {
    return false;
  } finally {
    await browserManager.releasePage(page);
  }
}
