package com.vts.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "device_drivers")
public class DeviceDriver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "device_id", nullable = false)
    private Integer deviceId;

    @Column(name = "driver_id", nullable = false)
    private Integer driverId;

    public Integer getId()                  { return id; }
    public void    setId(Integer id)        { this.id = id; }
    public Integer getDeviceId()            { return deviceId; }
    public void    setDeviceId(Integer v)   { this.deviceId = v; }
    public Integer getDriverId()            { return driverId; }
    public void    setDriverId(Integer v)   { this.driverId = v; }
}
