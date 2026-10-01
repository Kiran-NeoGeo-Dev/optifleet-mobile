import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Custom hook for caching API responses with TTL (Time To Live)
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Prevents duplicate API calls when navigating between screens
 * - Caches data in memory with configurable TTL
 * - Deduplicates concurrent requests for the same resource
 * 
 * @param fetchFn - Async function that fetches the data
 * @param cacheKey - Unique key to identify this data in cache
 * @param ttl - Cache time-to-live in milliseconds (default: 10 seconds)
 * @returns { data, loading, error, refetch, clearCache }
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

// Global cache shared across all hook instances
const globalCache = new Map<string, CacheEntry<any>>();

// Global pending requests to deduplicate concurrent calls
const pendingRequests = new Map<string, PendingRequest<any>>();

// Maximum cache size to prevent memory leaks
const MAX_CACHE_SIZE = 100;

export function useCachedData<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  ttl: number = 10000 // 10 seconds default
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getCachedData = useCallback((): T | null => {
    const cached = globalCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < ttl) {
        console.log(`[CACHE] HIT for key: ${cacheKey} (age: ${age}ms)`);
        return cached.data;
      } else {
        console.log(`[CACHE] EXPIRED for key: ${cacheKey} (age: ${age}ms > ${ttl}ms)`);
        globalCache.delete(cacheKey);
      }
    }
    return null;
  }, [cacheKey, ttl]);

  const setCachedData = useCallback((newData: T) => {
    // Implement simple LRU by removing oldest entries when cache is full
    if (globalCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(globalCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];
      if (oldestKey) {
        globalCache.delete(oldestKey);
        console.log(`[CACHE] Removed oldest entry: ${oldestKey}`);
      }
    }

    globalCache.set(cacheKey, {
      data: newData,
      timestamp: Date.now(),
    });
    console.log(`[CACHE] SET for key: ${cacheKey}`);
  }, [cacheKey]);

  const fetchData = useCallback(async (forceRefresh: boolean = false) => {
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData !== null) {
        setData(cachedData);
        setLoading(false);
        setError(null);
        return cachedData;
      }
    }

    // Check if there's already a pending request for this key
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      const pendingAge = Date.now() - pending.timestamp;
      // Reuse pending request if it's less than 5 seconds old
      if (pendingAge < 5000) {
        console.log(`[CACHE] DEDUPE - Reusing pending request for key: ${cacheKey}`);
        try {
          const result = await pending.promise;
          if (isMountedRef.current) {
            setData(result);
            setLoading(false);
            setError(null);
          }
          return result;
        } catch (err) {
          if (isMountedRef.current) {
            setError(err as Error);
            setLoading(false);
          }
          throw err;
        }
      } else {
        // Old pending request, remove it
        pendingRequests.delete(cacheKey);
      }
    }

    // Start loading
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // Create new request and store as pending
    const requestPromise = fetchFn();
    pendingRequests.set(cacheKey, {
      promise: requestPromise,
      timestamp: Date.now(),
    });

    try {
      console.log(`[CACHE] FETCH for key: ${cacheKey}`);
      const result = await requestPromise;

      // Remove from pending requests
      pendingRequests.delete(cacheKey);

      if (isMountedRef.current) {
        setData(result);
        setLoading(false);
        setError(null);
        setCachedData(result);
      }

      return result;
    } catch (err) {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);

      if (isMountedRef.current) {
        setError(err as Error);
        setLoading(false);
      }
      console.error(`[CACHE] ERROR for key: ${cacheKey}`, err);
      throw err;
    }
  }, [cacheKey, fetchFn, getCachedData, setCachedData]);

  const clearCache = useCallback(() => {
    globalCache.delete(cacheKey);
    pendingRequests.delete(cacheKey);
    console.log(`[CACHE] CLEAR for key: ${cacheKey}`);
  }, [cacheKey]);

  const clearAllCache = useCallback(() => {
    globalCache.clear();
    pendingRequests.clear();
    console.log(`[CACHE] CLEAR ALL`);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: (forceRefresh: boolean = false) => fetchData(forceRefresh),
    clearCache,
    clearAllCache,
  };
}

/**
 * Utility function to manually clear cache for a specific key
 */
export function clearCacheForKey(cacheKey: string) {
  globalCache.delete(cacheKey);
  pendingRequests.delete(cacheKey);
  console.log(`[CACHE] MANUAL CLEAR for key: ${cacheKey}`);
}

/**
 * Utility function to clear all cached data
 */
export function clearAllCachedData() {
  globalCache.clear();
  pendingRequests.clear();
  console.log(`[CACHE] MANUAL CLEAR ALL`);
}
