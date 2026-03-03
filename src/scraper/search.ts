/**
 * Search scraper
 * Search for advertisers by domain or brand name
 */

import { Page } from 'puppeteer';
import { browserManager } from './browser.js';
import { config } from '../config.js';
import { cache, Cache } from '../services/cache.js';
import type { Advertiser, SearchResult, VerificationStatus } from '../types/index.js';

/**
 * Search for advertisers by query (domain or brand name)
 */
export async function searchAdvertisers(
  query: string,
  region: string
): Promise<SearchResult> {
  // Check cache first
  const cacheKey = Cache.searchKey(query, region);
  const cached = cache.get<SearchResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const page = await browserManager.getPage();

  try {
    // Navigate to the base transparency page
    const baseUrl = `https://adstransparency.google.com/?region=${region}`;
    await browserManager.navigateTo(page, baseUrl, {
      waitForNetworkIdle: true,
    });

    // Wait for search input to be ready
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // Type the search query into the search box
    const searchInput = await page.$('input[type="text"]');
    if (searchInput) {
      await searchInput.click();
      await page.keyboard.type(query, { delay: 50 });

      // Wait for autocomplete dropdown to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract results from autocomplete dropdown
      const result = await extractAutocompleteResults(page, query, region);

      // Cache the result
      cache.set(cacheKey, result);

      return result;
    }

    return { advertisers: [], totalResults: 0, query, region };
  } finally {
    await browserManager.releasePage(page);
  }
}

/**
 * Extract results from autocomplete dropdown
 */
async function extractAutocompleteResults(
  page: Page,
  query: string,
  region: string
): Promise<SearchResult> {
  const data = await page.evaluate(() => {
    const advertisers: Array<{
      id: string;
      name: string;
      location: string;
      totalAds: string;
    }> = [];

    // Look for autocomplete results - they typically contain advertiser info
    // The structure shows: Advertiser name, location (Based in), and ad count
    const allText = document.body.innerText;

    // Find all elements that look like autocomplete suggestions
    const suggestionContainers = document.querySelectorAll(
      '[role="option"], [role="listbox"] > *, [class*="suggestion"], [class*="autocomplete"], [class*="dropdown"] > *'
    );

    suggestionContainers.forEach((container) => {
      const text = container.textContent || '';
      // Look for patterns like "Company Name ... India ... ~20.7K ads"
      const adCountMatch = text.match(/~?([\d.]+[KMB]?)\s*ads/i);
      if (adCountMatch) {
        // Try to find advertiser link
        const link = container.querySelector('a[href*="advertiser/"]');
        const href = link?.getAttribute('href') || '';
        const idMatch = href.match(/advertiser\/([A-Z0-9]+)/);

        // Extract name - usually the first significant text
        const nameEl = container.querySelector('[class*="name"], [class*="title"]') || container;
        const name = nameEl.textContent?.split(/Based in|India|~|\d+.*ads/)[0]?.trim() || '';

        if (name && idMatch) {
          advertisers.push({
            id: idMatch[1],
            name: name,
            location: text.includes('India') ? 'India' : '',
            totalAds: adCountMatch[0],
          });
        }
      }
    });

    // Fallback: look for any links with advertiser pattern
    if (advertisers.length === 0) {
      const links = document.querySelectorAll('a[href*="advertiser/"]');
      links.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        const idMatch = href.match(/advertiser\/([A-Z0-9]+)/);
        if (idMatch) {
          const container = link.closest('[role="option"]') || link.parentElement;
          const text = container?.textContent || link.textContent || '';
          const adCountMatch = text.match(/~?([\d.]+[KMB]?)\s*ads/i);

          advertisers.push({
            id: idMatch[1],
            name: text.split(/Based in|~|\d+.*ads/)[0]?.trim() || 'Unknown',
            location: text.includes('India') ? 'India' : '',
            totalAds: adCountMatch?.[0] || '0 ads',
          });
        }
      });
    }

    return advertisers;
  });

  // Parse ad counts to numbers
  const parseAdCount = (str: string): number => {
    const match = str.match(/([\d.]+)([KMB])?/i);
    if (!match) return 0;
    let num = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    if (suffix === 'K') num *= 1000;
    if (suffix === 'M') num *= 1000000;
    if (suffix === 'B') num *= 1000000000;
    return Math.round(num);
  };

  const advertisers: Advertiser[] = data.map((item) => ({
    id: item.id,
    name: item.name,
    verificationStatus: 'UNKNOWN' as VerificationStatus,
    region,
    totalAds: parseAdCount(item.totalAds),
  }));

  return {
    advertisers,
    totalResults: advertisers.length,
    query,
    region,
  };
}

/**
 * Extract search results from page
 */
async function extractSearchResults(
  page: Page,
  query: string,
  region: string
): Promise<SearchResult> {
  const data = await page.evaluate(() => {
    const advertisers: Array<{
      id: string;
      name: string;
      verification: string;
      totalAds: number;
    }> = [];

    // Find advertiser result elements using various selectors
    const resultElements = document.querySelectorAll(
      '[data-advertiser-id], [class*="advertiser-result"], [class*="search-result"], [class*="advertiser-card"]'
    );

    resultElements.forEach((el) => {
      // Extract advertiser ID
      const id =
        el.getAttribute('data-advertiser-id') ||
        el.querySelector('[data-advertiser-id]')?.getAttribute('data-advertiser-id') ||
        el.querySelector('a')?.href?.match(/advertiser\/([A-Z0-9]+)/)?.[1] ||
        '';

      if (!id) return;

      // Extract name
      const nameEl = el.querySelector(
        '[data-advertiser-name], [class*="name"], h3, h4, [class*="title"]'
      );
      const name = nameEl?.textContent?.trim() || 'Unknown';

      // Extract verification status
      const verificationEl = el.querySelector(
        '[data-verification], [class*="verif"]'
      );
      const verificationText = verificationEl?.textContent?.toLowerCase() || '';
      let verification = 'UNKNOWN';
      if (verificationText.includes('verified')) {
        verification = 'VERIFIED';
      } else if (verificationText.includes('not')) {
        verification = 'NOT_VERIFIED';
      }

      // Extract ad count
      const countEl = el.querySelector(
        '[data-ad-count], [class*="ad-count"], [class*="count"]'
      );
      const countText = countEl?.textContent || '0';
      const countMatch = countText.match(/(\d+)/);
      const totalAds = countMatch ? parseInt(countMatch[1], 10) : 0;

      advertisers.push({ id, name, verification, totalAds });
    });

    // Also try to extract from any visible links that look like advertiser links
    if (advertisers.length === 0) {
      const links = document.querySelectorAll('a[href*="advertiser/"]');
      links.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        const idMatch = href.match(/advertiser\/([A-Z0-9]+)/);
        if (idMatch) {
          const id = idMatch[1];
          // Check if already added
          if (!advertisers.find((a) => a.id === id)) {
            const name =
              link.textContent?.trim() ||
              link.querySelector('[class*="name"]')?.textContent?.trim() ||
              'Unknown';
            advertisers.push({
              id,
              name,
              verification: 'UNKNOWN',
              totalAds: 0,
            });
          }
        }
      });
    }

    return advertisers;
  });

  const advertisers: Advertiser[] = data.map((item) => ({
    id: item.id,
    name: item.name,
    verificationStatus: item.verification as VerificationStatus,
    region,
    totalAds: item.totalAds,
  }));

  return {
    advertisers,
    totalResults: advertisers.length,
    query,
    region,
  };
}

/**
 * Search for advertiser by exact domain
 */
export async function searchByDomain(
  domain: string,
  region: string
): Promise<Advertiser | null> {
  // Clean domain (remove protocol, www, etc.)
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();

  const result = await searchAdvertisers(cleanDomain, region);

  // Try to find exact or close match
  const exactMatch = result.advertisers.find(
    (a) =>
      a.name.toLowerCase().includes(cleanDomain) ||
      cleanDomain.includes(a.name.toLowerCase().split(' ')[0])
  );

  return exactMatch || result.advertisers[0] || null;
}

/**
 * Search for advertiser by brand name
 */
export async function searchByBrand(
  brand: string,
  region: string
): Promise<Advertiser[]> {
  const result = await searchAdvertisers(brand, region);

  // Sort by relevance (name similarity)
  const brandLower = brand.toLowerCase();
  return result.advertisers.sort((a, b) => {
    const aScore = a.name.toLowerCase().includes(brandLower) ? 1 : 0;
    const bScore = b.name.toLowerCase().includes(brandLower) ? 1 : 0;
    return bScore - aScore;
  });
}
