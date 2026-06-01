package com.vts.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ThingsBoardConfig {

    @Value("${tb.host.primary:183.82.114.29}")
    private String primaryHost;

    @Value("${tb.port.primary:8282}")
    private int primaryPort;

    @Value("${tb.host.fallback:192.168.1.146}")
    private String fallbackHost;

    @Value("${tb.port.fallback:8282}")
    private int fallbackPort;

    @Value("${tb.username:kiran.m@neogeoinfo.com}")
    private String username;

    @Value("${tb.password:NeoGeo@321}")
    private String password;

    @Value("${tb.primary.active:true}")
    private boolean primaryActive;

    @Value("${tb.deviation.threshold:100}")
    private int deviationThreshold;

    private boolean usingFallback = false;

    public String getPrimaryUrl()  { return "http://" + primaryHost + ":" + primaryPort; }
    public String getFallbackUrl() { return "http://" + fallbackHost + ":" + fallbackPort; }

    public String getActiveUrl() {
        return (!usingFallback && primaryActive) ? getPrimaryUrl() : getFallbackUrl();
    }

    public void switchToFallback() { this.usingFallback = true; }
    public void switchToPrimary()  { this.usingFallback = false; }
    public boolean isUsingFallback() { return usingFallback; }

    public String getUsername()        { return username; }
    public String getPassword()        { return password; }
    public boolean isPrimaryActive()   { return primaryActive; }
    public int getDeviationThreshold() { return deviationThreshold; }
}
