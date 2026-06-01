package com.vts.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "login", schema = "public")
public class LoginEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password", nullable = false, columnDefinition = "text")
    private String password;

    @Column(name = "role", length = 20)
    private String role;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "client_id")
    private Integer clientId;

    @Column(name = "reset_token", length = 255)
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private Instant resetTokenExpiry;

    public Integer getId()                        { return id; }
    public void setId(Integer id)                 { this.id = id; }

    public String getUsername()                   { return username; }
    public void setUsername(String username)      { this.username = username; }

    public String getPassword()                   { return password; }
    public void setPassword(String password)      { this.password = password; }

    public String getRole()                       { return role; }
    public void setRole(String role)              { this.role = role; }

    public Instant getCreatedAt()                 { return createdAt; }
    public void setCreatedAt(Instant createdAt)   { this.createdAt = createdAt; }

    public Integer getClientId()                  { return clientId; }
    public void setClientId(Integer clientId)     { this.clientId = clientId; }

    public String getResetToken()                 { return resetToken; }
    public void setResetToken(String resetToken)  { this.resetToken = resetToken; }

    public Instant getResetTokenExpiry()                      { return resetTokenExpiry; }
    public void setResetTokenExpiry(Instant resetTokenExpiry) { this.resetTokenExpiry = resetTokenExpiry; }
}
