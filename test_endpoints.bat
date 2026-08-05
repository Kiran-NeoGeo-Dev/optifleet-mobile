@echo off
echo ============================================
echo OptiFleet API Endpoint Testing
echo ============================================
echo.

set BASE_URL=http://localhost:8083
set TOKEN_FILE=d:\temp_token.txt
set RESULT_FILE=d:\temp_result.json

echo [TEST 1] Authentication - Forgot Password Message
curl -s %BASE_URL%/api/auth/forgot-password-message
echo.
echo.

echo [TEST 2] Authentication - Valid Login
curl -s -X POST %BASE_URL%/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"superadmin\",\"password\":\"superadmin123\"}" -o %RESULT_FILE%
type %RESULT_FILE%
echo.
echo.

echo [TEST 3] Authentication - Invalid Login (should fail)
curl -s -X POST %BASE_URL%/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"wrong\",\"password\":\"wrong\"}"
echo.
echo.

echo Getting token for authenticated requests...
for /f "tokens=2 delims=:," %%a in ('type %RESULT_FILE% ^| find "token"') do set RAW_TOKEN=%%a
set TOKEN=%RAW_TOKEN:"=%
echo Token obtained

echo.
echo [TEST 4] Client Details (Authenticated)
curl -s %BASE_URL%/api/auth/client-details -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 5] List Vehicles
curl -s %BASE_URL%/api/vehicles -H "Authorization: Bearer %TOKEN%" -o d:\temp_vehicles.json
type d:\temp_vehicles.json
echo.
echo.

echo [TEST 6] List Drivers
curl -s %BASE_URL%/api/drivers -H "Authorization: Bearer %TOKEN%" -o d:\temp_drivers.json
type d:\temp_drivers.json
echo.
echo.

echo [TEST 7] List Trips
curl -s %BASE_URL%/api/trips -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 8] Dashboard Summary
curl -s %BASE_URL%/api/dashboard/summary -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 9] Dashboard Vehicles
curl -s %BASE_URL%/api/dashboard/vehicles -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 10] Dashboard Drivers
curl -s %BASE_URL%/api/dashboard/drivers -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 11] Live Vehicles
curl -s %BASE_URL%/api/dashboard/live-vehicles -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 12] List Associations
curl -s %BASE_URL%/api/associations -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 13] Vehicles for Trip
curl -s %BASE_URL%/api/associations/vehicles-for-trip -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 14] List Notifications
curl -s %BASE_URL%/api/notifications -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 15] System Overview Summary (SuperAdmin only)
curl -s %BASE_URL%/api/superadmin/system-overview/summary -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 16] System Organizations (SuperAdmin only)
curl -s %BASE_URL%/api/superadmin/system-overview/organizations -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo [TEST 17] Create Driver with Expired License (Should FAIL)
curl -s -X POST %BASE_URL%/api/drivers -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"driverName\":\"Test Driver\",\"phoneNumber\":\"9999999999\",\"password\":\"01/01/1990\",\"clientId\":2,\"licenseNumber\":\"TEST123\",\"licenseExpiry\":\"2020-01-01\"}"
echo.
echo.

echo ============================================
echo Testing Complete!
echo ============================================
