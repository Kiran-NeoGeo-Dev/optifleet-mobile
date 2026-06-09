export interface DashboardSummary {
  totalDrivers:      number;
  activeDrivers:     number;
  totalVehicles:     number;
  activeVehicles:    number;
  idleVehicles:      number;
  activeAlerts:      number;
  totalAssociations: number;
  totalDevices:      number;
  totalTrips:        number;
  totalUsers:        number;
  // live counts from backend
  movingVehicles?:   number;
}

export interface LiveVehicle {
  vehicleId:      string;
  lat:            number;
  lng:            number;
  speed:          number;
  driverName:     string;
  tripStatus:     string;
  overspeed:      string;
  smoking:        string;
  mobileUsage:    string;
  drowsiness:     string;
  routeDeviation: string;
  address?:        string;
  coordinates?:    string;
  lastUpdateTime?: string;
  lastUpdateDate?: string;
}
