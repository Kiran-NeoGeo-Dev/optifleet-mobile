package com.vts.service;

import com.vts.entity.Driver;
import com.vts.entity.DriverPhoto;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.DriverPhotoRepository;
import org.springframework.stereotype.Service;

@Service
public class DriverPhotoService {

    private final DriverPhotoRepository driverPhotoRepository;

    public DriverPhotoService(DriverPhotoRepository driverPhotoRepository) {
        this.driverPhotoRepository = driverPhotoRepository;
    }

    public DriverPhoto getByDriver(Driver driver) {
        return driverPhotoRepository.findByDriver(driver)
                .orElseThrow(() -> new ResourceNotFoundException("Driver photos not found"));
    }
}