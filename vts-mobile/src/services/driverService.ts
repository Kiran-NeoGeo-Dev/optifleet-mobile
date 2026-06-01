import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import { Driver } from "../types/Driver";
import { DriverPhoto } from "../types/DriverPhoto";

export interface DriverPayload {
  driverName: string;
  phoneNumber?: string;
  comments?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  aadharNumber?: string;
  frontFaceImage?: string | null;
  leftFaceImage?: string | null;
  rightFaceImage?: string | null;
  status?: string;
  username?: string;
  password?: string;
  clientId?: number;
}

export const createDriver = async (payload: DriverPayload) => {
  const res = await api.post<Driver>(ENDPOINTS.DRIVERS, payload);
  return res.data;
};

export const updateDriver = async (id: number, payload: DriverPayload) => {
  const res = await api.put<Driver>(`${ENDPOINTS.DRIVERS}/${id}`, payload);
  return res.data;
};

export const fetchDrivers = async () => {
  const res = await api.get<Driver[]>(ENDPOINTS.DRIVERS);
  return res.data;
};

export const fetchDriver = async (id: number) => {
  const res = await api.get<Driver>(`${ENDPOINTS.DRIVERS}/${id}`);
  return res.data;
};

export const fetchDriverPhotos = async (driverId: number) => {
  const res = await api.get<DriverPhoto>(`${ENDPOINTS.DRIVER_PHOTOS}/${driverId}`);
  return res.data;
};

export const fetchMyDriverProfile = async () => {
  const res = await api.get<Driver>(ENDPOINTS.DRIVER_ME);
  return res.data;
};
