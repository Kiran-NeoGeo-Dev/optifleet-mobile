package com.vts.dto;

import jakarta.validation.constraints.*;

public class VehicleRequest {

    private Long id;

    @NotBlank(message = "Vehicle registration number is required")
    @Pattern(regexp = "^[A-Z0-9]{8,12}$", message = "Registration must be 8–12 alphanumeric characters",
             flags = Pattern.Flag.CASE_INSENSITIVE)
    private String licensePlate;

    @NotBlank(message = "Date of registration is required")
    private String manufactureDate;        // → date_of_registration

    @NotBlank(message = "Registration validity is required")
    private String registrationValidity;

    @NotBlank(message = "Chassis number is required")
    @Size(min = 5, max = 25, message = "Chassis number must be 5–25 characters")
    private String chassisNumber;

    @NotBlank(message = "Engine number is required")
    @Size(min = 4, max = 25, message = "Engine number must be 4–25 characters")
    private String engineNumber;

    @NotBlank(message = "Owner name is required")
    @Pattern(regexp = "^[a-zA-Z\\s]{3,50}$", message = "Owner name must be 3–50 alphabets and spaces")
    private String ownerName;

    @NotBlank(message = "Vehicle make is required")
    @Size(min = 2, max = 30, message = "Vehicle make must be 2–30 characters")
    private String vehicleMake;

    @NotBlank(message = "Vehicle model is required")
    @Size(min = 2, max = 30, message = "Vehicle model must be 2–30 characters")
    private String vehicleModel;

    @NotBlank(message = "Date of manufacturing is required")
    private String dateOfManufacturing;

    @NotBlank(message = "Fuel type is required")
    @Pattern(regexp = "^(Petrol|Diesel|CNG|Electric)$", message = "Fuel type must be Petrol, Diesel, CNG, or Electric")
    private String fuelType;

    @NotBlank(message = "Insurance number is required")
    @Pattern(regexp = "^[A-Z0-9]{8,25}$", message = "Insurance number must be 8–25 alphanumeric characters",
             flags = Pattern.Flag.CASE_INSENSITIVE)
    private String insuranceNumber;

    @NotBlank(message = "Vehicle insurance date is required")
    private String vehicleInsuranceDate;

    @NotBlank(message = "Last PUC date is required")
    private String lastPucDate;

    @NotBlank(message = "PUC due date is required")
    private String pucDueOn;

    // vehiclePhoto optional on edit
    private String vehiclePhoto;           // base64
    private Long clientId;

    public Long getId()                              { return id; }
    public void setId(Long id)                       { this.id = id; }
    public String getLicensePlate()                  { return licensePlate; }
    public void setLicensePlate(String v)            { this.licensePlate = v; }
    public String getManufactureDate()               { return manufactureDate; }
    public void setManufactureDate(String v)         { this.manufactureDate = v; }
    public String getRegistrationValidity()          { return registrationValidity; }
    public void setRegistrationValidity(String v)    { this.registrationValidity = v; }
    public String getChassisNumber()                 { return chassisNumber; }
    public void setChassisNumber(String v)           { this.chassisNumber = v; }
    public String getEngineNumber()                  { return engineNumber; }
    public void setEngineNumber(String v)            { this.engineNumber = v; }
    public String getOwnerName()                     { return ownerName; }
    public void setOwnerName(String v)               { this.ownerName = v; }
    public String getVehicleMake()                   { return vehicleMake; }
    public void setVehicleMake(String v)             { this.vehicleMake = v; }
    public String getVehicleModel()                  { return vehicleModel; }
    public void setVehicleModel(String v)            { this.vehicleModel = v; }
    public String getDateOfManufacturing()           { return dateOfManufacturing; }
    public void setDateOfManufacturing(String v)     { this.dateOfManufacturing = v; }
    public String getFuelType()                      { return fuelType; }
    public void setFuelType(String v)                { this.fuelType = v; }
    public String getInsuranceNumber()               { return insuranceNumber; }
    public void setInsuranceNumber(String v)         { this.insuranceNumber = v; }
    public String getVehicleInsuranceDate()          { return vehicleInsuranceDate; }
    public void setVehicleInsuranceDate(String v)    { this.vehicleInsuranceDate = v; }
    public String getLastPucDate()                   { return lastPucDate; }
    public void setLastPucDate(String v)             { this.lastPucDate = v; }
    public String getPucDueOn()                      { return pucDueOn; }
    public void setPucDueOn(String v)                { this.pucDueOn = v; }
    public String getVehiclePhoto()                  { return vehiclePhoto; }
    public void setVehiclePhoto(String v)            { this.vehiclePhoto = v; }
    public Long getClientId()                        { return clientId; }
    public void setClientId(Long v)                  { this.clientId = v; }
}
