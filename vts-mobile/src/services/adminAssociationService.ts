import { api } from "./api";
import type {
  AdminAssociationPayload,
  AdminAssociationFullPayload,
  AdminAssociationRecord,
  ClientAssociation,
  DeviceDropdown,
  DriverOption,
  VehicleDropdown,
  VehicleOption,
} from "../types/Association";

export const fetchAdminAssociations = async (): Promise<AdminAssociationRecord[]> =>
  (await api.get("/api/admin-associations")).data;

export const fetchVehiclesDropdown = async (): Promise<VehicleDropdown[]> =>
  (await api.get("/api/admin-associations/vehicles")).data;

export const fetchAvailableDevices = async (): Promise<DeviceDropdown[]> =>
  (await api.get("/api/admin-associations/available-devices")).data;

export const fetchVehiclesWithAdminDevice = async (): Promise<VehicleOption[]> =>
  (await api.get("/api/admin-associations/vehicles-with-device")).data;

export const fetchAllDrivers = async (): Promise<DriverOption[]> =>
  (await api.get("/api/admin-associations/all-drivers")).data;

export const createAdminAssociation = async (payload: AdminAssociationPayload): Promise<any> =>
  (await api.post("/api/admin-associations", payload)).data;

export const updateAdminAssociation = async (id: number, payload: AdminAssociationPayload): Promise<any> =>
  (await api.put(`/api/admin-associations/${id}`, payload)).data;

export const deleteAdminAssociation = async (id: number): Promise<void> =>
  await api.delete(`/api/admin-associations/${id}`);

// — Full (Vehicle-Device-Driver) associations for admin —
export const fetchAdminFullAssociations = async (): Promise<ClientAssociation[]> =>
  (await api.get("/api/admin-associations/full")).data;

export const createAdminFullAssociation = async (payload: AdminAssociationFullPayload): Promise<any> =>
  (await api.post("/api/admin-associations/full", payload)).data;

export const updateAdminFullAssociation = async (id: number, payload: AdminAssociationFullPayload): Promise<any> =>
  (await api.put(`/api/admin-associations/full/${id}`, payload)).data;

export const deleteAdminFullAssociation = async (id: number): Promise<void> =>
  await api.delete(`/api/admin-associations/full/${id}`);

