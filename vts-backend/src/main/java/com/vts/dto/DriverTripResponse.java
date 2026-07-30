package com.vts.dto;

public class DriverTripResponse {
    private Integer id;
    private String  tripId;
    private String  vehicleId;
    private String  driverName;
    private String  startPlace;
    private String  endPlace;
    private Double  startLat;
    private Double  startLng;
    private Double  endLat;
    private Double  endLng;
    private String  distanceKm;
    private String  duration;
    private String  status;
    private String  customPolyline;
    private java.util.List<TripStopDto> tripStops;

    public static class TripStopDto {
        public int    stopOrder;
        public String stopName;
        public double lat;
        public double lng;
        public TripStopDto(int stopOrder, String stopName, double lat, double lng) {
            this.stopOrder = stopOrder;
            this.stopName  = stopName;
            this.lat       = lat;
            this.lng       = lng;
        }
    }

    public DriverTripResponse() {}

    public DriverTripResponse(com.vts.entity.Trip t, java.util.List<com.vts.entity.TripStop> stops) {
        this.id             = t.getId();
        this.tripId         = t.getTripId();
        this.vehicleId      = t.getVehicleId();
        this.driverName     = t.getDriverName();
        this.startPlace     = t.getStartPlace();
        this.endPlace       = t.getEndPlace();
        this.startLat       = t.getStartLat();
        this.startLng       = t.getStartLng();
        this.endLat         = t.getEndLat();
        this.endLng         = t.getEndLng();
        this.distanceKm     = t.getDistanceKm() != null ? t.getDistanceKm().toString() : null;
        this.duration       = t.getDuration();
        this.status         = t.getStatus();
        this.customPolyline = t.getCustomPolyline();
        this.tripStops      = stops != null
            ? stops.stream().map(s -> new TripStopDto(
                s.getStopOrder(), s.getStopName(),
                s.getLat().doubleValue(), s.getLng().doubleValue()))
              .collect(java.util.stream.Collectors.toList())
            : java.util.List.of();
    }

    public Integer getId()                                  { return id; }
    public String  getTripId()                              { return tripId; }
    public String  getVehicleId()                           { return vehicleId; }
    public String  getDriverName()                          { return driverName; }
    public String  getStartPlace()                          { return startPlace; }
    public String  getEndPlace()                            { return endPlace; }
    public Double  getStartLat()                            { return startLat; }
    public Double  getStartLng()                            { return startLng; }
    public Double  getEndLat()                              { return endLat; }
    public Double  getEndLng()                              { return endLng; }
    public String  getDistanceKm()                          { return distanceKm; }
    public String  getDuration()                            { return duration; }
    public String  getStatus()                              { return status; }
    public String  getCustomPolyline()                      { return customPolyline; }
    public java.util.List<TripStopDto> getTripStops()       { return tripStops; }
}
