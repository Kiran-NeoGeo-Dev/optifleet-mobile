export interface SystemOverviewSummary {
  organizations: number;
  totalUsers: number;
  totalDevices: number;
  totalVehicles: number;
  totalDrivers: number;
}

export interface OrganizationOverview {
  orgId: number;
  ownerName: string;
  username: string;
  createdDate: string;
  users: number;
  devices: number;
  vehicles: number;
  drivers: number;
}
