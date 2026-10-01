import { api } from "./api";

export interface Device {
  id: number;
  deviceId: string;
  deviceType: string;
  mobileNumber: string;
  imeiNumber: string;
  deviceModel: string;
  status: boolean;
  clientId?: number;
  createdAt?: string;
  kmTravelled?: number;
  batteryPercentage?: number | null;
  batteryStatus?: string | null;
}

export interface DevicePayload {
  deviceId: string;
  deviceType: string;
  mobileNumber: string;
  imeiNumber: string;
  deviceModel: string;
  status: boolean;
  clientId?: number;
}

export const fetchDevices     = async () => (await api.get<Device[]>("/api/devices")).data;
export const createDevice     = async (payload: DevicePayload) => (await api.post("/api/devices", payload)).data;
export const updateDevice     = async (id: number, payload: DevicePayload) => (await api.put(`/api/devices/${id}`, payload)).data;
export const deleteDevice     = async (id: number) => (await api.delete(`/api/devices/${id}`)).data;
export const fetchDeviceCount = async () => (await api.get<{ totalDevices: number }>("/api/devices/count")).data;
export const fetchDeviceBattery = async (id: number) => (await api.get<{ batteryPercentage: number | null; batteryStatus: string | null }>(`/api/devices/${id}/battery`)).data;
