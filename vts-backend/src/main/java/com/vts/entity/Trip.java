package com.vts.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "trip_id", nullable = false, length = 50)
    private String tripId;

    @Column(name = "trip_name", nullable = false, length = 255)
    private String tripName;

    @Column(name = "vehicle_id", length = 50)
    private String vehicleId;          // registration_no string

    @Column(name = "driver_name", length = 100)
    private String driverName;

    @Column(name = "start_place", columnDefinition = "text")
    private String startPlace;

    @Column(name = "end_place", columnDefinition = "text")
    private String endPlace;

    @Column(name = "start_lat")
    private Double startLat;

    @Column(name = "start_lng")
    private Double startLng;

    @Column(name = "end_lat")
    private Double endLat;

    @Column(name = "end_lng")
    private Double endLng;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "duration", length = 20)
    private String duration;           // e.g. "2.5 hrs"

    @Column(name = "custom_polyline", columnDefinition = "text")
    private String customPolyline;

    @Column(name = "driver_id")
    private Integer driverId;

    @Column(name = "status", length = 20)
    private String status = "Not Started";

    @Column(name = "planned_end_time")
    private OffsetDateTime plannedEndTime;

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Integer getId()                        { return id; }
    public void setId(Integer id)                 { this.id = id; }
    public String getTripId()                     { return tripId; }
    public void setTripId(String v)               { this.tripId = v; }
    public String getTripName()                   { return tripName; }
    public void setTripName(String v)             { this.tripName = v; }
    public String getVehicleId()                  { return vehicleId; }
    public void setVehicleId(String v)            { this.vehicleId = v; }
    public String getDriverName()                 { return driverName; }
    public void setDriverName(String v)           { this.driverName = v; }
    public String getStartPlace()                 { return startPlace; }
    public void setStartPlace(String v)           { this.startPlace = v; }
    public String getEndPlace()                   { return endPlace; }
    public void setEndPlace(String v)             { this.endPlace = v; }
    public Double getStartLat()                   { return startLat; }
    public void setStartLat(Double v)             { this.startLat = v; }
    public Double getStartLng()                   { return startLng; }
    public void setStartLng(Double v)             { this.startLng = v; }
    public Double getEndLat()                     { return endLat; }
    public void setEndLat(Double v)               { this.endLat = v; }
    public Double getEndLng()                     { return endLng; }
    public void setEndLng(Double v)               { this.endLng = v; }
    public Double getDistanceKm()                 { return distanceKm; }
    public void setDistanceKm(Double v)           { this.distanceKm = v; }
    public String getDuration()                   { return duration; }
    public void setDuration(String v)             { this.duration = v; }
    public String getCustomPolyline()        { return customPolyline; }
    public void setCustomPolyline(String v)   { this.customPolyline = v; }
    public Integer getDriverId()              { return driverId; }
    public void setDriverId(Integer v)            { this.driverId = v; }
    public String getStatus()                     { return status; }
    public void setStatus(String v)               { this.status = v; }
    public OffsetDateTime getPlannedEndTime()      { return plannedEndTime; }
    public void setPlannedEndTime(OffsetDateTime v){ this.plannedEndTime = v; }
    public Long getClientId()                     { return clientId; }
    public void setClientId(Long v)               { this.clientId = v; }
    public String getCreatedBy()                  { return createdBy; }
    public void setCreatedBy(String v)            { this.createdBy = v; }
    public OffsetDateTime getCreatedAt()          { return createdAt; }
    public void setCreatedAt(OffsetDateTime v)    { this.createdAt = v; }
    public OffsetDateTime getUpdatedAt()          { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime v)    { this.updatedAt = v; }
}
