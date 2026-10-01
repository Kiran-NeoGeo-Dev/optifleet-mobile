package com.vts.scheduler;

import com.vts.service.ThingsBoardDirectQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled task to clean up expired cache entries from ThingsBoardDirectQueryService.
 * Runs every 30 seconds to remove stale telemetry data and limit geocode cache size.
 * 
 * PERFORMANCE OPTIMIZATION: Prevents memory leaks and keeps cache size manageable
 */
@Component
public class CacheCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(CacheCleanupScheduler.class);
    
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public CacheCleanupScheduler(ThingsBoardDirectQueryService thingsBoardDirectQueryService) {
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
    }

    /**
     * Clean up expired telemetry cache entries every 30 seconds.
     * This prevents memory buildup and ensures fresh data.
     */
    @Scheduled(fixedDelay = 30_000) // 30 seconds
    public void cleanupExpiredCacheEntries() {
        try {
            thingsBoardDirectQueryService.cleanupExpiredCache();
            log.debug("[CACHE_CLEANUP] Expired cache entries cleaned up");
        } catch (Exception e) {
            log.error("[CACHE_CLEANUP] Error during cache cleanup: {}", e.getMessage());
        }
    }
}
