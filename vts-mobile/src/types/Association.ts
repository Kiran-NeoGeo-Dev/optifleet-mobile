export interface BaseAssociation {
  id: number;
  vehicle_id: number;
  device_id: number;
  registration_no: string;
  device_code: string;
  created_at: string;
}

export interface ClientAssociation extends BaseAssociation {
  driver_id: number;
  driver_name: string;
  license_no: string;
  country: string;
  status: boolean;
}

export interface AdminAssociation extends BaseAssociation {
  vehicle_make: string;
  vehicle_model: string;
  device_model: string;
  device_type: string;
  mobile_number: string;
}

export type AssociationRecord = ClientAssociation | AdminAssociation;
export type AdminAssociationRecord = AdminAssociation;

export interface VehicleOption {
  vehicle_id: number;
  registration_no: string;
  device_id?: number;
  device_code?: string;
}

export interface VehicleDropdown {
  id: number;
  registration_no: string;
  vehicle_make: string;
  vehicle_model: string;
}

export type VehicleListItem = VehicleOption | VehicleDropdown;

export interface DriverOption {
  driver_id: number;
  driver_name: string;
  license_no: string;
}

export interface DeviceDropdown {
  id: number;
  device_code: string;
  device_model: string;
  device_type: string;
  mobile_number: string;
}

export interface ClientAssociationPayload {
  vehicleId: number;
  deviceId: number;
  driverId: number;
  country: string;
  status: boolean;
}

export type AssociationPayload = ClientAssociationPayload;

export interface AdminAssociationFullPayload {
  vehicleId: number;
  deviceId: number;
  driverId: number;
  country: string;
  status: boolean;
}

export interface AdminAssociationPayload {
  vehicle_id: number;
  device_id: number;
}

