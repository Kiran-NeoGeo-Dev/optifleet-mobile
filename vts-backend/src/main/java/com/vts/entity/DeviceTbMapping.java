package com.vts.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "device_tb_mapping", schema = "public")
public class DeviceTbMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "imei_number", nullable = false, unique = true, length = 20)
    private String imeiNumber;

    @Column(name = "device_id", nullable = false, unique = true, length = 50)
    private String deviceId;

    @Column(name = "associated_user_id")
    private Integer associatedUserId;

    @Column(name = "admin_id", nullable = false)
    private Integer adminId;

    @Column(name = "thingsboard_device_id", nullable = false, unique = true)
    private String thingsboardDeviceId;

    @Column(name = "tb_access_token", nullable = false)
    private String tbAccessToken;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId()                                  { return id; }
    public void setId(Long id)                           { this.id = id; }
    public String getImeiNumber()                        { return imeiNumber; }
    public void setImeiNumber(String imeiNumber)         { this.imeiNumber = imeiNumber; }
    public String getDeviceId()                          { return deviceId; }
    public void setDeviceId(String deviceId)             { this.deviceId = deviceId; }
    public Integer getAssociatedUserId()                 { return associatedUserId; }
    public void setAssociatedUserId(Integer v)           { this.associatedUserId = v; }
    public Integer getAdminId()                          { return adminId; }
    public void setAdminId(Integer adminId)              { this.adminId = adminId; }
    public String getThingsboardDeviceId()               { return thingsboardDeviceId; }
    public void setThingsboardDeviceId(String v)         { this.thingsboardDeviceId = v; }
    public String getTbAccessToken()                     { return tbAccessToken; }
    public void setTbAccessToken(String tbAccessToken)   { this.tbAccessToken = tbAccessToken; }
    public LocalDateTime getCreatedAt()                  { return createdAt; }
    public void setCreatedAt(LocalDateTime v)            { this.createdAt = v; }
    public LocalDateTime getUpdatedAt()                  { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v)            { this.updatedAt = v; }
}
