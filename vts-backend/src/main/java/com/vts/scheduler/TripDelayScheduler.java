package com.vts.scheduler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs every 60 seconds and marks "In Progress" trips as "Delayed"
 * when the current time has passed their planned_end_time.
 *
 * Priority: Completed > Delayed > In Progress > Not Started
 * Completed is set by LiveTrackingService (GPS progress >= 98%).
 * Delayed is set here (time-based).
 * In Progress is set by LiveTrackingService (vehicle moving).
 */
@Component
public class TripDelayScheduler {

    private static final Logger log = LoggerFactory.getLogger(TripDelayScheduler.class);

    private final JdbcTemplate jdbc;

    public TripDelayScheduler(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 60_000)
    public void markDelayedTrips() {
        try {
            int updated = jdbc.update("""
                UPDATE public.trips
                SET    status = 'Delayed', updated_at = NOW()
                WHERE  TRIM(status) IN ('Not Started', 'In Progress')
                  AND  planned_end_time IS NOT NULL
                  AND  NOW() > planned_end_time
                """);
            if (updated > 0) {
                log.info("TripDelayScheduler: marked {} trip(s) as Delayed", updated);
            }
        } catch (Exception e) {
            log.warn("TripDelayScheduler failed: {}", e.getMessage());
        }
    }
}
