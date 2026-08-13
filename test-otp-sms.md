# Test OTP SMS Configuration

## ✅ Template Configuration Verified

Your 2Factor template is **APPROVED** and ready:
- **Template Name**: `otp`
- **Sender ID**: NeoGeo  
- **Message**: `XXXX is your OTP to verify your OptiFleet login at NeoGeoInfo Technologies Limited. Please do not share OTP with anyone.`
- **Status**: APPROVED ✅

## ✅ Backend Configuration Verified

Both files are correctly configured:

### application.properties
```properties
twofactor.api.key=d76b1852-8f13-11f1-908b-0200cd936042
twofactor.sms.template=otp
server.port=8085
```

### apiConfig.ts
```typescript
export const API_BASE_URL = "http://192.168.1.205:8085";
```

## 🧪 Testing Steps

### Step 1: Restart Backend

Open a **new Command Prompt** and run:

```cmd
cd d:\OptiFleet-Mobile\vts-backend
taskkill /F /IM java.exe
mvn spring-boot:run
```

### Step 2: Wait for Backend to Start

Watch the console output. You should see:

```
Started VtsBackendApplication in X.XXX seconds (JVM running for Y.YYY)
Tomcat initialized with port 8085
```

**Important**: Wait until you see "Started VtsBackendApplication" before testing!

### Step 3: Test OTP Send

Open mobile app and:

1. Switch to **Driver** tab
2. Enter mobile number: **6301417583**
3. Click **Send OTP**

### Step 4: Check Backend Logs

You should see detailed logs like:

```
[DriverAuth] ===== SEND OTP REQUEST RECEIVED =====
[DriverAuth] Request body: {mobileNumber=6301417583}
[DriverAuth] Mobile number from request: 6301417583
[DriverAuth] Clean mobile number: 6301417583
[DriverAuth] Looking up driver by username: 6301417583
[DriverAuth] Driver found - ID: 47, Name: Mobile Driver, Status: true
[DriverAuth] Calling OtpService to send OTP to: 6301417583
[OTP] Generating OTP for mobile: ******7583
[2Factor] Sending SMS OTP to ******7583 using template: otp
[2Factor] API URL: https://2factor.in/API/V1/****/SMS/******7583/****/otp
[2Factor] Response status: 200, body: {"Status":"Success","Details":"OTP sent successfully"}
[2Factor] ✓ SMS OTP sent successfully to ******7583
[OTP] ✓ OTP sent successfully to ******7583
[DriverAuth] OTP sent successfully to mobile=6301417583 driverId=47
```

### Step 5: Check Your Phone

You should receive an **SMS** (NOT a voice call) with:

```
XXXXXX is your OTP to verify your OptiFleet login at NeoGeoInfo Technologies Limited. Please do not share OTP with anyone.
```

Where `XXXXXX` is the 6-digit OTP.

### Step 6: Verify OTP

1. Enter the OTP received via SMS
2. Click **Verify OTP**
3. You should be logged in successfully

## 🔍 Troubleshooting

### Issue: Still Getting Voice Call

**Check Backend Logs for:**
```
[2Factor] Invalid template 'otp'. Please create this template in 2Factor dashboard.
```

**Solution**: 
- Double-check template name in 2Factor dashboard is exactly `otp` (case-sensitive)
- Restart backend after confirming

### Issue: No SMS or Voice Call Received

**Check Backend Logs for:**
```
[2Factor] HTTP error. Status: 400, Body: {"Status":"Error","Details":"Insufficient balance"}
```

**Solution**: 
- Check 2Factor account balance
- Top up if needed

### Issue: Frontend Shows "Failed to send OTP"

**Possible Causes:**
1. Backend is not running
2. Frontend is using wrong port
3. Backend endpoint is blocked by security

**Solution:**
1. Confirm backend is running: Open http://192.168.1.205:8085/api/auth/forgot-password-message in browser
2. Should return: `{"message":"Admin password recovery..."}`
3. If it doesn't load, backend is not running or port is wrong

### Issue: "Invalid Template" Error in Logs

**Cause**: Template name mismatch

**Solution:**
1. Go to 2Factor dashboard
2. Check exact template name (must be `otp`)
3. If different, update `twofactor.sms.template` in application.properties
4. Restart backend

## 📱 Expected SMS Format

Your phone should receive:

```
From: NeoGeo

123456 is your OTP to verify your OptiFleet login at NeoGeoInfo Technologies Limited. Please do not share OTP with anyone.
```

**Note**: The `XXXX` placeholder in the template is automatically replaced with the actual OTP.

## ✨ Success Indicators

### SMS Received Successfully ✅
- You get an SMS (not voice call)
- SMS contains 6-digit OTP
- SMS is from sender "NeoGeo"
- OTP verification works

### Backend Logs Show Success ✅
```
[2Factor] ✓ SMS OTP sent successfully to ******7583
[DriverAuth] OTP sent successfully to mobile=6301417583 driverId=47
```

### Frontend Shows Success ✅
- Toast message: "OTP sent successfully to your mobile number."
- OTP input field appears
- 60-second countdown timer starts

## 🎯 What Changed

### Before (Voice Call):
```
https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}
                                                      ↑
                                              No template = Voice Call
```

### After (SMS):
```
https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}/otp
                                                        ↑
                                                Template name = SMS
```

## 📞 Support

If issues persist:

1. **Check 2Factor Dashboard Logs**
   - Login to https://2factor.in
   - Check SMS logs to see if request was received
   - Check delivery status

2. **Check Backend Logs**
   - Look for `[2Factor]` and `[OTP]` log entries
   - Share any error messages

3. **Verify Configuration**
   - Template name: `otp`
   - API key: `d76b1852-8f13-11f1-908b-0200cd936042`
   - Port: `8085`

---

**Ready to Test!** 🚀

The configuration is complete. Just restart the backend and test the OTP flow. You should now receive SMS instead of voice calls!
