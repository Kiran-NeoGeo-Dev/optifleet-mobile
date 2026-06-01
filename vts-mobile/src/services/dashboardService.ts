import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import { DashboardSummary, LiveVehicle } from "../types/Dashboard";
import { Driver } from "../types/Driver";
import { Vehicle } from "../types/Vehicle";

export const fetchDashboardSummary = async () => {
  const res = await api.get<DashboardSummary>(ENDPOINTS.DASHBOARD_SUMMARY);
  return res.data;
};

export const fetchDashboardDrivers = async () => {
  const res = await api.get<Driver[]>(ENDPOINTS.DASHBOARD_DRIVERS);
  return res.data;
};

export const fetchDashboardVehicles = async () => {
  const res = await api.get<Vehicle[]>(ENDPOINTS.DASHBOARD_VEHICLES);
  return res.data;
};

export const fetchLiveVehicles = async (): Promise<LiveVehicle[]> => {
  const res = await api.get<LiveVehicle[]>((ENDPOINTS as any).LIVE_VEHICLES);
  return res.data;
};
