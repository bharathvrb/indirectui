package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * TMF 629 Customer Management API - Customer entity
 * Represents a customer that can be linked to one or more quotes.
 * Contact mediums follow TMF 632 Party Management API.
 * Spec: TMF629 Customer Management v4.0
 */
@Entity
@Table(name = "customers", indexes = {
    @Index(name = "idx_customer_external_id", columnList = "externalId"),
    @Index(name = "idx_customer_status", columnList = "status"),
    @Index(name = "idx_customer_engaged_party_id", columnList = "engagedPartyId")
})
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External / business key for the customer (TMF 629: id in responses)
     */
    @Column(name = "externalId", unique = true, length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * Hyperlink to the customer resource (TMF 629: href)
     */
    @Column(name = "href", length = 1000)
    @JsonProperty("href")
    private String href;

    /**
     * Trading name of the customer (TMF 629: name)
     */
    @Column(name = "name", nullable = false, length = 255)
    @NotBlank(message = "Customer name is required")
    @Size(max = 255)
    @JsonProperty("name")
    private String name;

    /**
     * Public / legal trading name (TMF 629: tradingName)
     */
    @Column(name = "trading_name", length = 255)
    @JsonProperty("tradingName")
    private String tradingName;

    /**
     * Status of the customer (TMF 629: status)
     */
    @Column(name = "status", nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    @NotNull
    @JsonProperty("status")
    private CustomerStatus status = CustomerStatus.ACTIVE;

    /**
     * Reason for the current status (TMF 629: statusReason)
     */
    @Column(name = "status_reason", length = 500)
    @JsonProperty("statusReason")
    private String statusReason;

    /**
     * Reference to the engaged party (Individual or Organisation) from TMF 632.
     * Stores the externalId of the party (e.g. ORG-0042 or IND-1001).
     * TMF 629: engagedParty.id
     */
    @Column(name = "engagedPartyId", length = 100)
    @JsonProperty("engagedPartyId")
    private String engagedPartyId;

    /**
     * Type of engaged party: "Individual" | "Organization" (TMF 632)
     * TMF 629: engagedParty.@referredType
     */
    @Column(name = "engaged_party_type", length = 50)
    @JsonProperty("engagedPartyType")
    private String engagedPartyType;

    /**
     * Customer account reference (TMF 629: account[0].id)
     */
    @Column(name = "account_ref", length = 100)
    @JsonProperty("accountRef")
    private String accountRef;

    /**
     * Customer market segment (TMF 629: segment)
     */
    @Column(name = "segment", length = 100)
    @JsonProperty("segment")
    private String segment;

    /**
     * Language preference (ISO 639-1)
     */
    @Column(name = "language_preference", length = 10)
    @JsonProperty("languagePreference")
    private String languagePreference;

    /**
     * Credit rating / risk tier
     */
    @Column(name = "credit_tier", length = 50)
    @JsonProperty("creditTier")
    private String creditTier;

    /**
     * Validity period start (TMF 629: validFor.startDateTime)
     */
    @Column(name = "valid_from")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("validFrom")
    private OffsetDateTime validFrom;

    /**
     * Validity period end (TMF 629: validFor.endDateTime)
     */
    @Column(name = "valid_to")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("validTo")
    private OffsetDateTime validTo;

    /**
     * Contact mediums following TMF 632 (phone, email, address, etc.)
     * TMF 629: contactMedium
     */
    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @JsonProperty("contactMedium")
    private List<ContactMedium> contactMediums = new ArrayList<>();

    /**
     * Quotes linked to this customer.
     * Navigable from Customer side but excluded from serialisation to avoid loops.
     * TMF 629: quote (ref list)
     */
    @OneToMany(mappedBy = "customer", fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Quote> quotes = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime updatedAt;

    // Constructors
    public Customer() {}

    public Customer(String externalId, String name, String tradingName) {
        this.externalId = externalId;
        this.name = name;
        this.tradingName = tradingName;
    }

    // Helper
    public void addContactMedium(ContactMedium cm) {
        contactMediums.add(cm);
        cm.setCustomer(this);
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }

    public String getHref() { return href; }
    public void setHref(String href) { this.href = href; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTradingName() { return tradingName; }
    public void setTradingName(String tradingName) { this.tradingName = tradingName; }

    public CustomerStatus getStatus() { return status; }
    public void setStatus(CustomerStatus status) { this.status = status; }

    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }

    public String getEngagedPartyId() { return engagedPartyId; }
    public void setEngagedPartyId(String engagedPartyId) { this.engagedPartyId = engagedPartyId; }

    public String getEngagedPartyType() { return engagedPartyType; }
    public void setEngagedPartyType(String engagedPartyType) { this.engagedPartyType = engagedPartyType; }

    public String getAccountRef() { return accountRef; }
    public void setAccountRef(String accountRef) { this.accountRef = accountRef; }

    public String getSegment() { return segment; }
    public void setSegment(String segment) { this.segment = segment; }

    public String getLanguagePreference() { return languagePreference; }
    public void setLanguagePreference(String languagePreference) { this.languagePreference = languagePreference; }

    public String getCreditTier() { return creditTier; }
    public void setCreditTier(String creditTier) { this.creditTier = creditTier; }

    public OffsetDateTime getValidFrom() { return validFrom; }
    public void setValidFrom(OffsetDateTime validFrom) { this.validFrom = validFrom; }

    public OffsetDateTime getValidTo() { return validTo; }
    public void setValidTo(OffsetDateTime validTo) { this.validTo = validTo; }

    public List<ContactMedium> getContactMediums() { return contactMediums; }
    public void setContactMediums(List<ContactMedium> contactMediums) { this.contactMediums = contactMediums; }

    public List<Quote> getQuotes() { return quotes; }
    public void setQuotes(List<Quote> quotes) { this.quotes = quotes; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
