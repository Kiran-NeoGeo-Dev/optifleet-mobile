// Production — public IP, works on any network (mobile data, WiFi, etc.)
//export const API_BASE_URL = "http://10.11.239.165:8083";

export const API_BASE_URL = "http://192.168.1.199:8083";

// Local WiFi (only when phone & server are on same network)
// export const API_BASE_URL = "http://10.108.105.165:8787";

// Custom domain

//export const API_BASE_URL = "http://vtsweb.neogeoinfo.in:8787";


export const ENDPOINTS = {
  LOGIN: "/api/auth/login",
  FORGOT_PASSWORD_MESSAGE: "/api/auth/forgot-password-message",
  CLIENT_DETAILS: "/api/auth/client-details",
  DASHBOARD_SUMMARY: "/api/dashboard/summary",
  DASHBOARD_DRIVERS: "/api/dashboard/drivers",
  DASHBOARD_VEHICLES: "/api/dashboard/vehicles",
  DRIVERS: "/api/drivers",
  VEHICLES: "/api/vehicles",
  DRIVER_PHOTOS: "/api/driver-photos",
  TRIPS: "/api/trips",
  DRIVER_ACTIVE_TRIP: "/api/trips/driver/active",
  DRIVER_ME: "/api/drivers/me",
  ASSOCIATIONS_FOR_TRIP: "/api/associations/vehicles-for-trip",
  LIVE_TRACKING_STATE: "/api/live-tracking/state",  // GET /{vehicleId}
  WS_LIVE_TRACKING: "/ws/live-tracking",             // STOMP endpoint
  NOTIFICATIONS: "/api/notifications",
  LIVE_VEHICLES: "/api/dashboard/live-vehicles",
  FLEET_VEHICLES: "/api/fleet/vehicles",
  DRIVER_LOGIN: "/api/driver-auth/login",
};
