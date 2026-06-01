package com.vts.dto;

public class DashboardResponse {

    private long totalDrivers;
    private long activeDrivers;
    private long totalVehicles;
    private long activeVehicles;
    private long idleVehicles;
    private long activeAlerts;
    private long totalAssociations;
    private long totalDevices;
    private long totalTrips;
    private long totalUsers;

    public DashboardResponse() {}

    public DashboardResponse(long totalDrivers, long activeDrivers, long totalVehicles,
                              long activeVehicles, long idleVehicles, long activeAlerts,
                              long totalAssociations, long totalDevices, long totalTrips, long totalUsers) {
        this.totalDrivers      = totalDrivers;
        this.activeDrivers     = activeDrivers;
        this.totalVehicles     = totalVehicles;
        this.activeVehicles    = activeVehicles;
        this.idleVehicles      = idleVehicles;
        this.activeAlerts      = activeAlerts;
        this.totalAssociations = totalAssociations;
        this.totalDevices      = totalDevices;
        this.totalTrips        = totalTrips;
        this.totalUsers        = totalUsers;
    }

    public long getTotalDrivers()           { return totalDrivers; }
    public void setTotalDrivers(long v)     { this.totalDrivers = v; }
    public long getActiveDrivers()          { return activeDrivers; }
    public void setActiveDrivers(long v)    { this.activeDrivers = v; }
    public long getTotalVehicles()          { return totalVehicles; }
    public void setTotalVehicles(long v)    { this.totalVehicles = v; }
    public long getActiveVehicles()         { return activeVehicles; }
    public void setActiveVehicles(long v)   { this.activeVehicles = v; }
    public long getIdleVehicles()           { return idleVehicles; }
    public void setIdleVehicles(long v)     { this.idleVehicles = v; }
    public long getActiveAlerts()           { return activeAlerts; }
    public void setActiveAlerts(long v)     { this.activeAlerts = v; }
    public long getTotalAssociations()      { return totalAssociations; }
    public void setTotalAssociations(long v){ this.totalAssociations = v; }
    public long getTotalDevices()           { return totalDevices; }
    public void setTotalDevices(long v)     { this.totalDevices = v; }
    public long getTotalTrips()             { return totalTrips; }
    public void setTotalTrips(long v)       { this.totalTrips = v; }
    public long getTotalUsers()             { return totalUsers; }
    public void setTotalUsers(long v)       { this.totalUsers = v; }
}
