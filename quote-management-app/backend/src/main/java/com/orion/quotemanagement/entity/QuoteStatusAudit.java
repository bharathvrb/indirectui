package com.orion.quotemanagement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "quote_status_audits", indexes = {
    @Index(name = "idx_quote_status_audit_quote_id", columnList = "quote_id")
})
public class QuoteStatusAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "quote_id", nullable = false)
    private Long quoteId;

    @Column(name = "actor_id", nullable = false, length = 255)
    private String actorId;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime timestamp;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", nullable = false, length = 50)
    private QuoteState previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "updated_status", nullable = false, length = 50)
    private QuoteState updatedStatus;

    protected QuoteStatusAudit() {
    }

    public QuoteStatusAudit(Long quoteId, String actorId, QuoteState previousStatus, QuoteState updatedStatus) {
        this.quoteId = quoteId;
        this.actorId = actorId;
        this.timestamp = OffsetDateTime.now();
        this.previousStatus = previousStatus;
        this.updatedStatus = updatedStatus;
    }

    public Long getId() { return id; }
    public Long getQuoteId() { return quoteId; }
    public String getActorId() { return actorId; }
    public OffsetDateTime getTimestamp() { return timestamp; }
    public QuoteState getPreviousStatus() { return previousStatus; }
    public QuoteState getUpdatedStatus() { return updatedStatus; }
}