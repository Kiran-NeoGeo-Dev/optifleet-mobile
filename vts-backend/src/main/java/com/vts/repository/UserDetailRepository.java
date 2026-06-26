package com.vts.repository;

import com.vts.entity.UserDetailEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface UserDetailRepository extends JpaRepository<UserDetailEntity, Integer> {

    Optional<UserDetailEntity> findByUsername(String username);

    Optional<UserDetailEntity> findByEmailAddress(String emailAddress);

    Optional<UserDetailEntity> findFirstByRole(String role);

    List<UserDetailEntity> findByOrgId(Long orgId);

    Optional<UserDetailEntity> findByClientIdAndOrgId(Integer clientId, Long orgId);
}
