package com.urlo.project;

public class Notification {
    private String id;
    private String address;
    private double avgSpeed;
    private String date;
    private int deviceCount;
    private double latitude;
    private double longitude;
    private String severity;
    private String time;
    private long timestamp;

    // Constructor mặc định cho Firebase
    public Notification() {
    }

    // Constructor đầy đủ
    public Notification(String id, String address, double avgSpeed, String date,
                        int deviceCount, double latitude, double longitude,
                        String severity, String time, long timestamp) {
        this.id = id;
        this.address = address;
        this.avgSpeed = avgSpeed;
        this.date = date;
        this.deviceCount = deviceCount;
        this.latitude = latitude;
        this.longitude = longitude;
        this.severity = severity;
        this.time = time;
        this.timestamp = timestamp;
    }

    // Getters
    public String getId() {
        return id;
    }

    public String getAddress() {
        return address != null ? address : "";
    }

    public double getAvgSpeed() {
        return avgSpeed;
    }

    public String getDate() {
        return date != null ? date : "";
    }

    public int getDeviceCount() {
        return deviceCount;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getSeverity() {
        return severity != null ? severity : "";
    }

    public String getTime() {
        return time != null ? time : "";
    }

    public long getTimestamp() {
        return timestamp;
    }

    // Setters
    public void setId(String id) {
        this.id = id;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public void setAvgSpeed(double avgSpeed) {
        this.avgSpeed = avgSpeed;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public void setDeviceCount(int deviceCount) {
        this.deviceCount = deviceCount;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}