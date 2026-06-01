package com.vts.repository;

import com.vts.entity.Driver;
import com.vts.entity.DriverPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DriverPhotoRepository extends JpaRepository<DriverPhoto, Long> {

    Optional<DriverPhoto> findByDriver(Driver driver);

    void deleteByDriver(Driver driver);
}