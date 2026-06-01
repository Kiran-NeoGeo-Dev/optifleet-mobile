package com.vts.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "driver_photos")
public class DriverPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "photo_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "driver_id", nullable = false)
    private Driver driver;

    @Column(name = "front_face_image", columnDefinition = "text")
    private String frontFaceImage;

    @Column(name = "left_face_image", columnDefinition = "text")
    private String leftFaceImage;

    @Column(name = "right_face_image", columnDefinition = "text")
    private String rightFaceImage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Driver getDriver() {
        return driver;
    }

    public void setDriver(Driver driver) {
        this.driver = driver;
    }

    public String getFrontFaceImage() {
        return frontFaceImage;
    }

    public void setFrontFaceImage(String frontFaceImage) {
        this.frontFaceImage = frontFaceImage;
    }

    public String getLeftFaceImage() {
        return leftFaceImage;
    }

    public void setLeftFaceImage(String leftFaceImage) {
        this.leftFaceImage = leftFaceImage;
    }

    public String getRightFaceImage() {
        return rightFaceImage;
    }

    public void setRightFaceImage(String rightFaceImage) {
        this.rightFaceImage = rightFaceImage;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}