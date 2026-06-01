package com.vts.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vts.model.RoutePoint;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class HaversineDistance {

    private static final double EARTH_RADIUS_METERS = 6371000.0;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Haversine formula — returns distance in metres between two GPS points. */
    public double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                 * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Find the index of the nearest point on the route to the vehicle position. */
    public NearestPointResult findNearestPointOnRoute(List<RoutePoint> route, double vLat, double vLng) {
        int    nearestIndex = 0;
        double minDist      = Double.MAX_VALUE;
        for (int i = 0; i < route.size(); i++) {
            double d = calculateDistance(vLat, vLng, route.get(i).getLat(), route.get(i).getLng());
            if (d < minDist) { minDist = d; nearestIndex = i; }
        }
        NearestPointResult r = new NearestPointResult();
        r.nearestIndex = nearestIndex;
        r.minDistance  = minDist;
        return r;
    }

    /** Total route length in metres. */
    public double calculateRouteDistance(List<RoutePoint> route) {
        double total = 0;
        for (int i = 0; i < route.size() - 1; i++)
            total += calculateDistance(route.get(i).getLat(), route.get(i).getLng(),
                                       route.get(i + 1).getLat(), route.get(i + 1).getLng());
        return total;
    }

    /** Remaining route length in metres from startIndex onwards. */
    public double calculateRemainingDistance(List<RoutePoint> route, int startIndex) {
        double remaining = 0;
        for (int i = startIndex; i < route.size() - 1; i++)
            remaining += calculateDistance(route.get(i).getLat(), route.get(i).getLng(),
                                           route.get(i + 1).getLat(), route.get(i + 1).getLng());
        return remaining;
    }

    /** Slice the route from startIndex to end (the shrinking polyline). */
    public List<RoutePoint> getRemainingRoute(List<RoutePoint> fullRoute, int startIndex) {
        if (startIndex >= fullRoute.size()) return new ArrayList<>();
        return new ArrayList<>(fullRoute.subList(startIndex, fullRoute.size()));
    }

    /** Parse custom_polyline JSON text → List<RoutePoint>. */
    @SuppressWarnings("unchecked")
    public List<RoutePoint> parsePolyline(String polylineJson) {
        List<RoutePoint> result = new ArrayList<>();
        if (polylineJson == null || polylineJson.isBlank()) return result;
        try {
            List<Map<String, Double>> pts = objectMapper.readValue(polylineJson,
                objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class));
            for (Map<String, Double> p : pts)
                result.add(new RoutePoint(p.get("lat"), p.get("lng")));
        } catch (Exception ignored) {}
        return result;
    }

    public static class NearestPointResult {
        public int    nearestIndex;
        public double minDistance;
    }
}
