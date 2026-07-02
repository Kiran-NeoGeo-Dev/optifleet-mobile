package com.vts.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "userdetail", schema = "public")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "client_id")
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Transient
    private String password;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @Column(name = "email_address", length = 150)
    private String emailAddress;

    @Column(name = "dial_code", length = 10)
    private String dialCode;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(length = 50)
    private String role;

    @Column(name = "role_description", columnDefinition = "text")
    private String roleDescription;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "org_id")
    private Long orgId;

    public Long getId()                              { return id; }
    public void setId(Long id)                       { this.id = id; }
    public String getUsername()                      { return username; }
    public void setUsername(String username)         { this.username = username; }
    public String getPassword()                      { return password; }
    public void setPassword(String password)         { this.password = password; }
    public String getFullName()                      { return fullName; }
    public void setFullName(String fullName)         { this.fullName = fullName; }
    public String getEmailAddress()                  { return emailAddress; }
    public void setEmailAddress(String v)            { this.emailAddress = v; }
    public String getDialCode()                      { return dialCode; }
    public void setDialCode(String dialCode)         { this.dialCode = dialCode; }
    public String getPhoneNumber()                   { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber)   { this.phoneNumber = phoneNumber; }
    public String getRole()                          { return role; }
    public void setRole(String role)                 { this.role = role; }
    public String getRoleDescription()               { return roleDescription; }
    public void setRoleDescription(String v)         { this.roleDescription = v; }
    public Instant getCreatedAt()                    { return createdAt; }
    public void setCreatedAt(Instant createdAt)      { this.createdAt = createdAt; }
    public Long getOrgId()                           { return orgId; }
    public void setOrgId(Long orgId)                 { this.orgId = orgId; }
}
