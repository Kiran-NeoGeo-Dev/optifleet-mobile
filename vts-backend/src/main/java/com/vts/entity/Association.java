package com.vts.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "associations")
public class Association {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "vehicle_id", nullable = false)
    private Integer vehicleId;

    @Column(name = "device_id", nullable = false)
    private Integer deviceId;

    @Column(name = "driver_id", nullable = false)
    private Integer driverId;

    @Column(name = "country", length = 50)
    private String country = "India";

    @Column(name = "status")
    private Boolean status = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Optional: store client_id for isolation
    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "km_travelled")
    private Double kmTravelled = 0.0;

    public Integer getId()                   { return id; }
    public void    setId(Integer id)         { this.id = id; }
    public Integer getVehicleId()            { return vehicleId; }
    public void    setVehicleId(Integer v)   { this.vehicleId = v; }
    public Integer getDeviceId()             { return deviceId; }
    public void    setDeviceId(Integer v)    { this.deviceId = v; }
    public Integer getDriverId()             { return driverId; }
    public void    setDriverId(Integer v)    { this.driverId = v; }
    public String  getCountry()              { return country; }
    public void    setCountry(String v)      { this.country = v; }
    public Boolean getStatus()               { return status; }
    public void    setStatus(Boolean v)      { this.status = v; }
    public LocalDateTime getCreatedAt()      { return createdAt; }
    public void    setCreatedAt(LocalDateTime v) { this.createdAt = v; }
    public Long    getClientId()             { return clientId; }
    public void    setClientId(Long v)       { this.clientId = v; }
    public Double getKmTravelled() { return kmTravelled; }
    public void setKmTravelled(Double kmTravelled) { this.kmTravelled = kmTravelled; }
}
