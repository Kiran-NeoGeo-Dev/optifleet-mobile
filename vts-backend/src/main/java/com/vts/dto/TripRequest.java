package com.vts.dto;

public class TripRequest {
    private String tripId;        // auto-generated e.g. TRIP-20260422-210751
    private String tripName;      // same value as tripId by default
    private String vehicleId;     // registration_no (VARCHAR)
    private String driverName;
    private String startPlace;
    private String endPlace;
    private Double startLat;
    private Double startLng;
    private Double endLat;
    private Double endLng;
    private Double distanceKm;
    private String duration;      // e.g. "2.5 hrs"
    private String customPolyline;
    private Integer driverId;

    public String getTripId()                { return tripId; }
    public void   setTripId(String v)        { this.tripId = v; }
    public String getTripName()              { return tripName; }
    public void   setTripName(String v)      { this.tripName = v; }
    public String getVehicleId()             { return vehicleId; }
    public void   setVehicleId(String v)     { this.vehicleId = v; }
    public String getDriverName()            { return driverName; }
    public void   setDriverName(String v)    { this.driverName = v; }
    public String getStartPlace()            { return startPlace; }
    public void   setStartPlace(String v)    { this.startPlace = v; }
    public String getEndPlace()              { return endPlace; }
    public void   setEndPlace(String v)      { this.endPlace = v; }
    public Double getStartLat()              { return startLat; }
    public void   setStartLat(Double v)      { this.startLat = v; }
    public Double getStartLng()              { return startLng; }
    public void   setStartLng(Double v)      { this.startLng = v; }
    public Double getEndLat()                { return endLat; }
    public void   setEndLat(Double v)        { this.endLat = v; }
    public Double getEndLng()                { return endLng; }
    public void   setEndLng(Double v)        { this.endLng = v; }
    public Double getDistanceKm()            { return distanceKm; }
    public void   setDistanceKm(Double v)    { this.distanceKm = v; }
    public String getDuration()              { return duration; }
    public void   setDuration(String v)      { this.duration = v; }
    public String getCustomPolyline()        { return customPolyline; }
    public void   setCustomPolyline(String v){ this.customPolyline = v; }
    public Integer getDriverId()             { return driverId; }
    public void   setDriverId(Integer v)     { this.driverId = v; }
}
