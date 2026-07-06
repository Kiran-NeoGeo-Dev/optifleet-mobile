-- Migration: Add planned_end_time to trips table for Delayed status support
-- Run once against the database before deploying the updated backend.

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS planned_end_time TIMESTAMPTZ;

-- Backfill existing trips: parse duration string and set planned_end_time = created_at + duration
-- Handles formats: "2.5 hrs", "45 mins", "1 hr 30 mins", "90 mins"
UPDATE public.trips
SET planned_end_time = created_at + (
    CASE
        -- "X.X hrs" or "X hr" only
        WHEN duration ~* '^\s*[\d.]+\s*hrs?\s*$'
            THEN (regexp_replace(duration, '[^\d.]', '', 'g')::numeric * 60) * interval '1 minute'
        -- "X mins" or "X min" only
        WHEN duration ~* '^\s*[\d.]+\s*mins?\s*$'
            THEN regexp_replace(duration, '[^\d.]', '', 'g')::numeric * interval '1 minute'
        -- "X hr Y min" combined
        WHEN duration ~* 'hr' AND duration ~* 'min'
            THEN (
                (regexp_match(duration, '([\d.]+)\s*hr'))[1]::numeric * 60
                + (regexp_match(duration, '([\d.]+)\s*min'))[1]::numeric
            ) * interval '1 minute'
        ELSE NULL
    END
)
WHERE duration IS NOT NULL
  AND planned_end_time IS NULL
  AND TRIM(status) NOT IN ('Completed', 'Cancelled');
