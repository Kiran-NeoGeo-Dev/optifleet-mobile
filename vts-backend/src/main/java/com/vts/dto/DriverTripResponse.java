package com.vts.dto;

public class DriverTripResponse {
    private Integer id;
    private String  tripId;
    private String  vehicleId;
    private String  driverName;
    private String  startPlace;
    private String  endPlace;
    private Double  startLat;
    private Double  startLng;
    private Double  endLat;
    private Double  endLng;
    private String  distanceKm;
    private String  duration;
    private String  status;
    private String  customPolyline;

    public DriverTripResponse() {}

    public DriverTripResponse(com.vts.entity.Trip t) {
        this.id             = t.getId();
        this.tripId         = t.getTripId();
        this.vehicleId      = t.getVehicleId();
        this.driverName     = t.getDriverName();
        this.startPlace     = t.getStartPlace();
        this.endPlace       = t.getEndPlace();
        this.startLat       = t.getStartLat();
        this.startLng       = t.getStartLng();
        this.endLat         = t.getEndLat();
        this.endLng         = t.getEndLng();
        this.distanceKm     = t.getDistanceKm() != null ? t.getDistanceKm().toString() : null;
        this.duration       = t.getDuration();
        this.status         = t.getStatus();
        this.customPolyline = t.getCustomPolyline();
    }

    public Integer getId()             { return id; }
    public String  getTripId()         { return tripId; }
    public String  getVehicleId()      { return vehicleId; }
    public String  getDriverName()     { return driverName; }
    public String  getStartPlace()     { return startPlace; }
    public String  getEndPlace()       { return endPlace; }
    public Double  getStartLat()       { return startLat; }
    public Double  getStartLng()       { return startLng; }
    public Double  getEndLat()         { return endLat; }
    public Double  getEndLng()         { return endLng; }
    public String  getDistanceKm()     { return distanceKm; }
    public String  getDuration()       { return duration; }
    public String  getStatus()         { return status; }
    public String  getCustomPolyline() { return customPolyline; }
}
