/**
 * Puppeteer browser manager with stealth mode
 * Handles browser lifecycle and anti-detection measures
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config.js';
import { rateLimiter } from '../services/rate-limiter.js';
import { ScraperError } from '../types/index.js';

class BrowserManager {
  private browser: Browser | null = null;
  private pagePool: Page[] = [];
  private maxPages: number = 3;
  private stealthEnabled: boolean = false;

  /**
   * Initialize browser with stealth mode
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    // Try to use puppeteer-extra with stealth plugin
    try {
      const puppeteerExtra = await import('puppeteer-extra');
      const stealthPlugin = await import('puppeteer-extra-plugin-stealth');

      const pExtra = puppeteerExtra.default as unknown as {
        use: (plugin: unknown) => void;
        launch: typeof puppeteer.launch;
      };
      const stealth = stealthPlugin.default as unknown as () => unknown;

      pExtra.use(stealth());
      this.browser = await pExtra.launch(launchOptions);
      this.stealthEnabled = true;
      console.error('Browser initialized with stealth mode');
    } catch (err) {
      // Fall back to regular puppeteer
      console.error('Stealth plugin not available, using regular Puppeteer:', err);
      this.browser = await puppeteer.launch(launchOptions);
    }
  }

  /**
   * Get a page from the pool or create a new one
   */
  async getPage(): Promise<Page> {
    await this.initialize();

    if (!this.browser) {
      throw new ScraperError(
        'Browser not initialized',
        'UNKNOWN'
      );
    }

    // Reuse page from pool if available
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      return page;
    }

    // Create new page with anti-detection
    const page = await this.browser.newPage();
    await this.setupPage(page);
    return page;
  }

  /**
   * Return page to pool for reuse
   */
  async releasePage(page: Page): Promise<void> {
    try {
      // Clear page state
      await page.goto('about:blank');

      if (this.pagePool.length < this.maxPages) {
        this.pagePool.push(page);
      } else {
        await page.close();
      }
    } catch {
      // Page might be already closed
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Setup page with anti-detection measures
   */
  private async setupPage(page: Page): Promise<void> {
    // Random user agent
    const userAgent = this.getRandomUserAgent();
    await page.setUserAgent(userAgent);

    // Random viewport
    const viewport = this.getRandomViewport();
    await page.setViewport(viewport);

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Override navigator properties
    await page.evaluateOnNewDocument(() => {
      // Override webdriver detection
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      // Override hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });
    });

    // Set timeouts
    page.setDefaultTimeout(config.browser.timeout);
    page.setDefaultNavigationTimeout(config.browser.navigationTimeout);
  }

  /**
   * Navigate to URL with rate limiting and retry
   */
  async navigateTo(
    page: Page,
    url: string,
    options: {
      waitForSelector?: string;
      waitForNetworkIdle?: boolean;
    } = {}
  ): Promise<void> {
    // Wait for rate limit
    await rateLimiter.acquire();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retry.maxAttempts; attempt++) {
      try {
        const waitUntil = options.waitForNetworkIdle
          ? 'networkidle2'
          : 'domcontentloaded';

        await page.goto(url, { waitUntil });

        // Simulate human-like behavior
        await this.simulateHumanBehavior(page);

        // Wait for specific selector if provided
        if (options.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, {
            timeout: config.browser.waitForSelector,
          });
        }

        return;
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          throw new ScraperError(
            'Rate limited by Google',
            'RATE_LIMITED',
            error
          );
        }

        // Check if page is blocked
        if (this.isBlockedError(error)) {
          throw new ScraperError(
            'Request blocked by Google',
            'BLOCKED',
            error
          );
        }

        // Retry with exponential backoff
        if (attempt < config.retry.maxAttempts) {
          const delay = Math.min(
            config.retry.baseDelayMs * Math.pow(2, attempt - 1),
            config.retry.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    throw new ScraperError(
      `Failed to navigate to ${url} after ${config.retry.maxAttempts} attempts`,
      'NETWORK_ERROR',
      lastError
    );
  }

  /**
   * Simulate human-like behavior
   */
  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Random mouse movements
    const width = page.viewport()?.width ?? 1920;
    const height = page.viewport()?.height ?? 1080;

    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      await page.mouse.move(x, y);
      await this.sleep(Math.random() * 200 + 100);
    }

    // Random scroll
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 300);
    });

    await this.sleep(Math.random() * 500 + 200);
  }

  /**
   * Get random user agent from config
   */
  private getRandomUserAgent(): string {
    const userAgents = config.browser.userAgents;
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Get random viewport from config
   */
  private getRandomViewport(): { width: number; height: number } {
    const viewports = config.browser.viewports;
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  /**
   * Check if error is rate limit related
   */
  private isRateLimitError(error: unknown): boolean {
    const message = String(error);
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('Too Many Requests')
    );
  }

  /**
   * Check if request was blocked
   */
  private isBlockedError(error: unknown): boolean {
    const message = String(error);
    return (
      message.includes('403') ||
      message.includes('blocked') ||
      message.includes('captcha')
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    // Close all pages in pool
    for (const page of this.pagePool) {
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }
    this.pagePool = [];

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance
export const browserManager = new BrowserManager();
