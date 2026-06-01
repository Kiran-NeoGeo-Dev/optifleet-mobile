package com.vts.dto;

public class LoginResponse {

    private String token;
    private Long   clientId;
    private String username;
    private String role;

    public LoginResponse() {}

    public LoginResponse(String token, Long clientId, String username, String role) {
        this.token    = token;
        this.clientId = clientId;
        this.username = username;
        this.role     = role;
    }

    public String getToken()            { return token; }
    public void   setToken(String v)    { this.token = v; }
    public Long   getClientId()         { return clientId; }
    public void   setClientId(Long v)   { this.clientId = v; }
    public String getUsername()         { return username; }
    public void   setUsername(String v) { this.username = v; }
    public String getRole()             { return role; }
    public void   setRole(String v)     { this.role = v; }
}
