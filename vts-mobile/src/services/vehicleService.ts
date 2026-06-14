import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import { Vehicle } from "../types/Vehicle";

export interface VehiclePayload {
  licensePlate: string;
  manufactureDate: string;
  registrationValidity?: string;
  chassisNumber?: string;
  engineNumber?: string;
  ownerName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  dateOfManufacturing?: string;
  fuelType?: string;
  insuranceNumber?: string;
  vehicleInsuranceDate?: string;
  lastPucDate?: string;
  pucDueOn?: string;
  vehiclePhoto?: string | null;
  status?: string;
  clientId?: number;
}

export const createVehicle = async (payload: VehiclePayload) => {
  const res = await api.post<Vehicle>(ENDPOINTS.VEHICLES, payload);
  return res.data;
};

export const updateVehicle = async (id: number, payload: VehiclePayload) => {
  const res = await api.put<Vehicle>(`${ENDPOINTS.VEHICLES}/${id}`, payload);
  return res.data;
};

export const fetchVehicles = async () => {
  const res = await api.get<Vehicle[]>(ENDPOINTS.VEHICLES);
  return res.data;
};

export const fetchVehicle = async (id: number) => {
  const res = await api.get<Vehicle>(`${ENDPOINTS.VEHICLES}/${id}`);
  return res.data;
};

export const deleteVehicle = async (id: number) => {
  const res = await api.delete(`${ENDPOINTS.VEHICLES}/${id}`);
  return res.data;
};
