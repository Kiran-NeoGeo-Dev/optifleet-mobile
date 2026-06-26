package com.vts.dto;

public class LoginResponse {

    private String token;
    private Long   clientId;
    private String username;
    private String role;
    private Long   orgId;

    public LoginResponse() {}

    public LoginResponse(String token, Long clientId, String username, String role) {
        this(token, clientId, username, role, null);
    }

    public LoginResponse(String token, Long clientId, String username, String role, Long orgId) {
        this.token    = token;
        this.clientId = clientId;
        this.username = username;
        this.role     = role;
        this.orgId    = orgId;
    }

    public String getToken()            { return token; }
    public void   setToken(String v)    { this.token = v; }
    public Long   getClientId()         { return clientId; }
    public void   setClientId(Long v)   { this.clientId = v; }
    public String getUsername()         { return username; }
    public void   setUsername(String v) { this.username = v; }
    public String getRole()             { return role; }
    public void   setRole(String v)     { this.role = v; }
    public Long   getOrgId()            { return orgId; }
    public void   setOrgId(Long v)      { this.orgId = v; }
}
