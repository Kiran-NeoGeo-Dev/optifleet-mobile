package com.vts.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "vehicles")
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "registration_no", nullable = false, length = 12, unique = true)
    private String licensePlate;

    @Column(name = "date_of_registration", nullable = false)
    private LocalDate dateOfRegistration;

    @Column(name = "registration_validity", nullable = false)
    private LocalDate registrationValidity;

    @Column(name = "chassis_number", nullable = false, length = 20, unique = true)
    private String chassisNumber;

    @Column(name = "engine_number", nullable = false, length = 20, unique = true)
    private String engineNumber;

    @Column(name = "owner_name", nullable = false, length = 50)
    private String ownerName;

    @Column(name = "vehicle_make", nullable = false, length = 30)
    private String vehicleMake;

    @Column(name = "vehicle_model", nullable = false, length = 30)
    private String vehicleModel;

    @Column(name = "manufacturing_date", nullable = false)
    private LocalDate dateOfManufacturing;

    @Column(name = "fuel_type", nullable = false, length = 10)
    private String fuelType;

    @Column(name = "insurance_number", nullable = false, length = 25, unique = true)
    private String insuranceNumber;

    @Column(name = "insurance_date", nullable = false)
    private LocalDate insuranceDate;

    @Column(name = "last_puc_date")
    private LocalDate lastPucDate;

    @Column(name = "puc_due_on")
    private LocalDate pucDueOn;

    @Column(name = "photo", columnDefinition = "text")
    private String vehiclePhoto;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "device_id")
    private Integer deviceId;

    @Column(name = "client_id")
    private Long clientId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getLicensePlate() { return licensePlate; }
    public void setLicensePlate(String licensePlate) { this.licensePlate = licensePlate; }
    public LocalDate getDateOfRegistration() { return dateOfRegistration; }
    public void setDateOfRegistration(LocalDate dateOfRegistration) { this.dateOfRegistration = dateOfRegistration; }
    public LocalDate getRegistrationValidity() { return registrationValidity; }
    public void setRegistrationValidity(LocalDate registrationValidity) { this.registrationValidity = registrationValidity; }
    public String getChassisNumber() { return chassisNumber; }
    public void setChassisNumber(String chassisNumber) { this.chassisNumber = chassisNumber; }
    public String getEngineNumber() { return engineNumber; }
    public void setEngineNumber(String engineNumber) { this.engineNumber = engineNumber; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getVehicleMake() { return vehicleMake; }
    public void setVehicleMake(String vehicleMake) { this.vehicleMake = vehicleMake; }
    public String getVehicleModel() { return vehicleModel; }
    public void setVehicleModel(String vehicleModel) { this.vehicleModel = vehicleModel; }
    public LocalDate getDateOfManufacturing() { return dateOfManufacturing; }
    public void setDateOfManufacturing(LocalDate dateOfManufacturing) { this.dateOfManufacturing = dateOfManufacturing; }
    public String getFuelType() { return fuelType; }
    public void setFuelType(String fuelType) { this.fuelType = fuelType; }
    public String getInsuranceNumber() { return insuranceNumber; }
    public void setInsuranceNumber(String insuranceNumber) { this.insuranceNumber = insuranceNumber; }
    public LocalDate getInsuranceDate() { return insuranceDate; }
    public void setInsuranceDate(LocalDate insuranceDate) { this.insuranceDate = insuranceDate; }
    public LocalDate getLastPucDate() { return lastPucDate; }
    public void setLastPucDate(LocalDate lastPucDate) { this.lastPucDate = lastPucDate; }
    public LocalDate getPucDueOn() { return pucDueOn; }
    public void setPucDueOn(LocalDate pucDueOn) { this.pucDueOn = pucDueOn; }
    public String getVehiclePhoto() { return vehiclePhoto; }
    public void setVehiclePhoto(String vehiclePhoto) { this.vehiclePhoto = vehiclePhoto; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public Integer getDeviceId() { return deviceId; }
    public void setDeviceId(Integer deviceId) { this.deviceId = deviceId; }
    public Long getClientId() { return clientId; }
    public void setClientId(Long clientId) { this.clientId = clientId; }
}
