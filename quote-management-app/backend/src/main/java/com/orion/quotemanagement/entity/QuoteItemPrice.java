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
import java.util.ArrayList;
import java.util.List;

/**
 * TMF 648 Quote Item Price entity
 * Represents pricing information for quote items
 */
@Entity
@Table(name = "quote_item_prices", indexes = {
    @Index(name = "idx_quote_item_price_item_id", columnList = "quote_item_id"),
    @Index(name = "idx_quote_item_price_type", columnList = "priceType")
})
public class QuoteItemPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the quote item price
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * Name of the price
     */
    @Column(name = "name", length = 200)
    @Size(max = 200, message = "Price name cannot exceed 200 characters")
    private String name;

    /**
     * Description of the price
     */
    @Column(name = "description", length = 1000)
    @Size(max = 1000, message = "Price description cannot exceed 1000 characters")
    private String description;

    /**
     * Type of price (one-time, recurring, usage, etc.)
     */
    @Column(name = "price_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Price type is required")
    @JsonProperty("priceType")
    private PriceType priceType;

    /**
     * Unit of measure for the price
     */
    @Column(name = "unit_of_measure", length = 50)
    @JsonProperty("unitOfMeasure")
    @Size(max = 50, message = "Unit of measure cannot exceed 50 characters")
    private String unitOfMeasure;

    /**
     * Recurring charge period (for recurring prices)
     */
    @Column(name = "recurring_charge_period", length = 50)
    @Enumerated(EnumType.STRING)
    @JsonProperty("recurringChargePeriod")
    private RecurringChargePeriod recurringChargePeriod;

    /**
     * Price value
     */
    @Column(name = "price", nullable = false, precision = 19, scale = 2)
    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Price must be non-negative")
    private BigDecimal price;

    /**
     * Currency code (ISO 4217)
     */
    @Column(name = "currency", nullable = false, length = 3)
    @NotNull(message = "Currency is required")
    @Size(min = 3, max = 3, message = "Currency must be 3 characters (ISO 4217)")
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be uppercase ISO 4217 code")
    private String currency;

    /**
     * Percentage (for percentage-based prices)
     */
    @Column(name = "percentage", precision = 5, scale = 2)
    @DecimalMin(value = "0.0", inclusive = true, message = "Percentage must be non-negative")
    @DecimalMax(value = "100.0", inclusive = true, message = "Percentage cannot exceed 100")
    private BigDecimal percentage;

    /**
     * Parent quote item (many-to-one relationship)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_item_id", nullable = false)
    @NotNull(message = "Quote item is required")
    @JsonIgnore
    private QuoteItem quoteItem;

    /**
     * Price alterations (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quoteItemPrice", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("priceAlteration")
    private List<PriceAlteration> priceAlterations = new ArrayList<>();

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
    public QuoteItemPrice() {
        this.currency = "USD"; // Default currency
    }

    public QuoteItemPrice(String name, PriceType priceType, BigDecimal price, String currency) {
        this();
        this.name = name;
        this.priceType = priceType;
        this.price = price;
        this.currency = currency;
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

    public PriceType getPriceType() {
        return priceType;
    }

    public void setPriceType(PriceType priceType) {
        this.priceType = priceType;
    }

    public String getUnitOfMeasure() {
        return unitOfMeasure;
    }

    public void setUnitOfMeasure(String unitOfMeasure) {
        this.unitOfMeasure = unitOfMeasure;
    }

    public RecurringChargePeriod getRecurringChargePeriod() {
        return recurringChargePeriod;
    }

    public void setRecurringChargePeriod(RecurringChargePeriod recurringChargePeriod) {
        this.recurringChargePeriod = recurringChargePeriod;
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

    public QuoteItem getQuoteItem() {
        return quoteItem;
    }

    public void setQuoteItem(QuoteItem quoteItem) {
        this.quoteItem = quoteItem;
    }

    public List<PriceAlteration> getPriceAlterations() {
        return priceAlterations;
    }

    public void setPriceAlterations(List<PriceAlteration> priceAlterations) {
        this.priceAlterations = priceAlterations;
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

    // Utility methods
    public void addPriceAlteration(PriceAlteration priceAlteration) {
        priceAlterations.add(priceAlteration);
        priceAlteration.setQuoteItemPrice(this);
    }

    public void removePriceAlteration(PriceAlteration priceAlteration) {
        priceAlterations.remove(priceAlteration);
        priceAlteration.setQuoteItemPrice(null);
    }

    @Override
    public String toString() {
        return "QuoteItemPrice{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", name='" + name + '\'' +
                ", priceType=" + priceType +
                ", price=" + price +
                ", currency='" + currency + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
