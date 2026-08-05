# OptiFleet API Endpoint Testing Script
# Date: August 4, 2026

$baseUrl = "http://localhost:8083"
$testResults = @()
$failedTests = @()

Write-Host "=== OptiFleet API Endpoint Testing ===" -ForegroundColor Cyan
Write-Host "Testing all endpoints systematically...`n"

# Test Counter
$totalTests = 0
$passedTests = 0
$failedTestsCount = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = "",
        [hashtable]$Headers = @{},
        [int]$ExpectedStatus = 200,
        [string]$Description = ""
    )
    
    $script:totalTests++
    Write-Host "[$script:totalTests] Testing: $Name" -ForegroundColor Yellow
    Write-Host "    Method: $Method | Endpoint: $Endpoint"
    
    try {
        $uri = "$baseUrl$Endpoint"
        $params = @{
            Uri = $uri
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        
        if ($Headers.Count -gt 0) {
            $params['Headers'] = $Headers
        }
        
        if ($Body -ne "") {
            $params['Body'] = $Body
            if (-not $Headers.ContainsKey('Content-Type')) {
                $params['ContentType'] = 'application/json'
            }
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "    ✓ PASS - Status: $statusCode" -ForegroundColor Green
            $script:passedTests++
            $script:testResults += [PSCustomObject]@{
                Test = $Name
                Method = $Method
                Endpoint = $Endpoint
                Status = "PASS"
                StatusCode = $statusCode
                Description = $Description
            }
        } else {
            Write-Host "    ✗ FAIL - Expected: $ExpectedStatus, Got: $statusCode" -ForegroundColor Red
            $script:failedTestsCount++
            $script:failedTests += "$Name - Expected $ExpectedStatus, got $statusCode"
            $script:testResults += [PSCustomObject]@{
                Test = $Name
                Method = $Method
                Endpoint = $Endpoint
                Status = "FAIL"
                StatusCode = $statusCode
                Description = "Expected $ExpectedStatus"
            }
        }
        
        return $response
    }
    catch {
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
        Write-Host "    ✗ FAIL - Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "    Status Code: $statusCode" -ForegroundColor Red
        $script:failedTestsCount++
        $script:failedTests += "$Name - $($_.Exception.Message)"
        $script:testResults += [PSCustomObject]@{
            Test = $Name
            Method = $Method
            Endpoint = $Endpoint
            Status = "FAIL"
            StatusCode = $statusCode
            Description = $_.Exception.Message
        }
        return $null
    }
    
    Write-Host ""
}

# ===========================
# 1. AUTHENTICATION TESTS
# ===========================
Write-Host "`n=== 1. AUTHENTICATION ENDPOINTS ===" -ForegroundColor Cyan

# Test 1: Forgot Password Message
Test-Endpoint -Name "Forgot Password Message" -Method GET -Endpoint "/api/auth/forgot-password-message" -ExpectedStatus 200

# Test 2: Valid Login
$loginBody = @{
    username = "superadmin"
    password = "superadmin123"
} | ConvertTo-Json

$loginResponse = Test-Endpoint -Name "Valid Superadmin Login" -Method POST -Endpoint "/api/auth/login" -Body $loginBody -ExpectedStatus 200

if ($loginResponse) {
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $global:authToken = $loginData.token
    $global:authHeaders = @{
        "Authorization" = "Bearer $global:authToken"
        "Content-Type" = "application/json"
    }
    Write-Host "✓ Token obtained successfully" -ForegroundColor Green
    Write-Host "  Client ID: $($loginData.clientId)"
    Write-Host "  Role: $($loginData.role)`n"
}

# Test 3: Invalid Login
$invalidLoginBody = @{
    username = "invalid"
    password = "wrong"
} | ConvertTo-Json

Test-Endpoint -Name "Invalid Login" -Method POST -Endpoint "/api/auth/login" -Body $invalidLoginBody -ExpectedStatus 401

# Test 4: Get Client Details (Authenticated)
if ($global:authHeaders) {
    Test-Endpoint -Name "Get Client Details" -Method GET -Endpoint "/api/auth/client-details" -Headers $global:authHeaders -ExpectedStatus 200
}

# ===========================
# 2. VEHICLE ENDPOINTS
# ===========================
Write-Host "`n=== 2. VEHICLE ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 5: List all vehicles
    $vehiclesResponse = Test-Endpoint -Name "List All Vehicles" -Method GET -Endpoint "/api/vehicles" -Headers $global:authHeaders -ExpectedStatus 200
    
    if ($vehiclesResponse) {
        $vehicles = $vehiclesResponse.Content | ConvertFrom-Json
        Write-Host "  Found $($vehicles.Count) vehicles" -ForegroundColor Gray
        
        if ($vehicles.Count -gt 0) {
            $global:testVehicleId = $vehicles[0].id
            $global:testVehicleRegNo = $vehicles[0].licensePlate
            Write-Host "  Using vehicle ID: $global:testVehicleId for testing`n" -ForegroundColor Gray
            
            # Test 6: Get specific vehicle
            Test-Endpoint -Name "Get Vehicle By ID" -Method GET -Endpoint "/api/vehicles/$global:testVehicleId" -Headers $global:authHeaders -ExpectedStatus 200
        }
    }
    
    # Test 7: Create vehicle with duplicate registration (should fail)
    $duplicateVehicleBody = @{
        licensePlate = $global:testVehicleRegNo
        clientId = 2
        vehicleMake = "Test"
        vehicleModel = "Test"
    } | ConvertTo-Json
    
    if ($global:testVehicleRegNo) {
        Test-Endpoint -Name "Create Duplicate Vehicle" -Method POST -Endpoint "/api/vehicles" -Body $duplicateVehicleBody -Headers $global:authHeaders -ExpectedStatus 400 -Description "Should reject duplicate registration"
    }
}

# ===========================
# 3. DRIVER ENDPOINTS
# ===========================
Write-Host "`n=== 3. DRIVER ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 8: List all drivers
    $driversResponse = Test-Endpoint -Name "List All Drivers" -Method GET -Endpoint "/api/drivers" -Headers $global:authHeaders -ExpectedStatus 200
    
    if ($driversResponse) {
        $drivers = $driversResponse.Content | ConvertFrom-Json
        Write-Host "  Found $($drivers.Count) drivers" -ForegroundColor Gray
        
        if ($drivers.Count -gt 0) {
            $global:testDriverId = $drivers[0].id
            Write-Host "  Using driver ID: $global:testDriverId for testing`n" -ForegroundColor Gray
            
            # Test 9: Get specific driver
            Test-Endpoint -Name "Get Driver By ID" -Method GET -Endpoint "/api/drivers/$global:testDriverId" -Headers $global:authHeaders -ExpectedStatus 200
        }
    }
    
    # Test 10: Create driver with expired license (should fail after our fix)
    $expiredLicenseBody = @{
        driverName = "Test Driver"
        phoneNumber = "9999999999"
        password = "01/01/1990"
        clientId = 2
        licenseNumber = "TEST123"
        licenseExpiry = "2020-01-01"
    } | ConvertTo-Json
    
    Test-Endpoint -Name "Create Driver with Expired License" -Method POST -Endpoint "/api/drivers" -Body $expiredLicenseBody -Headers $global:authHeaders -ExpectedStatus 400 -Description "Should reject expired license"
}

# ===========================
# 4. TRIP ENDPOINTS
# ===========================
Write-Host "`n=== 4. TRIP ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 11: List all trips
    $tripsResponse = Test-Endpoint -Name "List All Trips" -Method GET -Endpoint "/api/trips" -Headers $global:authHeaders -ExpectedStatus 200
    
    if ($tripsResponse) {
        $trips = $tripsResponse.Content | ConvertFrom-Json
        Write-Host "  Found $($trips.Count) trips" -ForegroundColor Gray
        
        if ($trips.Count -gt 0) {
            $global:testTripId = $trips[0].id
            Write-Host "  Using trip ID: $global:testTripId for testing`n" -ForegroundColor Gray
            
            # Test 12: Get specific trip
            Test-Endpoint -Name "Get Trip By ID" -Method GET -Endpoint "/api/trips/$global:testTripId" -Headers $global:authHeaders -ExpectedStatus 200
            
            # Test 13: Get trip stops
            Test-Endpoint -Name "Get Trip Stops" -Method GET -Endpoint "/api/trips/$global:testTripId/stops" -Headers $global:authHeaders -ExpectedStatus 200
        }
    }
}

# ===========================
# 5. DASHBOARD ENDPOINTS
# ===========================
Write-Host "`n=== 5. DASHBOARD ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 14: Dashboard summary
    Test-Endpoint -Name "Dashboard Summary" -Method GET -Endpoint "/api/dashboard/summary" -Headers $global:authHeaders -ExpectedStatus 200
    
    # Test 15: Dashboard vehicles
    Test-Endpoint -Name "Dashboard Vehicles" -Method GET -Endpoint "/api/dashboard/vehicles" -Headers $global:authHeaders -ExpectedStatus 200
    
    # Test 16: Dashboard drivers
    Test-Endpoint -Name "Dashboard Drivers" -Method GET -Endpoint "/api/dashboard/drivers" -Headers $global:authHeaders -ExpectedStatus 200
    
    # Test 17: Live vehicles
    Test-Endpoint -Name "Live Vehicles" -Method GET -Endpoint "/api/dashboard/live-vehicles" -Headers $global:authHeaders -ExpectedStatus 200
}

# ===========================
# 6. ASSOCIATION ENDPOINTS
# ===========================
Write-Host "`n=== 6. ASSOCIATION ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 18: List associations
    Test-Endpoint -Name "List Associations" -Method GET -Endpoint "/api/associations" -Headers $global:authHeaders -ExpectedStatus 200
    
    # Test 19: Vehicles for trip
    Test-Endpoint -Name "Vehicles for Trip" -Method GET -Endpoint "/api/associations/vehicles-for-trip" -Headers $global:authHeaders -ExpectedStatus 200
}

# ===========================
# 7. NOTIFICATION ENDPOINTS
# ===========================
Write-Host "`n=== 7. NOTIFICATION ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 20: List notifications
    Test-Endpoint -Name "List Notifications" -Method GET -Endpoint "/api/notifications" -Headers $global:authHeaders -ExpectedStatus 200
}

# ===========================
# 8. SYSTEM OVERVIEW (SUPERADMIN)
# ===========================
Write-Host "`n=== 8. SYSTEM OVERVIEW ENDPOINTS ===" -ForegroundColor Cyan

if ($global:authHeaders) {
    # Test 21: System summary
    Test-Endpoint -Name "System Overview Summary" -Method GET -Endpoint "/api/superadmin/system-overview/summary" -Headers $global:authHeaders -ExpectedStatus 200
    
    # Test 22: System organizations
    Test-Endpoint -Name "System Organizations" -Method GET -Endpoint "/api/superadmin/system-overview/organizations" -Headers $global:authHeaders -ExpectedStatus 200
}

# ===========================
# SUMMARY
# ===========================
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTestsCount" -ForegroundColor Red
Write-Host "Success Rate: $([math]::Round(($passedTests/$totalTests)*100, 2))%" -ForegroundColor Yellow

if ($failedTestsCount -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor Red
    foreach ($fail in $failedTests) {
        Write-Host "  - $fail" -ForegroundColor Red
    }
}

# Export results to JSON
$resultsFile = "D:\OptiFleet-Mobile\api_test_results.json"
$testResults | ConvertTo-Json -Depth 3 | Out-File $resultsFile
Write-Host "`nDetailed results exported to: $resultsFile" -ForegroundColor Cyan

Write-Host "`n==========================================`n" -ForegroundColor Cyan
