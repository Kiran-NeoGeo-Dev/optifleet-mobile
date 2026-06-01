package com.vts.service;

import com.vts.model.RoutePoint;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TripStateCache {

    public static class State {
        public String           vehicleId;
        public String           tripId;
        public Long             clientId;
        public String           driverName;
        public List<RoutePoint> fullRoute;
        public List<RoutePoint> remainingRoute;
        public int              currentPointIndex;
        public double           totalDistanceM;
        public double           remainingDistanceM;
        public double           lastSpeedKmh;
        public Instant          lastUpdateTime;
        public double           lastLat;
        public double           lastLng;
        public com.vts.model.VehiclePopupData lastPopup;

        public double progressPct() {
            if (totalDistanceM <= 0) return 0;
            return ((totalDistanceM - remainingDistanceM) / totalDistanceM) * 100.0;
        }

        /** ETA in minutes based on current speed. */
        public double etaMinutes() {
            if (lastSpeedKmh <= 0) return 0;
            double speedMs = lastSpeedKmh / 3.6;
            return (remainingDistanceM / speedMs) / 60.0;
        }
    }

    private final Map<String, State> cache = new ConcurrentHashMap<>();

    public State  get(String vehicleId)              { return cache.get(vehicleId); }
    public void   put(String vehicleId, State state) { cache.put(vehicleId, state); }
    public void   remove(String vehicleId)           { cache.remove(vehicleId); }
    public boolean has(String vehicleId)             { return cache.containsKey(vehicleId); }
}
