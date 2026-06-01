import { api } from "./api";
import type {
  AdminAssociationPayload,
  AdminAssociationRecord,
  DeviceDropdown,
  VehicleDropdown,
} from "../types/Association";

export const fetchAdminAssociations = async (): Promise<AdminAssociationRecord[]> =>
  (await api.get("/api/admin-associations")).data;

export const fetchVehiclesDropdown = async (): Promise<VehicleDropdown[]> =>
  (await api.get("/api/admin-associations/vehicles")).data;

export const fetchAvailableDevices = async (): Promise<DeviceDropdown[]> =>
  (await api.get("/api/admin-associations/available-devices")).data;

export const createAdminAssociation = async (payload: AdminAssociationPayload): Promise<any> =>
  (await api.post("/api/admin-associations", payload)).data;

export const updateAdminAssociation = async (id: number, payload: AdminAssociationPayload): Promise<any> =>
  (await api.put(`/api/admin-associations/${id}`, payload)).data;

export const deleteAdminAssociation = async (id: number): Promise<void> =>
  await api.delete(`/api/admin-associations/${id}`);
