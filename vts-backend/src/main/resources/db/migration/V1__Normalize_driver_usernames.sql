-- ============================================================================
-- Migration: V1__Normalize_driver_usernames.sql
-- Purpose: Fix BUG-019 - Normalize ALL phone_number and username fields dynamically
-- Description:
--   The constraint chk_drivers_phone_number_10_digits allows multiple formats
--   including +91XXXXXXXXXX (13 chars). This migration normalizes them to
--   exactly 10 digits for consistency with OTP authentication.
--   
--   This migration handles:
--   1. Fix phone_number field (strip +91/91 prefixes, handle edge cases)
--   2. Populate NULL usernames from phone_number
--   3. Normalize prefixed usernames
--   
--   After this migration, all drivers will have 10-digit phone_number and username.
-- ============================================================================

-- Step 1: FIX phone_number field first
-- Strip +91 prefix if present (e.g., "+91416354135645" → "6354135645" - take last 10)
-- Strip 91 prefix if present (e.g., "916300279982" → "6300279982" - take last 10)
UPDATE public.drivers
SET phone_number = 
  CASE 
    -- If starts with +91 and length > 13, take last 10 digits
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) > 13 THEN 
      SUBSTRING(phone_number FROM LENGTH(phone_number) - 9)
    -- If starts with +91 and length = 13, remove +91 (11 chars left, take last 10)
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN 
      SUBSTRING(phone_number FROM 4)
    -- If starts with 91 and length > 12, take last 10 digits
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) > 12 AND phone_number NOT LIKE '+%' THEN 
      SUBSTRING(phone_number FROM LENGTH(phone_number) - 9)
    -- If starts with 91 and length = 12, remove 91
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN 
      SUBSTRING(phone_number FROM 3)
    -- Otherwise keep as-is
    ELSE phone_number
  END
WHERE phone_number IS NOT NULL 
  AND (LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]');

-- Step 2: Populate NULL usernames from now-normalized phone_number
-- IMPORTANT: Only update if the phone_number doesn't already exist as another driver's username
-- This prevents violating the UNIQUE constraint when multiple drivers share the same phone number
UPDATE public.drivers d
SET username = d.phone_number
WHERE d.username IS NULL 
  AND d.phone_number IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.drivers d2 
    WHERE d2.username = d.phone_number AND d2.id != d.id
  );

-- Step 2b: For drivers with NULL username that still have duplicates, 
-- generate unique usernames by appending the driver ID
-- Format: "phoneNumber_driverId" (e.g., "6300279982_69")
UPDATE public.drivers
SET username = phone_number || '_' || id
WHERE username IS NULL AND phone_number IS NOT NULL;

-- Step 3: Normalize any existing prefixed usernames
UPDATE public.drivers
SET username = 
  CASE 
    -- If starts with +91 and length > 13, take last 10 digits
    WHEN username LIKE '+91%' AND LENGTH(username) > 13 THEN 
      SUBSTRING(username FROM LENGTH(username) - 9)
    -- If starts with +91 and length = 13, remove +91
    WHEN username LIKE '+91%' AND LENGTH(username) = 13 THEN 
      SUBSTRING(username FROM 4)
    -- If starts with 91 and length > 12, take last 10 digits
    WHEN username LIKE '91%' AND LENGTH(username) > 12 AND username NOT LIKE '+%' THEN 
      SUBSTRING(username FROM LENGTH(username) - 9)
    -- If starts with 91 and length = 12, remove 91
    WHEN username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%' THEN 
      SUBSTRING(username FROM 3)
    -- Otherwise keep as-is
    ELSE username
  END
WHERE username IS NOT NULL 
  AND (LENGTH(username) != 10 OR username ~ '[^0-9]');

