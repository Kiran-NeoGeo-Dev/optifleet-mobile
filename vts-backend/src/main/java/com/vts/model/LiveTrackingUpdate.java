package com.vts.model;

import java.util.List;

public class LiveTrackingUpdate {
    private String           vehicleId;
    private double           lat;
    private double           lng;
    private double           speed;
    private String           tripStatus;
    private List<RoutePoint> remainingRoute;
    private double           remainingDistanceKm;
    private double           etaMinutes;
    private double           progressPercentage;
    private VehiclePopupData popupData;
    private boolean          isDeviating;
    private double           deviationDistance;
    private long             timestamp;

    public String           getVehicleId()          { return vehicleId; }
    public void             setVehicleId(String v)  { this.vehicleId = v; }
    public double           getLat()                { return lat; }
    public void             setLat(double v)        { this.lat = v; }
    public double           getLng()                { return lng; }
    public void             setLng(double v)        { this.lng = v; }
    public double           getSpeed()              { return speed; }
    public void             setSpeed(double v)      { this.speed = v; }
    public String           getTripStatus()         { return tripStatus; }
    public void             setTripStatus(String v) { this.tripStatus = v; }
    public List<RoutePoint> getRemainingRoute()     { return remainingRoute; }
    public void             setRemainingRoute(List<RoutePoint> v) { this.remainingRoute = v; }
    public double           getRemainingDistanceKm(){ return remainingDistanceKm; }
    public void             setRemainingDistanceKm(double v){ this.remainingDistanceKm = v; }
    public double           getEtaMinutes()         { return etaMinutes; }
    public void             setEtaMinutes(double v) { this.etaMinutes = v; }
    public double           getProgressPercentage() { return progressPercentage; }
    public void             setProgressPercentage(double v){ this.progressPercentage = v; }
    public VehiclePopupData getPopupData()          { return popupData; }
    public void             setPopupData(VehiclePopupData v){ this.popupData = v; }
    public boolean          isDeviating()           { return isDeviating; }
    public void             setDeviating(boolean v) { this.isDeviating = v; }
    public double           getDeviationDistance()  { return deviationDistance; }
    public void             setDeviationDistance(double v){ this.deviationDistance = v; }
    public long             getTimestamp()          { return timestamp; }
    public void             setTimestamp(long v)    { this.timestamp = v; }
}
