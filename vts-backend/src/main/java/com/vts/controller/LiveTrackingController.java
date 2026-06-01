package com.vts.controller;

import com.vts.model.LiveTrackingUpdate;
import com.vts.service.LiveTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/live-tracking")
public class LiveTrackingController {

    private final LiveTrackingService liveTrackingService;

    public LiveTrackingController(LiveTrackingService liveTrackingService) {
        this.liveTrackingService = liveTrackingService;
    }

    /** Mobile polls this on screen open to get the latest cached state immediately. */
    @GetMapping("/state/{vehicleId}")
    public ResponseEntity<LiveTrackingUpdate> getState(@PathVariable String vehicleId) {
        LiveTrackingUpdate update = liveTrackingService.getCurrentState(vehicleId);
        return update != null ? ResponseEntity.ok(update) : ResponseEntity.notFound().build();
    }
}
