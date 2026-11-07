package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * TMF 648 Quote Management API compliant Quote entity
 * Represents a quote for telecommunications services according to TMF 648 standard
 */
@Entity
@Table(name = "quotes", indexes = {
    @Index(name = "idx_quote_external_id", columnList = "externalId"),
    @Index(name = "idx_quote_state", columnList = "state"),
    @Index(name = "idx_quote_creation_date", columnList = "quoteDate")
})
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the quote (TMF 648 compliance)
     */
    @Column(name = "external_id", unique = true, length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * A URL to the quote (TMF 648 compliance)
     */
    @Column(name = "href", length = 1000)
    private String href;

    /**
     * Description of the quote
     */
    @Column(name = "description", length = 1000)
    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    private String description;

    /**
     * Quote date when quote was created (TMF 648 compliance)
     */
    @Column(name = "quote_date", nullable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("quoteDate")
    @NotNull(message = "Quote date is required")
    private OffsetDateTime quoteDate;

    /**
     * Quote valid until date (TMF 648 compliance)
     */
    @Column(name = "valid_until")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("validFor")
    private OffsetDateTime validUntil;

    /**
     * Expected fulfillment start date
     */
    @Column(name = "expected_fulfillment_start_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("expectedFulfillmentStartDate")
    private OffsetDateTime expectedFulfillmentStartDate;

    /**
     * Expected quote completion date
     */
    @Column(name = "expected_quote_completion_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("expectedQuoteCompletionDate")
    private OffsetDateTime expectedQuoteCompletionDate;

    /**
     * Effective quote completion date
     */
    @Column(name = "effective_quote_completion_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("effectiveQuoteCompletionDate")
    private OffsetDateTime effectiveQuoteCompletionDate;

    /**
     * Quote state (TMF 648 compliance)
     * Values: inProgress, completed, failed, rejected, accepted
     */
    @Column(name = "state", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Quote state is required")
    private QuoteState state;

    /**
     * Current processing sub-step within the quote lifecycle.
     * Null when state is COMPLETED (all steps done).
     */
    @Column(name = "sub_step", length = 100)
    @JsonProperty("subStep")
    private String subStep;

    @Column(name = "envelope_id", length = 255)
    @JsonProperty("envelopeId")
    private String envelopeId;

    @Column(name = "soa_dmaas_id", length = 255)
    @JsonProperty("soaDmaasId")
    private String soaDmaasId;

    @Column(name = "msa_dmaas_id", length = 255)
    @JsonProperty("msaDmaasId")
    private String msaDmaasId;

    /**
     * Version of the quote
     */
    @Column(name = "version", length = 50)
    private String version;

    /**
     * Total price of the quote
     */
    @Column(name = "quote_total_price", precision = 19, scale = 2)
    @JsonProperty("quoteTotalPrice")
    @DecimalMin(value = "0.0", inclusive = true, message = "Quote total price must be non-negative")
    private BigDecimal quoteTotalPrice;

    /**
     * Request reason for the quote
     */
    @Column(name = "request_reason", length = 500)
    @JsonProperty("requestReason")
    @Size(max = 500, message = "Request reason cannot exceed 500 characters")
    private String requestReason;

    /**
     * Category of the quote
     */
    @Column(name = "category", length = 100)
    private String category;

    /**
     * Creation timestamp
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime createdAt;

    /**
     * Last update timestamp
     */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime updatedAt;

    /**
     * Quote items (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("quoteItem")
    private List<QuoteItem> quoteItems = new ArrayList<>();

    /**
     * Related parties (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("relatedParty")
    private List<RelatedParty> relatedParties = new ArrayList<>();

    /**
     * Attachments (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("attachment")
    private List<AttachmentRefOrValue> attachments = new ArrayList<>();

    /**
     * Notes (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("note")
    private List<Note> notes = new ArrayList<>();

    /**
     * Support tickets (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quote", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("supportTickets")
    private List<SupportTicket> supportTickets = new ArrayList<>();

    /**
     * Customer associated with this quote (TMF 629)
     * Serialised with contactMedium included; deep loops suppressed.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"quotes", "createdAt", "updatedAt", "hibernateLazyInitializer", "handler"})
    @JsonProperty("customer")
    private Customer customer;

    /**
     * Full TMF 648 request payload stored as JSON text.
     * Used by the UI to render Customer, Site, Service Products and Promotions tabs
     * from the original structured request without requiring schema changes per release.
     */
    @Column(name = "raw_payload", columnDefinition = "TEXT")
    @JsonProperty("rawPayload")
    private String rawPayload;

    // Constructors
    public Quote() {
        this.quoteDate = OffsetDateTime.now();
        this.state = QuoteState.IN_PROGRESS;
    }

    public Quote(String description, BigDecimal quoteTotalPrice) {
        this();
        this.description = description;
        this.quoteTotalPrice = quoteTotalPrice;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public String getHref() {
        return href;
    }

    public void setHref(String href) {
        this.href = href;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public OffsetDateTime getQuoteDate() {
        return quoteDate;
    }

    public void setQuoteDate(OffsetDateTime quoteDate) {
        this.quoteDate = quoteDate;
    }

    public OffsetDateTime getValidUntil() {
        return validUntil;
    }

    public void setValidUntil(OffsetDateTime validUntil) {
        this.validUntil = validUntil;
    }

    public OffsetDateTime getExpectedFulfillmentStartDate() {
        return expectedFulfillmentStartDate;
    }

    public void setExpectedFulfillmentStartDate(OffsetDateTime expectedFulfillmentStartDate) {
        this.expectedFulfillmentStartDate = expectedFulfillmentStartDate;
    }

    public OffsetDateTime getExpectedQuoteCompletionDate() {
        return expectedQuoteCompletionDate;
    }

    public void setExpectedQuoteCompletionDate(OffsetDateTime expectedQuoteCompletionDate) {
        this.expectedQuoteCompletionDate = expectedQuoteCompletionDate;
    }

    public OffsetDateTime getEffectiveQuoteCompletionDate() {
        return effectiveQuoteCompletionDate;
    }

    public void setEffectiveQuoteCompletionDate(OffsetDateTime effectiveQuoteCompletionDate) {
        this.effectiveQuoteCompletionDate = effectiveQuoteCompletionDate;
    }

    public QuoteState getState() {
        return state;
    }

    public void setState(QuoteState state) {
        this.state = state;
    }

    public String getSubStep() {
        return subStep;
    }

    public void setSubStep(String subStep) {
        this.subStep = subStep;
    }

    public String getEnvelopeId() {
        return envelopeId;
    }

    public void setEnvelopeId(String envelopeId) {
        this.envelopeId = envelopeId;
    }

    public String getSoaDmaasId() {
        return soaDmaasId;
    }

    public void setSoaDmaasId(String soaDmaasId) {
        this.soaDmaasId = soaDmaasId;
    }

    public String getMsaDmaasId() {
        return msaDmaasId;
    }

    public void setMsaDmaasId(String msaDmaasId) {
        this.msaDmaasId = msaDmaasId;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public BigDecimal getQuoteTotalPrice() {
        return quoteTotalPrice;
    }

    public void setQuoteTotalPrice(BigDecimal quoteTotalPrice) {
        this.quoteTotalPrice = quoteTotalPrice;
    }

    public String getRequestReason() {
        return requestReason;
    }

    public void setRequestReason(String requestReason) {
        this.requestReason = requestReason;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<QuoteItem> getQuoteItems() {
        return quoteItems;
    }

    public void setQuoteItems(List<QuoteItem> quoteItems) {
        this.quoteItems = quoteItems;
    }

    public List<RelatedParty> getRelatedParties() {
        return relatedParties;
    }

    public void setRelatedParties(List<RelatedParty> relatedParties) {
        this.relatedParties = relatedParties;
    }

    public List<AttachmentRefOrValue> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<AttachmentRefOrValue> attachments) {
        this.attachments = attachments;
    }

    public List<Note> getNotes() {
        return notes;
    }

    public void setNotes(List<Note> notes) {
        this.notes = notes;
    }

    public List<SupportTicket> getSupportTickets() {
        return supportTickets;
    }

    public void setSupportTickets(List<SupportTicket> supportTickets) {
        this.supportTickets = supportTickets;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public String getRawPayload() {
        return rawPayload;
    }

    public void setRawPayload(String rawPayload) {
        this.rawPayload = rawPayload;
    }

    // Utility methods
    public void addQuoteItem(QuoteItem quoteItem) {
        quoteItems.add(quoteItem);
        quoteItem.setQuote(this);
    }

    public void removeQuoteItem(QuoteItem quoteItem) {
        quoteItems.remove(quoteItem);
        quoteItem.setQuote(null);
    }

    public void addRelatedParty(RelatedParty relatedParty) {
        relatedParties.add(relatedParty);
        relatedParty.setQuote(this);
    }

    public void removeRelatedParty(RelatedParty relatedParty) {
        relatedParties.remove(relatedParty);
        relatedParty.setQuote(null);
    }

    public void addAttachment(AttachmentRefOrValue attachment) {
        attachments.add(attachment);
        attachment.setQuote(this);
    }

    public void removeAttachment(AttachmentRefOrValue attachment) {
        attachments.remove(attachment);
        attachment.setQuote(null);
    }

    public void addNote(Note note) {
        notes.add(note);
        note.setQuote(this);
    }

    public void removeNote(Note note) {
        notes.remove(note);
        note.setQuote(null);
    }

    @Override
    public String toString() {
        return "Quote{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", description='" + description + '\'' +
                ", state=" + state +
                ", quoteTotalPrice=" + quoteTotalPrice +
                ", createdAt=" + createdAt +
                '}';
    }
}
