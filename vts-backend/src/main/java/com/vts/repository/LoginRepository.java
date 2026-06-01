package com.vts.repository;

import com.vts.entity.LoginEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface LoginRepository extends JpaRepository<LoginEntity, Integer> {

    Optional<LoginEntity> findByUsername(String username);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM public.login WHERE client_id = :clientId", nativeQuery = true)
    void deleteByClientId(Integer clientId);
}
