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
 * Status Transition Logic:
 * - Not Started → In Progress: Vehicle starts moving (speed >= 5 km/h) - handled by LiveTrackingService
 * - In Progress → Delayed: Current time exceeds planned_end_time - handled by this scheduler
 * - In Progress/Delayed → Completed: Trip progress >= 98% - handled by LiveTrackingService
 * - Delayed → In Progress: Vehicle resumes movement (speed >= 5 km/h) - handled by LiveTrackingService
 *
 * IMPORTANT: "Not Started" trips should NOT become "Delayed" just because time passed.
 * They remain "Not Started" until the vehicle actually moves.
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
            // Only mark "In Progress" trips as "Delayed" when time exceeds planned end time.
            // "Not Started" trips should NOT become "Delayed" just because time passed.
            // They should only transition to "In Progress" when vehicle actually moves.
            int updated = jdbc.update("""
                UPDATE public.trips
                SET    status = 'Delayed', updated_at = NOW()
                WHERE  TRIM(status) = 'In Progress'
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
