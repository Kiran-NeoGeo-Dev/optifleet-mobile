-- ============================================================================
-- STEP 3: VERIFY both phone_number and username are valid
-- Run this after STEP 1 and STEP 2 to confirm everything is fixed
-- ============================================================================

-- Final verification query
SELECT 
  id, 
  driver_name, 
  phone_number,
  username,
  LENGTH(phone_number) as phone_len,
  LENGTH(username) as username_len,
  CASE 
    WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN '✓' 
    ELSE '✗' 
  END as phone_ok,
  CASE 
    WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN '✓' 
    ELSE '✗' 
  END as username_ok
FROM public.drivers 
ORDER BY id;

-- Count how many are valid vs invalid
SELECT 
  COUNT(*) as total_drivers,
  SUM(CASE WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN 1 ELSE 0 END) as valid_phones,
  SUM(CASE WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN 1 ELSE 0 END) as valid_usernames,
  SUM(CASE WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' AND LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN 1 ELSE 0 END) as fully_valid
FROM public.drivers;

-- Expected result: 
-- - total_drivers = 25
-- - valid_phones = 25
-- - valid_usernames = 25
-- - fully_valid = 25
