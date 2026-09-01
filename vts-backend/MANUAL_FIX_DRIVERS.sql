-- ============================================================================
-- MANUAL FIX SCRIPT: Normalize phone_number AND username fields
-- Run this manually if Flyway migration didn't execute
-- ============================================================================

-- Step 1: FIX phone_number field FIRST (this violates the constraint)
-- The constraint chk_drivers_phone_number_10_digits requires phone_number to be exactly 10 digits
UPDATE public.drivers
SET phone_number = 
  CASE 
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN SUBSTRING(phone_number FROM 4)
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM 3)
    ELSE phone_number
  END
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]';

-- Step 2: Populate NULL usernames from phone_number
UPDATE public.drivers
SET username = phone_number
WHERE username IS NULL AND phone_number IS NOT NULL;

-- Step 3: Normalize usernames with +91 prefix (13 chars)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- Step 4: Normalize usernames with 91 prefix without + (12 chars)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%';

-- Verification: Check all drivers
SELECT 
  id, 
  driver_name, 
  phone_number,
  username,
  LENGTH(phone_number) as phone_len,
  LENGTH(username) as username_len,
  CASE 
    WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN 'PHONE_OK' 
    ELSE 'PHONE_BAD' 
  END as phone_status,
  CASE 
    WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN 'USERNAME_OK'
    ELSE 'USERNAME_BAD'
  END as username_status
FROM public.drivers 
ORDER BY id;
