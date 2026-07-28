/**
 * Shared OSRM routing utility — single implementation used by:
 *   RegisterTripScreen, EditTripScreen, TripLiveTrackingScreen, DriverMapScreen
 *
 * Uses overview=full + geometries=geojson + steps=true for maximum accuracy.
 * Falls back gracefully on network error.
 */

export interface OsrmRouteResult {
  distanceKm:    number;         // road distance in km (from OSRM response)
  durationStr:   string;         // human-readable e.g. "2h 15min" or "45min"
  durationMin:   number;         // raw minutes
  polylineCoords: string;        // JSON string [{lat,lng},...] for storage
  latlngs:       [number, number][]; // [[lat,lng],...] for Leaflet
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/** Calculate route through multiple waypoints: start → ...stops → end */
export async function calculateOsrmRouteMulti(
  waypoints: { lat: number; lng: number }[]
): Promise<OsrmRouteResult | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(";");
  try {
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=true&annotations=false`;
    const res  = await fetch(url, { headers: { "User-Agent": "OptiFleet-VTS/1.0" } });
    const data = await res.json();
    if (!data.routes?.length || data.code !== "Ok") return null;
    const route      = data.routes[0];
    const km         = Math.round(route.distance / 100) / 10;
    const totalMin   = Math.round(route.duration / 60);
    const hrs        = Math.floor(totalMin / 60);
    const mins       = totalMin % 60;
    const durationStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
    const coords2: [number, number][] = route.geometry.coordinates;
    const latlngs: [number, number][] = coords2.map((c: [number, number]) => [c[1], c[0]]);
    const polylineCoords = JSON.stringify(latlngs.map(([lat, lng]) => ({ lat, lng })));
    return { distanceKm: km, durationStr, durationMin: totalMin, polylineCoords, latlngs };
  } catch {
    return null;
  }
}

export async function calculateOsrmRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<OsrmRouteResult | null> {
  try {
    // Use overview=full for complete road geometry, steps=true for turn-by-turn accuracy
    const url = `${OSRM_BASE}/${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson&steps=true&annotations=false`;

    const res  = await fetch(url, { headers: { "User-Agent": "OptiFleet-VTS/1.0" } });
    const data = await res.json();

    if (!data.routes?.length || data.code !== "Ok") return null;

    const route      = data.routes[0];
    const distanceM  = route.distance as number;   // metres — from OSRM (road distance)
    const durationS  = route.duration as number;   // seconds — from OSRM (travel time)

    const km         = Math.round(distanceM / 100) / 10; // round to 1 decimal
    const totalMin   = Math.round(durationS / 60);
    const hrs        = Math.floor(totalMin / 60);
    const mins       = totalMin % 60;
    const durationStr = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;

    // Coordinates array from GeoJSON: each item is [lng, lat]
    const coords: [number, number][] = route.geometry.coordinates;
    const latlngs: [number, number][] = coords.map(c => [c[1], c[0]]);
    const polylineCoords = JSON.stringify(latlngs.map(([lat, lng]) => ({ lat, lng })));

    return { distanceKm: km, durationStr, durationMin: totalMin, polylineCoords, latlngs };
  } catch {
    return null;
  }
}
