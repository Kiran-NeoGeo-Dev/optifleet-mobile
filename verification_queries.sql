-- ============================================================
-- Driver Safety Scorecard Verification Queries
-- ============================================================

-- Query 1: Check Driver-Vehicle-Telemetry Connection
-- Shows if drivers have associated vehicles and telemetry records
SELECT 
    d.id AS driver_id,
    d.driver_name,
    d.km_travelled,
    v.registration_no AS vehicle_reg,
    COUNT(t.id) AS telemetry_records_oct_2026
FROM public.drivers d
LEFT JOIN public.associations a ON a.driver_id = d.id AND a.status = true
LEFT JOIN public.vehicles v ON v.id = a.vehicle_id
LEFT JOIN public.tb_device_telemetry t 
    ON UPPER(t.vehicle_id) = UPPER(v.registration_no)
    AND EXTRACT(YEAR FROM t.telemetry_time) = 2026
    AND EXTRACT(MONTH FROM t.telemetry_time) = 10
WHERE d.id IN (130, 149, 159, 160)
GROUP BY d.id, d.driver_name, d.km_travelled, v.registration_no
ORDER BY d.id;

-- ============================================================

-- Query 2: Check Actual Event Counts for Driver 159
-- Shows detailed event breakdown
SELECT 
    vehicle_id,
    COUNT(*) AS total_records,
    SUM(CASE WHEN smoking_status ILIKE 'Yes' THEN 1 ELSE 0 END) AS smoking_events,
    SUM(CASE WHEN mobile_usage ILIKE 'Yes' THEN 1 ELSE 0 END) AS mobile_events,
    SUM(CASE WHEN overspeed ILIKE 'Yes' THEN 1 ELSE 0 END) AS overspeed_events,
    SUM(CASE WHEN drowsiness_status ILIKE 'Fatigue' THEN 1 ELSE 0 END) AS drowsiness_events,
    SUM(CASE WHEN seatbelt_status ILIKE 'No' THEN 1 ELSE 0 END) AS seatbelt_events,
    SUM(CASE WHEN distraction_status ILIKE 'Yes' THEN 1 ELSE 0 END) AS distraction_events,
    SUM(CASE WHEN harsh_braking ILIKE 'Yes' THEN 1 ELSE 0 END) AS harsh_braking_events,
    SUM(CASE WHEN harsh_acceleration ILIKE 'Yes' THEN 1 ELSE 0 END) AS harsh_accel_events,
    SUM(CASE WHEN rash_turning ILIKE 'Yes' THEN 1 ELSE 0 END) AS rash_turning_events,
    SUM(CASE WHEN yawn_alert ILIKE 'Yes' THEN 1 ELSE 0 END) AS yawn_alert_events
FROM public.tb_device_telemetry
WHERE EXTRACT(YEAR FROM telemetry_time) = 2026
  AND EXTRACT(MONTH FROM telemetry_time) = 10
  AND vehicle_id IN (
      SELECT v.registration_no 
      FROM public.associations a 
      JOIN public.vehicles v ON v.id = a.vehicle_id 
      WHERE a.driver_id = 159 AND a.status = true
  )
GROUP BY vehicle_id;

-- ============================================================

-- Query 3: Check for Multiple Active Associations
-- Shows if drivers have multiple active associations
SELECT 
    driver_id,
    d.driver_name,
    COUNT(*) AS active_associations,
    STRING_AGG(v.registration_no, ', ') AS vehicles
FROM public.associations a
JOIN public.drivers d ON d.id = a.driver_id
JOIN public.vehicles v ON v.id = a.vehicle_id
WHERE status = true 
GROUP BY driver_id, d.driver_name
HAVING COUNT(*) > 1;

-- ============================================================

-- Query 4: Check Vehicle ID Whitespace/Case Issues
-- Shows if there are formatting issues with vehicle_id
SELECT DISTINCT 
    vehicle_id,
    LENGTH(vehicle_id) AS length_with_spaces,
    LENGTH(TRIM(vehicle_id)) AS length_trimmed,
    vehicle_id = TRIM(vehicle_id) AS is_clean
FROM public.tb_device_telemetry
WHERE vehicle_id IS NOT NULL
  AND (LENGTH(vehicle_id) != LENGTH(TRIM(vehicle_id))
       OR vehicle_id != UPPER(vehicle_id))
LIMIT 20;

-- ============================================================

-- Query 5: Check Association Details for Test Drivers
-- Shows complete association information
SELECT 
    a.id AS assoc_id,
    a.driver_id,
    d.driver_name,
    a.vehicle_id,
    v.registration_no,
    v.vehicle_model,
    a.status,
    a.client_id,
    a.created_at
FROM public.associations a
JOIN public.drivers d ON d.id = a.driver_id
JOIN public.vehicles v ON v.id = a.vehicle_id
WHERE a.driver_id IN (130, 149, 159, 160)
ORDER BY a.driver_id, a.id DESC;

-- ============================================================

-- Query 6: Sample Telemetry Data for Driver 159's Vehicle
-- Shows actual telemetry values to understand data format
SELECT 
    vehicle_id,
    telemetry_time,
    smoking_status,
    mobile_usage,
    overspeed,
    drowsiness_status,
    seatbelt_status,
    distraction_status,
    harsh_braking,
    harsh_acceleration,
    rash_turning,
    yawn_alert
FROM public.tb_device_telemetry
WHERE EXTRACT(YEAR FROM telemetry_time) = 2026
  AND EXTRACT(MONTH FROM telemetry_time) = 10
  AND vehicle_id IN (
      SELECT v.registration_no 
      FROM public.associations a 
      JOIN public.vehicles v ON v.id = a.vehicle_id 
      WHERE a.driver_id = 159 AND a.status = true
  )
ORDER BY telemetry_time DESC
LIMIT 10;

-- ============================================================

-- Query 7: Check if Telemetry Vehicle IDs Match Vehicle Table
-- Shows mismatches between telemetry and vehicles table
SELECT 
    v.registration_no AS in_vehicles_table,
    t.vehicle_id AS in_telemetry_table,
    UPPER(v.registration_no) = UPPER(t.vehicle_id) AS exact_match,
    COUNT(t.id) AS telemetry_count
FROM public.vehicles v
FULL OUTER JOIN public.tb_device_telemetry t 
    ON UPPER(TRIM(v.registration_no)) = UPPER(TRIM(t.vehicle_id))
WHERE v.registration_no IS NOT NULL OR t.vehicle_id IS NOT NULL
GROUP BY v.registration_no, t.vehicle_id
HAVING v.registration_no IS NULL OR t.vehicle_id IS NULL OR UPPER(v.registration_no) != UPPER(t.vehicle_id)
LIMIT 20;
