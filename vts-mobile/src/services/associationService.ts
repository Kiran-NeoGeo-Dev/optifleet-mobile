import { api } from "./api";
import type {
  AssociationPayload,
  AssociationRecord,
  ClientAssociationPayload,
  DriverOption,
  VehicleOption,
} from "../types/Association";

export const fetchAssociations      = async (): Promise<AssociationRecord[]> =>
  (await api.get("/api/associations")).data;

export const fetchVehiclesWithDevice = async (): Promise<VehicleOption[]> =>
  (await api.get("/api/associations/vehicles-with-device")).data;

export const fetchDriversByDevice   = async (deviceId: number): Promise<DriverOption[]> =>
  (await api.get(`/api/associations/drivers-by-device`, { params: { deviceId } })).data;

export const fetchAvailableDrivers  = async (excludeAssocId?: number): Promise<DriverOption[]> =>
  (await api.get("/api/associations/available-drivers", { params: excludeAssocId != null ? { excludeAssocId } : undefined })).data;

export const createAssociation      = async (payload: AssociationPayload): Promise<AssociationRecord> =>
  (await api.post("/api/associations", payload)).data;

export const updateAssociation      = async (id: number, payload: AssociationPayload): Promise<AssociationRecord> =>
  (await api.put(`/api/associations/${id}`, payload)).data;

export const deleteAssociation      = async (id: number): Promise<void> =>
  (await api.delete(`/api/associations/${id}`)).data;
