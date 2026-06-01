package com.vts.model;

public class RoutePoint {
    private double lat;
    private double lng;

    public RoutePoint() {}
    public RoutePoint(double lat, double lng) { this.lat = lat; this.lng = lng; }

    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public void setLat(double lat) { this.lat = lat; }
    public void setLng(double lng) { this.lng = lng; }
}
