package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

/**
 * TMF 648 Related Party entity with PII exclusion validation
 * Represents parties related to a quote (customers, partners, etc.)
 * IMPORTANT: No PII or site-level address data allowed as per requirements
 */
@Entity
@Table(name = "related_parties", indexes = {
    @Index(name = "idx_related_party_external_id", columnList = "externalId"),
    @Index(name = "idx_related_party_role", columnList = "role"),
    @Index(name = "idx_related_party_quote_id", columnList = "quote_id")
})
public class RelatedParty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the related party (TMF 648 compliance)
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * A URL to the related party
     */
    @Column(name = "href", length = 1000)
    private String href;

    /**
     * Organization name or business identifier (NO PII)
     * Must be organization/company name only, not individual names
     */
    @Column(name = "name", length = 200)
    @Size(max = 200, message = "Name cannot exceed 200 characters")
    @Pattern(regexp = "^[^@]*$", message = "Individual names or email addresses not allowed - organization names only")
    private String name;

    /**
     * Role of the related party in the quote context
     */
    @Column(name = "role", nullable = false, length = 100)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Related party role is required")
    private RelatedPartyRole role;

    /**
     * Organization reference ID (customer ID, partner ID, etc.)
     * Used for system integration without exposing PII
     */
    @Column(name = "organization_ref_id", length = 100)
    @JsonProperty("organizationRefId")
    @Size(max = 100, message = "Organization reference ID cannot exceed 100 characters")
    private String organizationRefId;

    /**
     * Contact method (phone, email domain, portal, etc.) - NO specific PII
     * General contact method without specific personal details
     */
    @Column(name = "contact_method", length = 100)
    @JsonProperty("contactMethod")
    @Size(max = 100, message = "Contact method cannot exceed 100 characters")
    private String contactMethod;

    /**
     * Department or division within the organization
     */
    @Column(name = "department", length = 100)
    @Size(max = 100, message = "Department cannot exceed 100 characters")
    private String department;

    /**
     * Geographic region or market (high-level only - no specific addresses)
     */
    @Column(name = "region", length = 100)
    @Size(max = 100, message = "Region cannot exceed 100 characters")
    private String region;

    /**
     * Related party status
     */
    @Column(name = "status", length = 50)
    @Enumerated(EnumType.STRING)
    private RelatedPartyStatus status;

    /**
     * Parent quote (many-to-one relationship)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_id", nullable = false)
    @NotNull(message = "Quote is required")
    @JsonIgnore
    private Quote quote;

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

    // Constructors
    public RelatedParty() {
        this.status = RelatedPartyStatus.ACTIVE;
    }

    public RelatedParty(String name, RelatedPartyRole role, String organizationRefId) {
        this();
        this.name = name;
        this.role = role;
        this.organizationRefId = organizationRefId;
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        // Validation: Ensure no PII in name field
        if (name != null && (name.contains("@") || 
            name.matches(".*\\b(Mr\\.|Mrs\\.|Ms\\.|Dr\\.)\\b.*"))) {
            throw new IllegalArgumentException("Individual names or personal identifiers not allowed - organization names only");
        }
        this.name = name;
    }

    public RelatedPartyRole getRole() {
        return role;
    }

    public void setRole(RelatedPartyRole role) {
        this.role = role;
    }

    public String getOrganizationRefId() {
        return organizationRefId;
    }

    public void setOrganizationRefId(String organizationRefId) {
        this.organizationRefId = organizationRefId;
    }

    public String getContactMethod() {
        return contactMethod;
    }

    public void setContactMethod(String contactMethod) {
        this.contactMethod = contactMethod;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public RelatedPartyStatus getStatus() {
        return status;
    }

    public void setStatus(RelatedPartyStatus status) {
        this.status = status;
    }

    public Quote getQuote() {
        return quote;
    }

    public void setQuote(Quote quote) {
        this.quote = quote;
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

    @Override
    public String toString() {
        return "RelatedParty{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", name='" + name + '\'' +
                ", role=" + role +
                ", organizationRefId='" + organizationRefId + '\'' +
                ", status=" + status +
                ", createdAt=" + createdAt +
                '}';
    }
}
