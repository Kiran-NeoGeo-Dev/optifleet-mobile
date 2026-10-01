import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";

export interface FleetVehicle {
  id:           number;
  licensePlate: string;
  vehicleMake:  string;
  vehicleModel: string;
  driverName:   string;
  tripStatus:   string;
  vehiclePhoto: string | null;
  clientId:     number;
}

export interface VehicleTelemetry {
  vehicleId:      number;
  licensePlate:   string;
  vehicleModel:   string;
  speed:          number;
  engineRpm:      number;
  ignitionStatus: string;
  tripStatus:     string;
  signalHealth:   string;
  lastUpdateTime: string;
  lastUpdateDate: string;
  batteryPercentage?: number | null;
  batteryStatus?: string | null;
  hasVehicleDeviceLink?: boolean;
}

export const fetchFleetVehicles = async (): Promise<FleetVehicle[]> => {
  const res = await api.get<FleetVehicle[]>((ENDPOINTS as any).FLEET_VEHICLES);
  return res.data;
};

export const fetchVehicleTelemetry = async (id: number): Promise<VehicleTelemetry> => {
  const res = await api.get<VehicleTelemetry>(`${(ENDPOINTS as any).FLEET_VEHICLES}/${id}/telemetry`);
  return res.data;
};

// ── Fleet Drivers ─────────────────────────────────────────────────────────────

export interface FleetDriver {
  id:           number;
  driverName:   string;
  phoneNumber:  string | null;
  photoFront:   string | null;
  vehicleRegNo: string | null;
  vehicleModel: string | null;
  tripStatus:   string;
  active:       boolean;
  safetyScore:  number | null;
  clientId:     number;
}

export interface EventCounts {
  smoking:            number;
  mobile:             number;
  overspeed:          number;
  drowsiness:         number;
  seatbelt:           number;
  distraction:        number;
  harshBraking:       number;
  harshAcceleration:  number;
  rashTurning:        number;
  yawnAlert:          number;
  kmDriven:           number;
}

export interface DriverScorecard {
  driverId:     number;
  driverName:   string;
  phoneNumber:  string | null;
  photoFront:   string | null;
  vehicleRegNo: string | null;
  vehicleModel: string | null;
  period:       string;
  safetyScore:  number | null;
  remark:       string | null;
  events:       EventCounts;
}

export const fetchFleetDrivers = async (): Promise<FleetDriver[]> => {
  const res = await api.get<FleetDriver[]>("/api/fleet/drivers");
  return res.data;
};

export const fetchDriverScorecard = async (id: number, year: number, month: number): Promise<DriverScorecard> => {
  console.log(`[fetchDriverScorecard] Fetching for driver ID: ${id}, year: ${year}, month: ${month}`);
  const url = `/api/fleet/drivers/${id}/scorecard?year=${year}&month=${month}`;
  console.log('[fetchDriverScorecard] URL:', url);
  
  const res = await api.get<DriverScorecard>(url);
  
  console.log('[fetchDriverScorecard] Raw response:', res);
  console.log('[fetchDriverScorecard] Response data:', JSON.stringify(res.data, null, 2));
  console.log('[fetchDriverScorecard] events:', res.data.events);
  console.log('[fetchDriverScorecard] kmDriven:', res.data.events?.kmDriven);
  console.log('[fetchDriverScorecard] kmDriven type:', typeof res.data.events?.kmDriven);
  
  return res.data;
};
