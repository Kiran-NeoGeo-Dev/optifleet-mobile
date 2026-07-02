package com.vts.dto;

import java.time.Instant;

public class SystemOverviewOrganizationResponse {

    private long orgId;
    private String ownerName;
    private String username;
    private Instant createdDate;
    private long users;
    private long devices;
    private long vehicles;
    private long drivers;

    public SystemOverviewOrganizationResponse() {}

    public long getOrgId() { return orgId; }
    public void setOrgId(long orgId) { this.orgId = orgId; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Instant getCreatedDate() { return createdDate; }
    public void setCreatedDate(Instant createdDate) { this.createdDate = createdDate; }
    public long getUsers() { return users; }
    public void setUsers(long users) { this.users = users; }
    public long getDevices() { return devices; }
    public void setDevices(long devices) { this.devices = devices; }
    public long getVehicles() { return vehicles; }
    public void setVehicles(long vehicles) { this.vehicles = vehicles; }
    public long getDrivers() { return drivers; }
    public void setDrivers(long drivers) { this.drivers = drivers; }
}
