package com.vts.controller;

import com.vts.dto.SystemOverviewOrganizationResponse;
import com.vts.dto.SystemOverviewSummaryResponse;
import com.vts.service.AuthService;
import com.vts.service.SystemOverviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/superadmin/system-overview")
public class SystemOverviewController {

    private final SystemOverviewService systemOverviewService;
    private final AuthService authService;

    public SystemOverviewController(SystemOverviewService systemOverviewService,
                                    AuthService authService) {
        this.systemOverviewService = systemOverviewService;
        this.authService = authService;
    }

    @PreAuthorize("hasRole('CLIENT') and @authService.isSuperAdmin()")
    @GetMapping("/summary")
    public ResponseEntity<SystemOverviewSummaryResponse> getSummary() {
        return ResponseEntity.ok(systemOverviewService.fetchSummary());
    }

    @PreAuthorize("hasRole('CLIENT') and @authService.isSuperAdmin()")
    @GetMapping("/organizations")
    public ResponseEntity<List<SystemOverviewOrganizationResponse>> getOrganizations() {
        return ResponseEntity.ok(systemOverviewService.fetchOrganizations());
    }

    @PreAuthorize("hasRole('CLIENT') and @authService.isSuperAdmin()")
    @GetMapping("/organizations/{orgId}")
    public ResponseEntity<SystemOverviewOrganizationResponse> getOrganization(@PathVariable Long orgId) {
        return systemOverviewService.fetchOrganization(orgId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
