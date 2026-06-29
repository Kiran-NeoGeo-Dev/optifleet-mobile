import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import { DashboardSummary, LiveVehicle } from "../types/Dashboard";

export const fetchDashboardSummary = async () => {
  const res = await api.get<DashboardSummary>(ENDPOINTS.DASHBOARD_SUMMARY);
  return res.data;
};

export const fetchLiveVehicles = async (): Promise<LiveVehicle[]> => {
  const res = await api.get<LiveVehicle[]>((ENDPOINTS as any).LIVE_VEHICLES);
  return res.data;
};
