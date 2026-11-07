package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * TMF 648 Price Alteration entity
 * Represents modifications to base prices (discounts, surcharges, etc.)
 */
@Entity
@Table(name = "price_alterations", indexes = {
    @Index(name = "idx_price_alteration_price_id", columnList = "quote_item_price_id"),
    @Index(name = "idx_price_alteration_type", columnList = "priceType"),
    @Index(name = "idx_price_alteration_application_duration", columnList = "applicationDuration")
})
public class PriceAlteration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the price alteration
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * Name of the price alteration
     */
    @Column(name = "name", length = 200)
    @Size(max = 200, message = "Price alteration name cannot exceed 200 characters")
    private String name;

    /**
     * Description of the price alteration
     */
    @Column(name = "description", length = 1000)
    @Size(max = 1000, message = "Price alteration description cannot exceed 1000 characters")
    private String description;

    /**
     * Type of price alteration
     */
    @Column(name = "price_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Price alteration type is required")
    @JsonProperty("priceType")
    private PriceAlterationType priceType;

    /**
     * Unit of measure for the alteration
     */
    @Column(name = "unit_of_measure", length = 50)
    @JsonProperty("unitOfMeasure")
    @Size(max = 50, message = "Unit of measure cannot exceed 50 characters")
    private String unitOfMeasure;

    /**
     * Price alteration value (can be positive or negative)
     */
    @Column(name = "price", precision = 19, scale = 2)
    private BigDecimal price;

    /**
     * Currency code for the alteration (ISO 4217)
     */
    @Column(name = "currency", length = 3)
    @Size(min = 3, max = 3, message = "Currency must be 3 characters (ISO 4217)")
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be uppercase ISO 4217 code")
    private String currency;

    /**
     * Percentage alteration (for percentage-based alterations)
     */
    @Column(name = "percentage", precision = 5, scale = 2)
    @DecimalMin(value = "-100.0", inclusive = true, message = "Percentage cannot be less than -100")
    @DecimalMax(value = "1000.0", inclusive = true, message = "Percentage cannot exceed 1000")
    private BigDecimal percentage;

    /**
     * Priority of the alteration (for ordering multiple alterations)
     */
    @Column(name = "priority")
    @Min(value = 1, message = "Priority must be at least 1")
    private Integer priority;

    /**
     * Duration for which the alteration applies
     */
    @Column(name = "application_duration", length = 50)
    @Enumerated(EnumType.STRING)
    @JsonProperty("applicationDuration")
    private ApplicationDuration applicationDuration;

    /**
     * Recurring charge period (for recurring alterations)
     */
    @Column(name = "recurring_charge_period", length = 50)
    @Enumerated(EnumType.STRING)
    @JsonProperty("recurringChargePeriod")
    private RecurringChargePeriod recurringChargePeriod;

    /**
     * Parent quote item price (many-to-one relationship)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_item_price_id", nullable = false)
    @NotNull(message = "Quote item price is required")
    @JsonIgnore
    private QuoteItemPrice quoteItemPrice;

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
    public PriceAlteration() {
        this.priority = 1;
    }

    public PriceAlteration(String name, PriceAlterationType priceType, BigDecimal price) {
        this();
        this.name = name;
        this.priceType = priceType;
        this.price = price;
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public PriceAlterationType getPriceType() {
        return priceType;
    }

    public void setPriceType(PriceAlterationType priceType) {
        this.priceType = priceType;
    }

    public String getUnitOfMeasure() {
        return unitOfMeasure;
    }

    public void setUnitOfMeasure(String unitOfMeasure) {
        this.unitOfMeasure = unitOfMeasure;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public BigDecimal getPercentage() {
        return percentage;
    }

    public void setPercentage(BigDecimal percentage) {
        this.percentage = percentage;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public ApplicationDuration getApplicationDuration() {
        return applicationDuration;
    }

    public void setApplicationDuration(ApplicationDuration applicationDuration) {
        this.applicationDuration = applicationDuration;
    }

    public RecurringChargePeriod getRecurringChargePeriod() {
        return recurringChargePeriod;
    }

    public void setRecurringChargePeriod(RecurringChargePeriod recurringChargePeriod) {
        this.recurringChargePeriod = recurringChargePeriod;
    }

    public QuoteItemPrice getQuoteItemPrice() {
        return quoteItemPrice;
    }

    public void setQuoteItemPrice(QuoteItemPrice quoteItemPrice) {
        this.quoteItemPrice = quoteItemPrice;
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
        return "PriceAlteration{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", name='" + name + '\'' +
                ", priceType=" + priceType +
                ", price=" + price +
                ", percentage=" + percentage +
                ", priority=" + priority +
                ", createdAt=" + createdAt +
                '}';
    }
}
