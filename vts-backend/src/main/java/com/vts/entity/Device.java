package com.vts.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "devices")
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", unique = true, nullable = false, length = 50)
    private String deviceId;

    @Column(name = "device_type", nullable = false, length = 20)
    private String deviceType = "MOBILE";

    @Column(name = "mobile_number", nullable = false, length = 10)
    private String mobileNumber;

    @Column(name = "imei_number", unique = true, nullable = false, length = 20)
    private String imeiNumber;

    @Column(name = "device_model", nullable = false, length = 50)
    private String deviceModel;

    @Column(name = "status")
    private Boolean status = true;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "org_id")
    private Long orgId;

    @Column(name = "km_travelled")
    private Double kmTravelled = 0.0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId()                        { return id; }
    public void setId(Long id)                 { this.id = id; }
    public String getDeviceId()                { return deviceId; }
    public void setDeviceId(String deviceId)   { this.deviceId = deviceId; }
    public String getDeviceType()              { return deviceType; }
    public void setDeviceType(String deviceType){ this.deviceType = deviceType; }
    public String getMobileNumber()            { return mobileNumber; }
    public void setMobileNumber(String v)      { this.mobileNumber = v; }
    public String getImeiNumber()              { return imeiNumber; }
    public void setImeiNumber(String v)        { this.imeiNumber = v; }
    public String getDeviceModel()             { return deviceModel; }
    public void setDeviceModel(String v)       { this.deviceModel = v; }
    public Boolean getStatus()                 { return status; }
    public void setStatus(Boolean status)      { this.status = status; }
    public String getCreatedBy()               { return createdBy; }
    public void setCreatedBy(String createdBy)  { this.createdBy = createdBy; }
    public Long getClientId()                  { return clientId; }
    public void setClientId(Long clientId)     { this.clientId = clientId; }
    public Long getOrgId()                     { return orgId; }
    public void setOrgId(Long orgId)           { this.orgId = orgId; }
    public LocalDateTime getCreatedAt()        { return createdAt; }
    public void setCreatedAt(LocalDateTime v)  { this.createdAt = v; }
    public Double getKmTravelled() { return kmTravelled; }
    public void setKmTravelled(Double kmTravelled) { this.kmTravelled = kmTravelled; }
}
