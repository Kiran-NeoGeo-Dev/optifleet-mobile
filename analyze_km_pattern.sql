-- ============================================================
-- Analyze km_travelled Pattern in drivers Table
-- ============================================================

-- Check current driver data
SELECT 
    id,
    driver_name,
    km_travelled,
    updated_at,
    created_at,
    TO_CHAR(updated_at, 'YYYY-MM') AS update_month
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id;

-- Check if km_travelled changes over time (history)
-- Do you have any audit/history table?
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%history%' 
       OR table_name LIKE '%audit%'
       OR table_name LIKE '%log%'
       OR table_name LIKE '%driver%');

-- Check if there's a pattern in updated_at
SELECT 
    id,
    driver_name,
    km_travelled,
    updated_at,
    LAG(updated_at) OVER (PARTITION BY id ORDER BY updated_at) AS previous_update,
    updated_at - LAG(updated_at) OVER (PARTITION BY id ORDER BY updated_at) AS time_since_last_update
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id, updated_at;

-- Does km_travelled get reset monthly or accumulate?
-- Check if there are any patterns in the values
SELECT 
    EXTRACT(MONTH FROM updated_at) AS month,
    COUNT(*) AS drivers_updated,
    AVG(km_travelled) AS avg_km,
    MIN(km_travelled) AS min_km,
    MAX(km_travelled) AS max_km
FROM public.drivers
WHERE km_travelled > 0
GROUP BY EXTRACT(MONTH FROM updated_at)
ORDER BY month;
