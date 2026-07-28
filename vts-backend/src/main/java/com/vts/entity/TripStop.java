package com.vts.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "trip_stops")
public class TripStop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    @Column(name = "stop_order", nullable = false)
    private Integer stopOrder;

    @Column(name = "stop_name", nullable = false)
    private String stopName;

    @Column(name = "lat", nullable = false, precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(name = "lng", nullable = false, precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "estimated_arrival")
    private OffsetDateTime estimatedArrival;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public Integer getId()                          { return id; }
    public String getTripId()                       { return tripId; }
    public void setTripId(String v)                 { this.tripId = v; }
    public Integer getStopOrder()                   { return stopOrder; }
    public void setStopOrder(Integer v)             { this.stopOrder = v; }
    public String getStopName()                     { return stopName; }
    public void setStopName(String v)               { this.stopName = v; }
    public BigDecimal getLat()                      { return lat; }
    public void setLat(BigDecimal v)                { this.lat = v; }
    public BigDecimal getLng()                      { return lng; }
    public void setLng(BigDecimal v)                { this.lng = v; }
    public OffsetDateTime getEstimatedArrival()     { return estimatedArrival; }
    public void setEstimatedArrival(OffsetDateTime v){ this.estimatedArrival = v; }
    public OffsetDateTime getCreatedAt()            { return createdAt; }
    public void setCreatedAt(OffsetDateTime v)      { this.createdAt = v; }
}
