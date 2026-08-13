# 2Factor SMS OTP Setup Guide

## Issue
The current implementation was sending OTP via **voice call** instead of **SMS**. This is because 2Factor API requires a **template name** parameter to send SMS. Without it, the API defaults to voice call.

## Solution
Updated the OTP service to use the correct 2Factor SMS API endpoint with template parameter:

```
https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}/{template_name}
```

## Configuration

### Current Settings (application.properties)
```properties
twofactor.api.key=d76b1852-8f13-11f1-908b-0200cd936042
twofactor.sms.template=otp
```

## Steps to Enable SMS OTP

### Option 1: Create SMS Template in 2Factor Dashboard (Recommended)

1. **Login to 2Factor Dashboard**
   - Go to: https://2factor.in/login
   - Login with your account credentials

2. **Navigate to Templates**
   - Click on "Templates" or "SMS Templates" in the dashboard
   - Click "Add New Template" or "Create Template"

3. **Create OTP Template**
   - **Template Name**: `otp` (must match `twofactor.sms.template` in application.properties)
   - **Template Type**: OTP / Transactional
   - **Message Content**: 
     ```
     Your OptiFleet verification code is ##OTP##. Valid for 5 minutes. Do not share this code.
     ```
   - **Note**: The placeholder `##OTP##` will be automatically replaced with the actual OTP
   - **Sender ID**: Use your approved Sender ID (e.g., "OPTFLT" or "OPTIFL")

4. **Submit for Approval**
   - Submit the template for DLT approval (if required for your country)
   - Wait for approval (usually takes a few hours)

5. **Test the Template**
   - Once approved, restart your backend
   - Test the OTP login flow
   - You should now receive SMS instead of voice call

### Option 2: Try Different Template Names

If you already have templates in your 2Factor account, try using their names:

1. **Check existing templates** in 2Factor dashboard
2. **Update application.properties** with the actual template name:
   ```properties
   twofactor.sms.template=your_template_name_here
   ```
3. **Restart the backend**

Common template names to try:
- `otp`
- `default`
- `verification`
- `twofactor`

### Option 3: Use AUTOGEN (Alternative Approach)

If you don't want to create templates, you can use 2Factor's AUTOGEN feature:

1. **Modify OtpService.java** to use AUTOGEN endpoint:
   ```java
   String url = String.format(
       "https://2factor.in/API/V1/%s/SMS/%s/AUTOGEN",
       twoFactorApiKey,
       mobileNumber
   );
   ```

2. **Note**: With AUTOGEN:
   - 2Factor generates the OTP (you don't control it)
   - You need to extract OTP from the API response
   - Store the session_id for verification
   - Use 2Factor's VERIFY endpoint to verify OTP

## Testing

### 1. Check Backend Logs
After making changes, restart backend and check logs:

```
[2Factor] Sending SMS OTP to ******7583 using template: otp
[2Factor] Response status: 200, body: {"Status":"Success","Details":"OTP sent successfully"}
```

### 2. If Template is Invalid
You'll see:
```
[2Factor] Invalid template 'otp'. Please create this template in 2Factor dashboard.
```

**Action**: Create the template as described in Option 1 above.

### 3. Test OTP Flow
1. Open mobile app
2. Switch to Driver tab
3. Enter mobile: 6301417583
4. Click "Send OTP"
5. You should receive **SMS** (not voice call)
6. Enter OTP and verify

## Android SMS Auto-Fill

For Android SMS auto-detection and auto-fill, the SMS format is important:

### Recommended SMS Format for Auto-Fill
```
<#> Your OptiFleet verification code is: 123456. Valid for 5 minutes. Do not share.
{Your_App_Hash}
```

**Note**: 
- The `<#>` at the start enables SMS Retriever API
- `{Your_App_Hash}` is your app's unique hash (11 characters)
- To get your app hash, add SMS Retriever API to your React Native app

### Without App Hash
Even without the app hash, most Android devices will show OTP suggestions in the keyboard if the SMS contains a 6-digit number.

## Troubleshooting

### Issue 1: Still Receiving Voice Call
**Cause**: Template doesn't exist or template name is incorrect

**Solution**:
1. Login to 2Factor dashboard
2. Check template name matches exactly (case-sensitive)
3. Ensure template is approved
4. Restart backend after any changes

### Issue 2: Template Not Found Error
**Cause**: Template name in application.properties doesn't match dashboard

**Solution**:
1. Go to 2Factor dashboard → Templates
2. Copy the exact template name
3. Update `twofactor.sms.template` in application.properties
4. Restart backend

### Issue 3: Invalid API Key
**Cause**: API key is incorrect or expired

**Solution**:
1. Check API key in 2Factor dashboard
2. Update `twofactor.api.key` in application.properties
3. Restart backend

### Issue 4: No SMS Received
**Possible Causes**:
1. Phone number format is incorrect
2. 2Factor account balance is low
3. SMS is blocked by carrier
4. Template not approved

**Solution**:
1. Check 2Factor dashboard logs to see if SMS was sent
2. Check account balance
3. Verify template is approved
4. Try with a different phone number

## API Documentation

### 2Factor SMS OTP API

**Endpoint (Custom OTP)**:
```
GET https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}/{template_name}
```

**Endpoint (AUTOGEN)**:
```
GET https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/AUTOGEN/{template_name}
```

**Response (Success)**:
```json
{
  "Status": "Success",
  "Details": "OTP sent successfully",
  "OTP": "123456"
}
```

**Response (Error)**:
```json
{
  "Status": "Error",
  "Details": "Invalid Template"
}
```

## Summary of Changes

### Files Modified:

1. **OtpService.java**
   - Added `twoFactorSmsTemplate` configuration
   - Updated API URL to include template parameter
   - Enhanced error logging for template issues

2. **application.properties**
   - Added `twofactor.sms.template=otp` configuration
   - Added documentation comments

3. **DriverAuthController.java**
   - Added detailed logging for debugging

4. **SecurityConfig.java**
   - Added `/api/driver-auth/send-otp` to permitAll
   - Added `/api/driver-auth/verify-otp` to permitAll

## Next Steps

1. **Create SMS template** in 2Factor dashboard (see Option 1 above)
2. **Restart backend** after template is approved
3. **Test OTP flow** in mobile app
4. **Monitor backend logs** for any errors
5. **Implement Android SMS auto-fill** (optional, for better UX)

## Support

If you continue to have issues:
1. Check 2Factor dashboard logs
2. Check backend logs for detailed error messages
3. Verify API key and template name
4. Contact 2Factor support if needed

---

**Last Updated**: 2026-08-04
**Configuration**: Using template-based SMS OTP (not voice)
