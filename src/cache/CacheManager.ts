import { CacheEntry, CacheConfig, CacheCategory, CacheStats } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('cache');

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
  };

  private config: CacheConfig = {
    tasks: { ttl: 60 * 1000 },        // 1 minute (was 30 seconds)
    projects: { ttl: 600 * 1000 },    // 10 minutes (was 5 minutes)
    analytics: { ttl: 3600 * 1000 },  // 1 hour
    tags: { ttl: 1200 * 1000 },       // 20 minutes (was 10 minutes)
    resources: { ttl: 300 * 1000 },   // 5 minutes
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  public get<T>(category: CacheCategory, key: string): T | null {
    const fullKey = `${category}:${key}`;
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      logger.debug(`Cache miss for ${fullKey}`);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      this.stats.evictions++;
      this.stats.misses++;
      logger.debug(`Cache expired for ${fullKey}`);
      return null;
    }

    this.stats.hits++;
    logger.debug(`Cache hit for ${fullKey}`);
    return entry.data;
  }

  public set<T>(category: CacheCategory, key: string, data: T): void {
    const fullKey = `${category}:${key}`;
    const ttl = this.config[category].ttl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(fullKey, {
      data,
      expiresAt,
      key: fullKey,
    });

    this.stats.size = this.cache.size;
    logger.debug(`Cache set for ${fullKey}, expires in ${ttl}ms`);
  }

  public invalidate(category?: CacheCategory, key?: string): void {
    if (!category) {
      // Clear all cache
      const size = this.cache.size;
      this.cache.clear();
      this.stats.evictions += size;
      logger.info('Cleared entire cache');
    } else if (!key) {
      // Clear category
      let count = 0;
      for (const [cacheKey] of this.cache) {
        if (cacheKey.startsWith(`${category}:`)) {
          this.cache.delete(cacheKey);
          count++;
        }
      }
      this.stats.evictions += count;
      logger.info(`Cleared ${count} entries from ${category} cache`);
    } else {
      // Clear specific key
      const fullKey = `${category}:${key}`;
      if (this.cache.delete(fullKey)) {
        this.stats.evictions++;
        logger.debug(`Invalidated cache for ${fullKey}`);
      }
    }
    
    this.stats.size = this.cache.size;
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }
  
  public clear(category?: keyof CacheConfig): void {
    if (category) {
      // Clear specific category
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(category + ':'));
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.stats.evictions++;
      });
      logger.info(`Cleared ${keysToDelete.length} entries from ${category} cache`);
    } else {
      // Clear all
      const size = this.cache.size;
      this.cache.clear();
      this.stats.evictions += size;
      logger.info(`Cleared all ${size} cache entries`);
    }
    this.stats.size = this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      this.stats.size = this.cache.size;
      logger.debug(`Evicted ${evicted} expired entries`);
    }
  }

  public warm(category: CacheCategory, key: string, fetcher: () => Promise<any>): Promise<any> {
    const cached = this.get(category, key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return fetcher().then(data => {
      this.set(category, key, data);
      return data;
    });
  }
}