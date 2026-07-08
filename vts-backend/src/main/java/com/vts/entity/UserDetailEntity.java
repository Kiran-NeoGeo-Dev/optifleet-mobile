package com.vts.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "userdetail", schema = "public")
public class UserDetailEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "client_id")
    private Integer clientId;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @Column(name = "email_address", length = 150, unique = true)
    private String emailAddress;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "role", length = 50)
    private String role;

    @Column(name = "role_description", columnDefinition = "text")
    private String roleDescription;

    @Column(name = "dial_code", length = 10)
    private String dialCode;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "created_by_admin_id")
    private Integer createdByAdminId;

    @Column(name = "org_id")
    private Long orgId;

    public Integer getClientId()                          { return clientId; }
    public void setClientId(Integer clientId)             { this.clientId = clientId; }

    public String getUsername()                           { return username; }
    public void setUsername(String username)              { this.username = username; }

    public String getFullName()                           { return fullName; }
    public void setFullName(String fullName)              { this.fullName = fullName; }

    public String getEmailAddress()                       { return emailAddress; }
    public void setEmailAddress(String emailAddress)      { this.emailAddress = emailAddress; }

    public String getPhoneNumber()                        { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber)        { this.phoneNumber = phoneNumber; }

    public String getRole()                               { return role; }
    public void setRole(String role)                      { this.role = role; }

    public String getRoleDescription()                    { return roleDescription; }
    public void setRoleDescription(String roleDescription){ this.roleDescription = roleDescription; }

    public String getDialCode()                           { return dialCode; }
    public void setDialCode(String dialCode)              { this.dialCode = dialCode; }

    public Instant getCreatedAt()                         { return createdAt; }
    public void setCreatedAt(Instant createdAt)           { this.createdAt = createdAt; }

    public Integer getCreatedByAdminId()                          { return createdByAdminId; }
    public void setCreatedByAdminId(Integer createdByAdminId)     { this.createdByAdminId = createdByAdminId; }
    public Long getOrgId()                               { return orgId; }
    public void setOrgId(Long orgId)                     { this.orgId = orgId; }
}
