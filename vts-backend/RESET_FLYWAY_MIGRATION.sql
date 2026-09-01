-- ============================================================================
-- RESET FLYWAY MIGRATION
-- Run this if you need to re-execute the V1 migration
-- ============================================================================

-- Check current migration history
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;

-- DELETE the V1 migration record to allow it to run again
-- WARNING: Only do this if you want to re-run the migration
DELETE FROM flyway_schema_history 
WHERE script = 'V1__Normalize_driver_usernames.sql';

-- Verify it's deleted
SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;

-- After running the above DELETE, restart the Spring Boot application
-- and Flyway will re-run the V1 migration with the updated SQL
