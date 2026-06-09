package com.vts.model;

public class VehiclePopupData {
    private String vehicleId;
    private String status;
    private String driverName;
    private String speed;
    private String location;
    private String overspeed;
    private String smoking;
    private String mobileUsage;
    private String drowsiness;
    private String routeDeviation;
    private Double lat;
    private Double lng;
    private Long   clientId;
    private Long   timestamp;
    private String address;
    private String coordinates;
    private String lastUpdateTime;
    private String lastUpdateDate;

    public String getVehicleId()      { return vehicleId; }
    public void   setVehicleId(String v)    { this.vehicleId = v; }
    public String getStatus()         { return status; }
    public void   setStatus(String v)       { this.status = v; }
    public String getDriverName()     { return driverName; }
    public void   setDriverName(String v)   { this.driverName = v; }
    public String getSpeed()          { return speed; }
    public void   setSpeed(String v)        { this.speed = v; }
    public String getLocation()       { return location; }
    public void   setLocation(String v)     { this.location = v; }
    public String getOverspeed()      { return overspeed; }
    public void   setOverspeed(String v)    { this.overspeed = v; }
    public String getSmoking()        { return smoking; }
    public void   setSmoking(String v)      { this.smoking = v; }
    public String getMobileUsage()    { return mobileUsage; }
    public void   setMobileUsage(String v)  { this.mobileUsage = v; }
    public String getDrowsiness()     { return drowsiness; }
    public void   setDrowsiness(String v)   { this.drowsiness = v; }
    public String getRouteDeviation() { return routeDeviation; }
    public void   setRouteDeviation(String v){ this.routeDeviation = v; }
    public Double getLat()            { return lat; }
    public void   setLat(Double v)          { this.lat = v; }
    public Double getLng()            { return lng; }
    public void   setLng(Double v)          { this.lng = v; }
    public Long   getClientId()       { return clientId; }
    public void   setClientId(Long v)       { this.clientId = v; }
    public Long   getTimestamp()      { return timestamp; }
    public void   setTimestamp(Long v)      { this.timestamp = v; }
    public String getAddress()        { return address; }
    public void   setAddress(String v)      { this.address = v; }
    public String getCoordinates()    { return coordinates; }
    public void   setCoordinates(String v)  { this.coordinates = v; }
    public String getLastUpdateTime() { return lastUpdateTime; }
    public void   setLastUpdateTime(String v){ this.lastUpdateTime = v; }
    public String getLastUpdateDate() { return lastUpdateDate; }
    public void   setLastUpdateDate(String v){ this.lastUpdateDate = v; }
}
