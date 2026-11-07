package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.AttachmentRefOrValue;
import com.orion.quotemanagement.entity.AttachmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<AttachmentRefOrValue, Long> {
    List<AttachmentRefOrValue> findByQuoteId(Long quoteId);
    Optional<AttachmentRefOrValue> findByExternalId(String externalId);
    List<AttachmentRefOrValue> findByQuoteIdAndStatus(Long quoteId, AttachmentStatus status);
}