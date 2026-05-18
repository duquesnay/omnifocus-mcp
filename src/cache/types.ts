export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  key: string;
}

export interface CacheConfig {
  tasks: { ttl: number };
  projects: { ttl: number };
  analytics: { ttl: number };
  tags: { ttl: number };
  resources: { ttl: number };
}

export type CacheCategory = keyof CacheConfig;

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}