package com.vts.repository;

import com.vts.entity.UserDetailEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserDetailRepository extends JpaRepository<UserDetailEntity, Integer> {

    Optional<UserDetailEntity> findByUsername(String username);

    Optional<UserDetailEntity> findByEmailAddress(String emailAddress);

    Optional<UserDetailEntity> findFirstByRole(String role);
}
