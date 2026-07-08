-- Migration: Extend phone_number column to store combined dial code + number
-- e.g. +919876543210, +619876543210

-- Step 1: Drop the dependent view
DROP VIEW IF EXISTS public.clients;

-- Step 2: Alter the column
ALTER TABLE public.userdetail
  ALTER COLUMN phone_number TYPE VARCHAR(20);

-- Step 3: Recreate the view with its exact original definition
CREATE OR REPLACE VIEW public.clients AS
  SELECT
    ud.client_id,
    ud.username,
    l.password,
    ud.full_name,
    ud.email_address,
    ud.dial_code,
    ud.phone_number,
    ud.role,
    ud.role_description,
    ud.created_at,
    ud.org_id
  FROM public.userdetail ud
  JOIN public.login l ON l.client_id = ud.client_id;

