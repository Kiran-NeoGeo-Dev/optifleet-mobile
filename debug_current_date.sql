-- Check what the current date is on the database server
SELECT 
    NOW() AS server_current_datetime,
    CURRENT_DATE AS server_current_date,
    EXTRACT(YEAR FROM NOW()) AS current_year,
    EXTRACT(MONTH FROM NOW()) AS current_month,
    TO_CHAR(NOW(), 'Month YYYY') AS current_month_name,
    TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') AS formatted_datetime;

-- Check what month the backend will use by default (current month)
SELECT 
    'Current month data for drivers' AS description,
    d.id,
    d.driver_name,
    d.km_travelled,
    d.updated_at,
    EXTRACT(YEAR FROM NOW()) AS query_year,
    EXTRACT(MONTH FROM NOW()) AS query_month;

-- See if there's telemetry data for the current month
SELECT 
    'Telemetry in current month' AS description,
    vehicle_id,
    COUNT(*) AS record_count,
    MIN(telemetry_time) AS earliest,
    MAX(telemetry_time) AS latest
FROM public.tb_device_telemetry
WHERE (CASE 
    WHEN telemetry_time ~ '^\d{2}-\d{2}-\d{4}\s+' 
        THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS')
    ELSE telemetry_time::timestamptz 
END) >= DATE_TRUNC('month', NOW())
  AND (CASE 
    WHEN telemetry_time ~ '^\d{2}-\d{2}-\d{4}\s+' 
        THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS')
    ELSE telemetry_time::timestamptz 
END) < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
GROUP BY vehicle_id;
