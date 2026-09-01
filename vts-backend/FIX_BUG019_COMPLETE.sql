-- ============================================================================
-- COMPLETE FIX FOR BUG-019: Normalize phone_number AND username
-- This fixes the constraint violation: chk_drivers_phone_number_10_digits
-- ============================================================================

-- First, check which drivers have invalid phone_number formats
SELECT 
  id, 
  driver_name, 
  phone_number, 
  LENGTH(phone_number) as phone_len,
  username
FROM public.drivers 
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]'
ORDER BY id;

-- Step 1: FIX phone_number field first (this violates the constraint)
-- Strip +91 and 91 prefixes from phone_number to make it 10 digits
UPDATE public.drivers
SET phone_number = 
  CASE 
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN SUBSTRING(phone_number FROM 4)
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM 3)
    ELSE phone_number
  END
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]';

-- Verify phone_number is now fixed
SELECT 
  id, 
  driver_name, 
  phone_number, 
  LENGTH(phone_number) as phone_len,
  CASE WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN 'VALID' ELSE 'INVALID' END as phone_status
FROM public.drivers 
ORDER BY id
LIMIT 30;

-- Step 2: Now populate username from phone_number (for NULL usernames)
UPDATE public.drivers
SET username = phone_number
WHERE username IS NULL AND phone_number IS NOT NULL;

-- Step 3: Verify final result
SELECT 
  id, 
  driver_name, 
  phone_number, 
  username,
  CASE 
    WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN 'PHONE_OK' 
    ELSE 'PHONE_BAD' 
  END as phone_status,
  CASE 
    WHEN username IS NULL THEN 'USERNAME_NULL'
    WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN 'USERNAME_OK'
    ELSE 'USERNAME_BAD'
  END as username_status
FROM public.drivers 
ORDER BY id;

-- Expected result: All drivers should show PHONE_OK and USERNAME_OK
