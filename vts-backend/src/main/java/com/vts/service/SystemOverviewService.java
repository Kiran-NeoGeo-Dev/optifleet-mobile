package com.vts.service;

import com.vts.dto.SystemOverviewOrganizationResponse;
import com.vts.dto.SystemOverviewSummaryResponse;
import com.vts.entity.Client;
import com.vts.entity.UserDetailEntity;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.UserDetailRepository;
import com.vts.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SystemOverviewService {

    private final UserDetailRepository userDetailRepository;
    private final DeviceRepository userDeviceRepository;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final AuthService authService;

    public SystemOverviewService(UserDetailRepository userDetailRepository,
                                 DeviceRepository userDeviceRepository,
                                 VehicleRepository vehicleRepository,
                                 DriverRepository driverRepository,
                                 AuthService authService) {
        this.userDetailRepository   = userDetailRepository;
        this.userDeviceRepository   = userDeviceRepository;
        this.vehicleRepository      = vehicleRepository;
        this.driverRepository       = driverRepository;
        this.authService            = authService;
    }

    public SystemOverviewSummaryResponse fetchSummary() {
        Client current = authService.getCurrentClient();
        if (!authService.isSuperAdmin(current)) {
            throw new org.springframework.security.access.AccessDeniedException("Super Admin only");
        }

        long organizations = userDetailRepository.countDistinctOrganizations();
        long totalUsers     = userDetailRepository.countByOrgIdIsNotNull();
        long totalDevices   = userDeviceRepository.countByOrgIdIsNotNull();
        long totalVehicles  = vehicleRepository.countByOrgIdIsNotNull();
        long totalDrivers   = driverRepository.countByOrgIdIsNotNull();

        return new SystemOverviewSummaryResponse(organizations, totalUsers, totalDevices, totalVehicles, totalDrivers);
    }

    public List<SystemOverviewOrganizationResponse> fetchOrganizations() {
        Client current = authService.getCurrentClient();
        if (!authService.isSuperAdmin(current)) {
            throw new org.springframework.security.access.AccessDeniedException("Super Admin only");
        }

        List<UserDetailEntity> orgAdmins = userDetailRepository.findByRoleIgnoreCaseAndOrgIdIsNotNull("admin");
        Map<Long, List<UserDetailEntity>> orgByOrgId = orgAdmins.stream()
                .collect(Collectors.groupingBy(UserDetailEntity::getOrgId));

        List<SystemOverviewOrganizationResponse> organizations = new ArrayList<>();
        for (Map.Entry<Long, List<UserDetailEntity>> entry : orgByOrgId.entrySet()) {
            Long orgId = entry.getKey();
            List<UserDetailEntity> admins = entry.getValue();
            UserDetailEntity owner = admins.stream()
                    .filter(a -> a.getClientId() != null && a.getClientId().longValue() == orgId)
                    .findFirst()
                    .orElse(admins.get(0));

            SystemOverviewOrganizationResponse org = new SystemOverviewOrganizationResponse();
            org.setOrgId(orgId);
            org.setOwnerName(owner.getFullName() != null ? owner.getFullName() : "");
            org.setUsername(owner.getUsername());
            org.setCreatedDate(owner.getCreatedAt() != null ? owner.getCreatedAt() : Instant.EPOCH);
            org.setUsers(userDetailRepository.findByOrgId(orgId).size());
            org.setDevices(userDeviceRepository.countByOrgId(orgId));
            org.setVehicles(vehicleRepository.countByOrgId(orgId));
            org.setDrivers(driverRepository.countByOrgId(orgId));
            organizations.add(org);
        }

        return organizations;
    }

    public Optional<SystemOverviewOrganizationResponse> fetchOrganization(Long orgId) {
        Client current = authService.getCurrentClient();
        if (!authService.isSuperAdmin(current)) {
            throw new org.springframework.security.access.AccessDeniedException("Super Admin only");
        }

        List<UserDetailEntity> orgAdmins = userDetailRepository.findByRoleIgnoreCaseAndOrgIdIsNotNull("admin");
        Long matchedOrgId = orgAdmins.stream()
                .map(UserDetailEntity::getOrgId)
                .filter(id -> id != null && id.equals(orgId))
                .findFirst()
                .orElse(null);
        if (matchedOrgId == null) {
            return Optional.empty();
        }

        List<UserDetailEntity> admins = orgAdmins.stream()
                .filter(a -> a.getOrgId() != null && a.getOrgId().equals(orgId))
                .toList();
        if (admins.isEmpty()) {
            return Optional.empty();
        }

        UserDetailEntity owner = admins.stream()
                .filter(a -> a.getClientId() != null && a.getClientId().longValue() == orgId)
                .findFirst()
                .orElse(admins.get(0));

        SystemOverviewOrganizationResponse org = new SystemOverviewOrganizationResponse();
        org.setOrgId(orgId);
        org.setOwnerName(owner.getFullName() != null ? owner.getFullName() : "");
        org.setUsername(owner.getUsername());
        org.setCreatedDate(owner.getCreatedAt() != null ? owner.getCreatedAt() : Instant.EPOCH);
        org.setUsers(userDetailRepository.findByOrgId(orgId).size());
        org.setDevices(userDeviceRepository.countByOrgId(orgId));
        org.setVehicles(vehicleRepository.countByOrgId(orgId));
        org.setDrivers(driverRepository.countByOrgId(orgId));
        return Optional.of(org);
    }
}
