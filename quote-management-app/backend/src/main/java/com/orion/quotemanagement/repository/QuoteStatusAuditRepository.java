package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.QuoteStatusAudit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuoteStatusAuditRepository extends JpaRepository<QuoteStatusAudit, Long> {
}