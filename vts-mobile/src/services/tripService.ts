import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";

export interface TripVehicleOption {
  vehicle_id:      number;
  registration_no: string;
  driver_id:       number;
  driver_name:     string;
}

export interface TripPayload {
  tripId:          string;
  tripName:        string;
  vehicleId:       string;
  driverName:      string;
  driverId?:       number;
  startPlace:      string;
  endPlace:        string;
  startLat?:       number;
  startLng?:       number;
  endLat?:         number;
  endLng?:         number;
  distanceKm?:     number;
  duration?:       string;
  customPolyline?: string;
}

export const fetchVehiclesForTrip = async (): Promise<TripVehicleOption[]> => {
  const res = await api.get<TripVehicleOption[]>(ENDPOINTS.ASSOCIATIONS_FOR_TRIP);
  return res.data;
};

export const createTrip = async (payload: TripPayload) => {
  const res = await api.post(ENDPOINTS.TRIPS, payload);
  return res.data;
};

export const updateTrip = async (id: number, payload: Partial<TripPayload>) => {
  const res = await api.put(`${ENDPOINTS.TRIPS}/${id}`, payload);
  return res.data;
};

export const deleteTrip = async (id: number) => {
  const res = await api.delete(`${ENDPOINTS.TRIPS}/${id}`);
  return res.data;
};
