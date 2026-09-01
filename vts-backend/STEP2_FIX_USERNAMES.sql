-- ============================================================================
-- STEP 2: FIX username field (RUN AFTER STEP 1 is successful)
-- Populate NULL usernames and normalize prefixed usernames
-- ============================================================================

-- Show which drivers have NULL or invalid username before fixing
SELECT 
  id, 
  driver_name, 
  phone_number,
  username, 
  CASE
    WHEN username IS NULL THEN 'NULL'
    WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN 'VALID'
    ELSE 'INVALID'
  END as username_status
FROM public.drivers 
WHERE username IS NULL OR LENGTH(username) != 10 OR username ~ '[^0-9]'
ORDER BY id;

-- STEP 2a: Populate NULL usernames from phone_number
UPDATE public.drivers
SET username = phone_number
WHERE username IS NULL AND phone_number IS NOT NULL;

-- STEP 2b: Normalize usernames with +91 prefix (13 chars)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- STEP 2c: Normalize usernames with 91 prefix without + (12 chars)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%';

-- Verify all usernames are now fixed
SELECT 
  id, 
  driver_name, 
  phone_number,
  username,
  CASE 
    WHEN LENGTH(username) = 10 AND username ~ '^[0-9]+$' THEN '✓ VALID' 
    ELSE '✗ INVALID' 
  END as username_status
FROM public.drivers 
ORDER BY id;

-- Expected: All drivers should show "✓ VALID"
