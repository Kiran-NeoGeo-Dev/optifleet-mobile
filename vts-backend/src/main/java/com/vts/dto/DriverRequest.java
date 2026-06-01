package com.vts.dto;

import com.vts.validation.Base64SizeValidator;
import jakarta.validation.constraints.*;

public class DriverRequest {

    private Long id;

    @NotBlank(message = "Driver name is required")
    @Pattern(regexp = "^[a-zA-Z\\s]{3,50}$", message = "Driver name must be 3–50 alphabets and spaces")
    private String driverName;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Phone must be 10 digits starting with 6–9")
    private String phoneNumber;

    @NotBlank(message = "Driving license number is required")
    @Pattern(regexp = "^[A-Z0-9\\s]{10,18}$", message = "License must be 10–18 alphanumeric characters",
             flags = Pattern.Flag.CASE_INSENSITIVE)
    private String licenseNumber;

    @NotBlank(message = "License expiry date is required")
    private String licenseExpiry; // ISO date string yyyy-MM-dd

    @NotBlank(message = "Aadhaar number is required")
    @Pattern(regexp = "^\\d{12}$", message = "Aadhaar must be exactly 12 digits")
    private String aadharNumber;

    private String status; // "ACTIVE" / "INACTIVE"

    // Not @NotBlank on update — comments are optional when editing
    @Size(max = 250, message = "Comments must be max 250 characters")
    private String comments;

    @Base64SizeValidator(maxSizeInBytes = 5 * 1024 * 1024)
    private String frontFaceImage;

    @Base64SizeValidator(maxSizeInBytes = 5 * 1024 * 1024)
    private String leftFaceImage;

    @Base64SizeValidator(maxSizeInBytes = 5 * 1024 * 1024)
    private String rightFaceImage;

    private String username;
    private String password;
    private Long clientId;

    public Long getId()                          { return id; }
    public void setId(Long id)                   { this.id = id; }
    public String getDriverName()                { return driverName; }
    public void setDriverName(String v)          { this.driverName = v; }
    public String getPhoneNumber()               { return phoneNumber; }
    public void setPhoneNumber(String v)         { this.phoneNumber = v; }
    public String getLicenseNumber()             { return licenseNumber; }
    public void setLicenseNumber(String v)       { this.licenseNumber = v; }
    public String getLicenseExpiry()             { return licenseExpiry; }
    public void setLicenseExpiry(String v)       { this.licenseExpiry = v; }
    public String getAadharNumber()              { return aadharNumber; }
    public void setAadharNumber(String v)        { this.aadharNumber = v; }
    public String getStatus()                    { return status; }
    public void setStatus(String v)              { this.status = v; }
    public String getComments()                  { return comments; }
    public void setComments(String v)            { this.comments = v; }
    public String getFrontFaceImage()            { return frontFaceImage; }
    public void setFrontFaceImage(String v)      { this.frontFaceImage = v; }
    public String getLeftFaceImage()             { return leftFaceImage; }
    public void setLeftFaceImage(String v)       { this.leftFaceImage = v; }
    public String getRightFaceImage()            { return rightFaceImage; }
    public void setRightFaceImage(String v)      { this.rightFaceImage = v; }
    public String getUsername()                  { return username; }
    public void setUsername(String v)            { this.username = v; }
    public String getPassword()                  { return password; }
    public void setPassword(String v)            { this.password = v; }
    public Long getClientId()                    { return clientId; }
    public void setClientId(Long v)              { this.clientId = v; }
}
