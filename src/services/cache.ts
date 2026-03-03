/**
 * In-memory cache to reduce scraping load
 * Caches advertiser profiles, ad lists, and search results
 */

import { config } from '../config.js';
import type { CacheEntry } from '../types/index.js';

export class Cache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    if (config.cache.enabled) {
      this.startCleanup();
    }
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    if (!config.cache.enabled) {
      return null;
    }

    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    if (!config.cache.enabled) {
      return;
    }

    // Enforce max entries
    if (this.store.size >= config.cache.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds ?? config.cache.ttlSeconds,
    };

    this.store.set(key, entry);
  }

  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    enabled: boolean;
  } {
    return {
      size: this.store.size,
      maxEntries: config.cache.maxEntries,
      enabled: config.cache.enabled,
    };
  }

  /**
   * Generate cache key for advertiser
   */
  static advertiserKey(advertiserId: string, region: string): string {
    return `advertiser:${advertiserId}:${region}`;
  }

  /**
   * Generate cache key for advertiser ads
   */
  static adsKey(
    advertiserId: string,
    region: string,
    format?: string,
    limit?: number
  ): string {
    return `ads:${advertiserId}:${region}:${format ?? 'all'}:${limit ?? 'all'}`;
  }

  /**
   * Generate cache key for search
   */
  static searchKey(query: string, region: string): string {
    return `search:${query.toLowerCase()}:${region}`;
  }

  /**
   * Generate cache key for ad details
   */
  static adDetailsKey(
    advertiserId: string,
    creativeId: string,
    region: string
  ): string {
    return `ad:${advertiserId}:${creativeId}:${region}`;
  }

  /**
   * Generate cache key for regional analysis
   */
  static regionalKey(advertiserId: string, regions: string[]): string {
    return `regional:${advertiserId}:${regions.sort().join(',')}`;
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldest: { key: string; timestamp: number } | null = null;

    for (const [key, entry] of this.store.entries()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: entry.timestamp };
      }
    }

    if (oldest) {
      this.store.delete(oldest.key);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.timestamp + entry.ttl * 1000) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval (for shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const cache = new Cache();
