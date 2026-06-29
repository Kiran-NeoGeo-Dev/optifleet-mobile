package com.vts.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public class TelemetryPayload {

    @JsonProperty("vehicle_id")
    private String vehicleId;

    @JsonProperty("driver_name")
    private String driverName;

    private Double lat;
    private Double lng;
    private Integer speed;

    @JsonProperty("trip_status")
    private String tripStatus;

    private String overspeed;

    @JsonProperty("smoking_status")
    private String smokingStatus;

    @JsonProperty("mobile_usage")
    private String mobileUsage;

    @JsonProperty("drowsiness_status")
    private String drowsinessStatus;

    @JsonProperty("harsh_braking")
    private String harshBraking;

    @JsonProperty("harsh_acceleration")
    private String harshAcceleration;

    @JsonProperty("rash_turning")
    private String rashTurning;

    @JsonProperty("engine_rpm")
    @JsonAlias({"engineRpm", "rpm"})
    private Integer engineRpm;

    @JsonProperty("battery_percentage")
    private Double batteryPercentage;

    public String  getVehicleId()        { return vehicleId; }
    public void    setVehicleId(String v){ this.vehicleId = v; }
    public String  getDriverName()       { return driverName; }
    public void    setDriverName(String v){ this.driverName = v; }
    public Double  getLat()              { return lat; }
    public void    setLat(Double v)      { this.lat = v; }
    public Double  getLng()              { return lng; }
    public void    setLng(Double v)      { this.lng = v; }
    public Integer getSpeed()            { return speed; }
    public void    setSpeed(Integer v)   { this.speed = v; }
    public String  getTripStatus()       { return tripStatus; }
    public void    setTripStatus(String v){ this.tripStatus = v; }
    public String  getOverspeed()        { return overspeed; }
    public void    setOverspeed(String v){ this.overspeed = v; }
    public String  getSmokingStatus()    { return smokingStatus; }
    public void    setSmokingStatus(String v){ this.smokingStatus = v; }
    public String  getMobileUsage()      { return mobileUsage; }
    public void    setMobileUsage(String v){ this.mobileUsage = v; }
    public String  getDrowsinessStatus() { return drowsinessStatus; }
    public void    setDrowsinessStatus(String v){ this.drowsinessStatus = v; }
    public String  getHarshBraking()     { return harshBraking; }
    public void    setHarshBraking(String v){ this.harshBraking = v; }
    public String  getHarshAcceleration(){ return harshAcceleration; }
    public void    setHarshAcceleration(String v){ this.harshAcceleration = v; }
    public String  getRashTurning()      { return rashTurning; }
    public void    setRashTurning(String v){ this.rashTurning = v; }
    public Integer getEngineRpm()        { return engineRpm; }
    public void    setEngineRpm(Integer v){ this.engineRpm = v; }
    public Double  getBatteryPercentage(){ return batteryPercentage; }
    public void    setBatteryPercentage(Double v){ this.batteryPercentage = v; }
}
