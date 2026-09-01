-- ============================================================================
-- Migration: V1__Normalize_driver_usernames.sql
-- Purpose: Fix BUG-019 - Normalize driver usernames to 10-digit format
-- Description:
--   Strips +91 and 91 prefixes from existing driver usernames to ensure 
--   consistency with OTP authentication flow. The OTP endpoints strip the 
--   +91 prefix before lookup, but usernames were stored with the prefix,
--   causing "Driver not found" errors during OTP authentication.
-- ============================================================================

-- Update usernames that have +91 prefix to 10-digit format
-- Example: "+919549345765" becomes "9549345765"
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- Update usernames that have 91 prefix (without +) to 10-digit format
-- Example: "919549345765" becomes "9549345765"
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND NOT username LIKE '+%';

-- Log the changes for debugging
-- SELECT 
--   id, 
--   driver_name, 
--   username, 
--   phone_number,
--   updated_at
-- FROM public.drivers 
-- WHERE LENGTH(username) != 10
-- ORDER BY id;
