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
  safetyScore:  number;
  clientId:     number;
}

export interface EventCounts {
  smoking:     number;
  mobile:      number;
  overspeed:   number;
  drowsiness:  number;
  seatbelt:    number;
  distraction: number;
  kmDriven:    number;
}

export interface DriverScorecard {
  driverId:     number;
  driverName:   string;
  phoneNumber:  string | null;
  photoFront:   string | null;
  vehicleRegNo: string | null;
  vehicleModel: string | null;
  period:       string;
  safetyScore:  number;
  remark:       string;
  events:       EventCounts;
}

export const fetchFleetDrivers = async (): Promise<FleetDriver[]> => {
  const res = await api.get<FleetDriver[]>("/api/fleet/drivers");
  return res.data;
};

export const fetchDriverScorecard = async (id: number, year: number, month: number): Promise<DriverScorecard> => {
  const res = await api.get<DriverScorecard>(`/api/fleet/drivers/${id}/scorecard?year=${year}&month=${month}`);
  return res.data;
};
