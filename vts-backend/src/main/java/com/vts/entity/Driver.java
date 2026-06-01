package com.vts.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "drivers")
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "driver_name", nullable = false, length = 50)
    private String driverName;

    @Column(name = "license_no", nullable = false, length = 20, unique = true)
    private String licenseNumber;

    @Column(name = "license_expiry", nullable = false)
    private LocalDate licenseExpiry;

    @Column(name = "phone_number", length = 15)
    private String phoneNumber;

    @Column(name = "aadhaar_number", length = 12, unique = true)
    private String aadharNumber;

    @Column(name = "status")
    private Boolean status = true;

    @Column(name = "photo_front", columnDefinition = "text")
    private String frontFaceImage;

    @Column(name = "photo_left", columnDefinition = "text")
    private String leftFaceImage;

    @Column(name = "photo_right", columnDefinition = "text")
    private String rightFaceImage;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "username", length = 50, unique = true)
    private String username;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "comments", columnDefinition = "text")
    private String comments;

    @Column(name = "otp", length = 6)
    private String otp;

    @Column(name = "otp_expiry")
    private LocalDateTime otpExpiry;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public String getLicenseNumber() { return licenseNumber; }
    public void setLicenseNumber(String licenseNumber) { this.licenseNumber = licenseNumber; }
    public LocalDate getLicenseExpiry() { return licenseExpiry; }
    public void setLicenseExpiry(LocalDate licenseExpiry) { this.licenseExpiry = licenseExpiry; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getAadharNumber() { return aadharNumber; }
    public void setAadharNumber(String aadharNumber) { this.aadharNumber = aadharNumber; }
    public Boolean getStatus() { return status; }
    public void setStatus(Boolean status) { this.status = status; }
    public String getFrontFaceImage() { return frontFaceImage; }
    public void setFrontFaceImage(String frontFaceImage) { this.frontFaceImage = frontFaceImage; }
    public String getLeftFaceImage() { return leftFaceImage; }
    public void setLeftFaceImage(String leftFaceImage) { this.leftFaceImage = leftFaceImage; }
    public String getRightFaceImage() { return rightFaceImage; }
    public void setRightFaceImage(String rightFaceImage) { this.rightFaceImage = rightFaceImage; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getClientId() { return clientId; }
    public void setClientId(Long clientId) { this.clientId = clientId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }
    public LocalDateTime getOtpExpiry() { return otpExpiry; }
    public void setOtpExpiry(LocalDateTime otpExpiry) { this.otpExpiry = otpExpiry; }
}
