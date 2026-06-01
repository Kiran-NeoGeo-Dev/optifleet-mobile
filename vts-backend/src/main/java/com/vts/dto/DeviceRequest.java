package com.vts.dto;

public class DeviceRequest {
    private String deviceId;
    private String deviceType;
    private String mobileNumber;
    private String imeiNumber;
    private String deviceModel;
    private Boolean status;
    private Long clientId;

    public String getDeviceId()                { return deviceId; }
    public void setDeviceId(String v)          { this.deviceId = v; }
    public String getDeviceType()              { return deviceType; }
    public void setDeviceType(String v)        { this.deviceType = v; }
    public String getMobileNumber()            { return mobileNumber; }
    public void setMobileNumber(String v)      { this.mobileNumber = v; }
    public String getImeiNumber()              { return imeiNumber; }
    public void setImeiNumber(String v)        { this.imeiNumber = v; }
    public String getDeviceModel()             { return deviceModel; }
    public void setDeviceModel(String v)       { this.deviceModel = v; }
    public Boolean getStatus()                 { return status; }
    public void setStatus(Boolean v)           { this.status = v; }
    public Long getClientId()                  { return clientId; }
    public void setClientId(Long v)            { this.clientId = v; }
}
