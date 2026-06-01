package com.vts.dto;

public class ClientDetailsResponse {
    private Long clientId;
    private String username;
    private String fullName;
    private String emailAddress;
    private String dialCode;
    private String phoneNumber;
    private String role;
    private String roleDescription;

    public ClientDetailsResponse() {
    }

    public ClientDetailsResponse(Long clientId, String username, String fullName, String emailAddress,
                                  String dialCode, String phoneNumber, String role, String roleDescription) {
        this.clientId = clientId;
        this.username = username;
        this.fullName = fullName;
        this.emailAddress = emailAddress;
        this.dialCode = dialCode;
        this.phoneNumber = phoneNumber;
        this.role = role;
        this.roleDescription = roleDescription;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmailAddress() {
        return emailAddress;
    }

    public void setEmailAddress(String emailAddress) {
        this.emailAddress = emailAddress;
    }

    public String getDialCode() {
        return dialCode;
    }

    public void setDialCode(String dialCode) {
        this.dialCode = dialCode;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getRoleDescription() {
        return roleDescription;
    }

    public void setRoleDescription(String roleDescription) {
        this.roleDescription = roleDescription;
    }
}
