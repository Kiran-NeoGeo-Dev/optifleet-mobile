export interface Vehicle {
  id: number;
  licensePlate: string;
  dateOfRegistration?: string;
  manufactureDate?: string;
  registrationValidity?: string;
  chassisNumber?: string;
  engineNumber?: string;
  ownerName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  dateOfManufacturing?: string;
  fuelType?: string;
  insuranceNumber?: string;
  insuranceDate?: string;
  lastPucDate?: string;
  pucDueOn?: string;
  vehiclePhoto?: string;
  clientId?: number;
  status: string;
}
