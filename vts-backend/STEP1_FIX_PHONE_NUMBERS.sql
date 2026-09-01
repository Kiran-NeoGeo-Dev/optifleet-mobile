-- ============================================================================
-- STEP 1: FIX phone_number field (MUST RUN FIRST)
-- This resolves: ERROR: violates check constraint "chk_drivers_phone_number_10_digits"
-- ============================================================================

-- Show which drivers have invalid phone_number before fixing
SELECT 
  id, 
  driver_name, 
  phone_number, 
  LENGTH(phone_number) as phone_len
FROM public.drivers 
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]'
ORDER BY id;

-- FIX: Strip +91 and 91 prefixes from phone_number to make it exactly 10 digits
UPDATE public.drivers
SET phone_number = 
  CASE 
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN SUBSTRING(phone_number FROM 4)
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM 3)
    ELSE phone_number
  END
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]';

-- Verify all phone_numbers are now fixed
SELECT 
  id, 
  driver_name, 
  phone_number, 
  LENGTH(phone_number) as phone_len,
  CASE 
    WHEN LENGTH(phone_number) = 10 AND phone_number ~ '^[0-9]+$' THEN '✓ VALID' 
    ELSE '✗ INVALID' 
  END as status
FROM public.drivers 
ORDER BY id;

-- Expected: All drivers should show "✓ VALID"
