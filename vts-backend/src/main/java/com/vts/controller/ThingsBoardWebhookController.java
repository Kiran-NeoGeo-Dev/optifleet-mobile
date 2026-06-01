package com.vts.controller;

import com.vts.model.LiveTrackingUpdate;
import com.vts.model.TelemetryPayload;
import com.vts.service.LiveTrackingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/thingsboard")
public class ThingsBoardWebhookController {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardWebhookController.class);
    private final LiveTrackingService liveTrackingService;

    public ThingsBoardWebhookController(LiveTrackingService liveTrackingService) {
        this.liveTrackingService = liveTrackingService;
    }

    /** ThingsBoard rule engine calls this endpoint on every telemetry update. */
    @PostMapping("/telemetry")
    public ResponseEntity<LiveTrackingUpdate> receiveTelemetry(@RequestBody TelemetryPayload payload) {
        log.info("Telemetry received: vehicle={} lat={} lng={} speed={}",
            payload.getVehicleId(), payload.getLat(), payload.getLng(), payload.getSpeed());
        LiveTrackingUpdate update = liveTrackingService.processTelemetry(payload);
        return update != null ? ResponseEntity.ok(update) : ResponseEntity.badRequest().build();
    }
}
