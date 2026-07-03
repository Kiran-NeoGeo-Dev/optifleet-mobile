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

    long countByOrgId(Long orgId);

    long countByOrgIdIsNotNull();

    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(DISTINCT org_id) FROM public.userdetail WHERE org_id IS NOT NULL", nativeQuery = true)
    long countDistinctOrganizations();

    long countByRoleIgnoreCaseAndOrgIdIsNotNull(String role);

    List<UserDetailEntity> findByRoleIgnoreCaseAndOrgIdIsNotNull(String role);

    Optional<UserDetailEntity> findByClientIdAndOrgId(Integer clientId, Long orgId);
}
