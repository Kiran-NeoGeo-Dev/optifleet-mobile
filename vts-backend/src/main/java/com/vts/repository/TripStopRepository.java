package com.vts.repository;

import com.vts.entity.TripStop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface TripStopRepository extends JpaRepository<TripStop, Integer> {

    List<TripStop> findByTripIdOrderByStopOrderAsc(String tripId);

    @Modifying
    @Transactional
    @Query("DELETE FROM TripStop ts WHERE ts.tripId = :tripId")
    void deleteByTripId(@Param("tripId") String tripId);
}
