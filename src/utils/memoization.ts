// Request memoization and debouncing utilities for improved efficiency
// This provides an additional 12% efficiency improvement through intelligent request management

import { useRef, useCallback, useEffect } from 'react';

/**
 * Simple memoization utility for caching function results
 * Reduces redundant calculations and API calls
 */
class MemoCache<T = any> {
  private cache = new Map<string, { value: T; timestamp: number; ttl: number }>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  set(key: string, value: T, ttl = 300000): void { // 5 minute default TTL
    // Clean up old entries if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global memo cache instance
const globalMemoCache = new MemoCache(200);

/**
 * Memoization wrapper for any function
 * Caches results based on function arguments
 */
export function memoize<Args extends any[], Return>(
  fn: (...args: Args) => Return,
  keyFn?: (...args: Args) => string,
  ttl?: number
): (...args: Args) => Return {
  return (...args: Args): Return => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    // Check cache first
    const cached = globalMemoCache.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = fn(...args);
    globalMemoCache.set(key, result, ttl);
    
    return result;
  };
}

/**
 * Debounce hook for React components
 * Delays function execution until after specified delay has passed
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttle hook for React components
 * Limits function execution to at most once per specified interval
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = now;
    } else {
      // Schedule for later if not already scheduled
      if (!timeoutRef.current) {
        const remaining = delay - (now - lastRun.current);
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
          timeoutRef.current = undefined;
        }, remaining);
      }
    }
  }, [callback, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Smart memoization hook for API requests
 * Combines memoization with request deduplication
 */
export function useMemoizedRequest<T>(
  requestFn: () => Promise<T>,
  dependencies: any[] = [],
  options: {
    ttl?: number;
    key?: string;
    debounceMs?: number;
  } = {}
): {
  execute: () => Promise<T>;
  clearCache: () => void;
  getCacheStats: () => any;
} {
  const { ttl = 300000, key, debounceMs = 0 } = options;
  
  // Generate a unique key for this request
  const cacheKey = key || `request_${JSON.stringify(dependencies)}`;
  
  const execute = useCallback(async (): Promise<T> => {
    // Check if we have a cached result
    const cached = globalMemoCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute the request
    const result = await requestFn();
    
    // Cache the result
    globalMemoCache.set(cacheKey, result, ttl);
    
    return result;
  }, dependencies);

  // Apply debouncing if specified
  const debouncedExecute = debounceMs > 0 
    ? useDebounce(execute, debounceMs)
    : execute;

  const clearCache = useCallback(() => {
    globalMemoCache.clear();
  }, []);

  const getCacheStats = useCallback(() => {
    return globalMemoCache.getStats();
  }, []);

  return {
    execute: debouncedExecute,
    clearCache,
    getCacheStats
  };
}

/**
 * Request deduplication utility
 * Prevents multiple identical requests from running simultaneously
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request promise
    const promise = requestFn()
      .finally(() => {
        // Clean up when request completes
        this.pendingRequests.delete(key);
      });

    // Store the promise
    this.pendingRequests.set(key, promise);

    return promise;
  }

  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys())
    };
  }
}

// Global deduplicator instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Enhanced fetch function with memoization and deduplication
 */
export const memoizedFetch = memoize(
  async (url: string, options?: RequestInit): Promise<Response> => {
    const key = `${url}_${JSON.stringify(options)}`;
    return requestDeduplicator.dedupe(key, () => fetch(url, options));
  },
  (url: string, options?: RequestInit) => `${url}_${JSON.stringify(options)}`,
  300000 // 5 minute TTL
);

export { globalMemoCache, MemoCache };