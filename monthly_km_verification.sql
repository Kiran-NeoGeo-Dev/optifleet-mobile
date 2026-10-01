-- ============================================================
-- Monthly KM Verification - Based on updated_at
-- ============================================================

-- ============================================================
-- STEP 1: Show Driver KM with updated_at Dates
-- ============================================================
SELECT 
    '=== DRIVER DATA WITH DATES ===' AS section,
    id,
    driver_name,
    km_travelled,
    updated_at,
    EXTRACT(YEAR FROM updated_at) AS update_year,
    EXTRACT(MONTH FROM updated_at) AS update_month,
    TO_CHAR(updated_at, 'Month YYYY') AS update_month_name
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id;

-- ============================================================
-- STEP 2: September 2026 - Which Drivers Should Have KM?
-- ============================================================
SELECT 
    '=== SEPTEMBER 2026 KM ===' AS section,
    id,
    driver_name,
    km_travelled,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = 2026 
         AND EXTRACT(MONTH FROM updated_at) = 9 
            THEN km_travelled
        ELSE 0
    END AS september_km,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = 2026 
         AND EXTRACT(MONTH FROM updated_at) = 9 
            THEN '✅ Will show KM in September'
        ELSE '❌ KM = 0 in September (updated in different month)'
    END AS september_status
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id;

-- ============================================================
-- STEP 3: October 2026 - Which Drivers Should Have KM?
-- ============================================================
SELECT 
    '=== OCTOBER 2026 KM ===' AS section,
    id,
    driver_name,
    km_travelled,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = 2026 
         AND EXTRACT(MONTH FROM updated_at) = 10 
            THEN km_travelled
        ELSE 0
    END AS october_km,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = 2026 
         AND EXTRACT(MONTH FROM updated_at) = 10 
            THEN '✅ Will show KM in October'
        ELSE '❌ KM = 0 in October (updated in different month)'
    END AS october_status
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id;

-- ============================================================
-- STEP 4: Expected Safety Scores for September 2026
-- ============================================================
WITH september_km AS (
    SELECT 
        id,
        driver_name,
        CASE 
            WHEN EXTRACT(YEAR FROM updated_at) = 2026 
             AND EXTRACT(MONTH FROM updated_at) = 9 
                THEN km_travelled
            ELSE 0
        END AS monthly_km
    FROM public.drivers
    WHERE id IN (130, 149, 159, 160, 158)
),
telemetry_events AS (
    SELECT 
        d.id AS driver_id,
        d.driver_name,
        COUNT(t.id) AS total_telemetry_records,
        COALESCE(SUM(CASE WHEN t.smoking_status ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS smoking,
        COALESCE(SUM(CASE WHEN t.mobile_usage ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS mobile,
        COALESCE(SUM(CASE WHEN t.overspeed ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS overspeed,
        COALESCE(SUM(CASE WHEN t.drowsiness_status ILIKE 'Fatigue' THEN 1 ELSE 0 END), 0) AS drowsiness,
        COALESCE(SUM(CASE WHEN t.seatbelt_status ILIKE 'No' THEN 1 ELSE 0 END), 0) AS seatbelt,
        COALESCE(SUM(CASE WHEN t.distraction_status ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS distraction,
        COALESCE(SUM(CASE WHEN t.harsh_braking ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS harsh_braking,
        COALESCE(SUM(CASE WHEN t.harsh_acceleration ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS harsh_accel,
        COALESCE(SUM(CASE WHEN t.rash_turning ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS rash_turning,
        COALESCE(SUM(CASE WHEN t.yawn_alert ILIKE 'Yes' THEN 1 ELSE 0 END), 0) AS yawn_alert
    FROM public.drivers d
    LEFT JOIN public.associations a ON a.driver_id = d.id AND a.status = true
    LEFT JOIN public.vehicles v ON v.id = a.vehicle_id
    LEFT JOIN public.tb_device_telemetry t 
        ON UPPER(t.vehicle_id) = UPPER(v.registration_no)
        AND (CASE 
            WHEN t.telemetry_time ~ '^\d{2}-\d{2}-\d{4}\s+' 
                THEN to_timestamp(t.telemetry_time, 'DD-MM-YYYY HH24:MI:SS')
            ELSE t.telemetry_time::timestamptz 
        END) >= '2026-09-01 00:00:00+05:30'::timestamptz
        AND (CASE 
            WHEN t.telemetry_time ~ '^\d{2}-\d{2}-\d{4}\s+' 
                THEN to_timestamp(t.telemetry_time, 'DD-MM-YYYY HH24:MI:SS')
            ELSE t.telemetry_time::timestamptz 
        END) < '2026-10-01 00:00:00+05:30'::timestamptz
    WHERE d.id IN (130, 149, 159, 160, 158)
    GROUP BY d.id, d.driver_name
)
SELECT 
    '=== SEPTEMBER 2026 EXPECTED RESULTS ===' AS section,
    sk.driver_id,
    sk.driver_name,
    sk.monthly_km AS km_driven,
    te.total_telemetry_records,
    te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + 
    te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert AS total_events,
    (te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + 
     te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5 AS total_weight,
    CASE 
        WHEN sk.monthly_km <= 0 THEN NULL
        ELSE GREATEST(0, LEAST(100, 
            100 - (
                ((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + 
                  te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) 
                / sk.monthly_km * 100
            )
        ))
    END AS expected_safety_score,
    CASE 
        WHEN sk.monthly_km <= 0 THEN 'N/A (No KM in September)'
        WHEN GREATEST(0, LEAST(100, 100 - (((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) / sk.monthly_km * 100))) >= 95 THEN '✅ Excellent'
        WHEN GREATEST(0, LEAST(100, 100 - (((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) / sk.monthly_km * 100))) >= 90 THEN '✅ Very Good'
        WHEN GREATEST(0, LEAST(100, 100 - (((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) / sk.monthly_km * 100))) >= 85 THEN '⚠️ Good'
        WHEN GREATEST(0, LEAST(100, 100 - (((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) / sk.monthly_km * 100))) >= 80 THEN '⚠️ Fair'
        WHEN GREATEST(0, LEAST(100, 100 - (((te.smoking + te.mobile + te.overspeed + te.drowsiness + te.seatbelt + te.distraction + te.harsh_braking + te.harsh_accel + te.rash_turning + te.yawn_alert) * 5) / sk.monthly_km * 100))) >= 75 THEN '⚠️ Poor'
        ELSE '❌ Need Improvement'
    END AS expected_remark
FROM september_km sk
JOIN telemetry_events te ON te.driver_id = sk.driver_id
ORDER BY sk.driver_id;

-- ============================================================
-- STEP 5: Current Month (for Fleet List Default Display)
-- ============================================================
SELECT 
    '=== CURRENT MONTH (Fleet List) ===' AS section,
    id,
    driver_name,
    km_travelled,
    EXTRACT(YEAR FROM NOW()) AS current_year,
    EXTRACT(MONTH FROM NOW()) AS current_month,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM NOW()) 
         AND EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM NOW()) 
            THEN km_travelled
        ELSE 0
    END AS current_month_km,
    CASE 
        WHEN EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM NOW()) 
         AND EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM NOW()) 
            THEN '✅ Will show in Active/Inactive list'
        ELSE '❌ N/A in current month'
    END AS list_display_status
FROM public.drivers
WHERE id IN (130, 149, 159, 160, 158)
ORDER BY id;

-- ============================================================
-- SUMMARY: Expected Behavior
-- ============================================================
SELECT 
    '=== EXPECTED BEHAVIOR SUMMARY ===' AS summary,
    'Fleet List (Active/Inactive tabs)' AS view,
    'Shows current month scores' AS behavior,
    'Based on: updated_at in current month' AS logic
UNION ALL
SELECT '', 'Driver Scorecard Detail', 'Shows selected month score', 'Based on: updated_at matches selected year+month'
UNION ALL
SELECT '', 'Pie Chart', 'Updates when month changes', 'Recalculates based on new month selection'
UNION ALL
SELECT '', 'N/A Display', 'When km_travelled = 0 for that month', 'updated_at not in selected month OR km = 0';
