-- ============================================================
-- Telemetry Data Type and Format Diagnostic
-- ============================================================

-- Query 1: Check data type of telemetry_time column
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'tb_device_telemetry' 
  AND column_name = 'telemetry_time';

-- ============================================================

-- Query 2: Check actual telemetry_time values and formats
SELECT 
    vehicle_id,
    telemetry_time,
    pg_typeof(telemetry_time) AS data_type,
    telemetry_time ~ '^\d{2}-\d{2}-\d{4}\s+' AS is_varchar_format
FROM public.tb_device_telemetry
WHERE vehicle_id IN ('TR05O0919', 'TR01K0968', 'TS08JF0747', 'TS09AB1234')
LIMIT 10;

-- ============================================================

-- Query 3: Try simple EXTRACT (what backend uses) for all 4 vehicles
SELECT 
    vehicle_id,
    COUNT(*) AS total_records,
    COUNT(CASE WHEN EXTRACT(YEAR FROM telemetry_time::timestamp) = 2026 
                AND EXTRACT(MONTH FROM telemetry_time::timestamp) = 10 
           THEN 1 END) AS oct_2026_records_simple_extract
FROM public.tb_device_telemetry
WHERE vehicle_id IN ('TR05O0919', 'TR01K0968', 'TS08JF0747', 'TS09AB1234')
GROUP BY vehicle_id;

-- ============================================================

-- Query 4: Check if there's ANY telemetry data for the 3 drivers with 0 records
SELECT 
    vehicle_id,
    COUNT(*) AS total_records,
    MIN(telemetry_time) AS earliest_telemetry,
    MAX(telemetry_time) AS latest_telemetry
FROM public.tb_device_telemetry
WHERE vehicle_id IN ('TR05O0919', 'TR01K0968', 'TS08JF0747')
GROUP BY vehicle_id;

-- ============================================================

-- Query 5: Check what the backend query actually returns (exact copy from Java code)
SELECT 
    COALESCE(SUM(CASE WHEN smoking_status     ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS smoking,
    COALESCE(SUM(CASE WHEN mobile_usage       ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS mobile,
    COALESCE(SUM(CASE WHEN overspeed          ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS overspeed,
    COALESCE(SUM(CASE WHEN drowsiness_status  ILIKE 'Fatigue' THEN 1 ELSE 0 END),0) AS drowsiness,
    COALESCE(SUM(CASE WHEN seatbelt_status    ILIKE 'No'     THEN 1 ELSE 0 END),0) AS seatbelt,
    COALESCE(SUM(CASE WHEN distraction_status ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS distraction,
    COALESCE(SUM(CASE WHEN harsh_braking      ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS harsh_braking,
    COALESCE(SUM(CASE WHEN harsh_acceleration ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS harsh_acceleration,
    COALESCE(SUM(CASE WHEN rash_turning       ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS rash_turning,
    COALESCE(SUM(CASE WHEN yawn_alert         ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS yawn_alert
FROM public.tb_device_telemetry
WHERE UPPER(vehicle_id) = UPPER('TS08JF0747')
  AND EXTRACT(YEAR  FROM telemetry_time) = 2026
  AND EXTRACT(MONTH FROM telemetry_time) = 10;

-- ============================================================

-- Query 6: Check case sensitivity of vehicle_id matching
SELECT 
    t.vehicle_id AS telemetry_vehicle_id,
    v.registration_no AS vehicles_table_reg,
    t.vehicle_id = v.registration_no AS exact_match,
    UPPER(t.vehicle_id) = UPPER(v.registration_no) AS case_insensitive_match
FROM public.tb_device_telemetry t
CROSS JOIN public.vehicles v
WHERE v.registration_no IN ('TR05O0919', 'TR01K0968', 'TS08JF0747', 'TS09AB1234')
  AND (UPPER(t.vehicle_id) = UPPER(v.registration_no) 
       OR t.vehicle_id = v.registration_no)
GROUP BY t.vehicle_id, v.registration_no
ORDER BY v.registration_no;
