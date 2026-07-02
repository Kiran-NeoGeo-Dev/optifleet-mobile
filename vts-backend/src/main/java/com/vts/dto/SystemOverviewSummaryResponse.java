package com.vts.dto;

public class SystemOverviewSummaryResponse {

    private long organizations;
    private long totalUsers;
    private long totalDevices;
    private long totalVehicles;
    private long totalDrivers;

    public SystemOverviewSummaryResponse() {}

    public SystemOverviewSummaryResponse(long organizations, long totalUsers, long totalDevices,
                                         long totalVehicles, long totalDrivers) {
        this.organizations = organizations;
        this.totalUsers = totalUsers;
        this.totalDevices = totalDevices;
        this.totalVehicles = totalVehicles;
        this.totalDrivers = totalDrivers;
    }

    public long getOrganizations() { return organizations; }
    public void setOrganizations(long organizations) { this.organizations = organizations; }
    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }
    public long getTotalDevices() { return totalDevices; }
    public void setTotalDevices(long totalDevices) { this.totalDevices = totalDevices; }
    public long getTotalVehicles() { return totalVehicles; }
    public void setTotalVehicles(long totalVehicles) { this.totalVehicles = totalVehicles; }
    public long getTotalDrivers() { return totalDrivers; }
    public void setTotalDrivers(long totalDrivers) { this.totalDrivers = totalDrivers; }
}
