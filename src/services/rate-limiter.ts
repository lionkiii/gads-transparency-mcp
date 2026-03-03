/**
 * Rate limiter to prevent getting blocked by Google
 * Implements token bucket algorithm with random delays
 */

import { config } from '../config.js';

class RateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private processing: boolean = false;

  /**
   * Wait for rate limit allowance before proceeding
   */
  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();

      // Reset window if minute has passed
      if (now - this.windowStart >= 60000) {
        this.windowStart = now;
        this.requestCount = 0;
      }

      // Check if we've exceeded requests per minute
      if (this.requestCount >= config.rateLimit.maxRequestsPerMinute) {
        const waitTime = 60000 - (now - this.windowStart);
        await this.sleep(waitTime);
        continue;
      }

      // Calculate delay since last request
      const timeSinceLastRequest = now - this.lastRequestTime;
      const baseDelay = config.rateLimit.requestDelayMs;

      if (timeSinceLastRequest < baseDelay) {
        await this.sleep(baseDelay - timeSinceLastRequest);
      }

      // Add random delay for human-like behavior
      const randomDelay = this.getRandomDelay();
      await this.sleep(randomDelay);

      // Update state and resolve
      this.lastRequestTime = Date.now();
      this.requestCount++;

      const item = this.queue.shift();
      if (item) {
        item.resolve();
      }
    }

    this.processing = false;
  }

  /**
   * Get random delay within configured range
   */
  private getRandomDelay(): number {
    const { min, max } = config.rateLimit.randomDelayMs;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsInWindow: number;
    maxRequestsPerMinute: number;
    queueLength: number;
    windowResetIn: number;
  } {
    const now = Date.now();
    return {
      requestsInWindow: this.requestCount,
      maxRequestsPerMinute: config.rateLimit.maxRequestsPerMinute,
      queueLength: this.queue.length,
      windowResetIn: Math.max(0, 60000 - (now - this.windowStart)),
    };
  }

  /**
   * Clear the queue (for shutdown)
   */
  clear(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        item.reject(new Error('Rate limiter cleared'));
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
