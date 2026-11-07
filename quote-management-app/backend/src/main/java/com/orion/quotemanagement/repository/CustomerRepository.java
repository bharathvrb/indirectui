package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.Customer;
import com.orion.quotemanagement.entity.CustomerStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * TMF 629 Customer Repository
 */
@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByExternalId(String externalId);

    Page<Customer> findByStatus(CustomerStatus status, Pageable pageable);

    Page<Customer> findByNameContainingIgnoreCase(String name, Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE c.engagedPartyId = :engagedPartyId")
    Optional<Customer> findByEngagedPartyId(String engagedPartyId);

    boolean existsByExternalId(String externalId);
}
