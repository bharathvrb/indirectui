package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonFormat;
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
 * TMF 648 Quote Item entity representing individual items within a quote
 * Compliant with TMF 648 Quote Management API specification
 */
@Entity
@Table(name = "quote_items", indexes = {
    @Index(name = "idx_quote_item_external_id", columnList = "externalId"),
    @Index(name = "idx_quote_item_quote_id", columnList = "quote_id"),
    @Index(name = "idx_quote_item_state", columnList = "state")
})
public class QuoteItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the quote item (TMF 648 compliance)
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * Quote item description
     */
    @Column(name = "description", length = 1000)
    @Size(max = 1000, message = "Description cannot exceed 1000 characters")
    private String description;

    /**
     * Quantity of the quote item
     */
    @Column(name = "quantity", nullable = false)
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity = 1;

    /**
     * Quote item state
     */
    @Column(name = "state", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Quote item state is required")
    private QuoteItemState state;

    /**
     * Action to be performed on the quote item
     */
    @Column(name = "action", length = 50)
    @Enumerated(EnumType.STRING)
    private QuoteItemAction action;

    /**
     * Product offering identifier (TMF 648 compliance)
     */
    @Column(name = "product_offering_id", length = 255)
    @JsonProperty("productOffering")
    private String productOfferingId;

    /**
     * Product offering name
     */
    @Column(name = "product_offering_name", length = 500)
    @JsonProperty("productOfferingName")
    @Size(max = 500, message = "Product offering name cannot exceed 500 characters")
    private String productOfferingName;

    /**
     * Product category
     */
    @Column(name = "product_category", length = 200)
    @JsonProperty("productCategory")
    @Size(max = 200, message = "Product category cannot exceed 200 characters")
    private String productCategory;

    /**
     * Quote item price (excluding taxes and discounts)
     */
    @Column(name = "item_price", precision = 19, scale = 2)
    @JsonProperty("itemPrice")
    @DecimalMin(value = "0.0", inclusive = true, message = "Item price must be non-negative")
    private BigDecimal itemPrice;

    /**
     * Quote item total price (including all alterations)
     */
    @Column(name = "item_total_price", precision = 19, scale = 2)
    @JsonProperty("itemTotalPrice")
    @DecimalMin(value = "0.0", inclusive = true, message = "Item total price must be non-negative")
    private BigDecimal itemTotalPrice;

    /**
     * Requested quote item completion date
     */
    @Column(name = "requested_quote_item_completion_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("requestedQuoteItemCompletionDate")
    private OffsetDateTime requestedQuoteItemCompletionDate;

    /**
     * Expected quote item completion date
     */
    @Column(name = "expected_quote_item_completion_date")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @JsonProperty("expectedQuoteItemCompletionDate")
    private OffsetDateTime expectedQuoteItemCompletionDate;

    /**
     * Quote item terms
     */
    @Column(name = "quote_item_terms", length = 2000)
    @JsonProperty("quoteItemTerms")
    @Size(max = 2000, message = "Quote item terms cannot exceed 2000 characters")
    private String quoteItemTerms;

    /**
     * Quote item authorization code
     */
    @Column(name = "quote_item_authorization_code", length = 100)
    @JsonProperty("quoteItemAuthorizationCode")
    @Size(max = 100, message = "Authorization code cannot exceed 100 characters")
    private String quoteItemAuthorizationCode;

    /**
     * Parent quote (many-to-one relationship)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_id", nullable = false)
    @JsonIgnore
    @NotNull(message = "Quote is required")
    private Quote quote;

    /**
     * Quote item prices (one-to-many relationship)
     */
    @OneToMany(mappedBy = "quoteItem", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonProperty("quoteItemPrice")
    private List<QuoteItemPrice> quoteItemPrices = new ArrayList<>();

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
    public QuoteItem() {
        this.state = QuoteItemState.IN_PROGRESS;
        this.action = QuoteItemAction.ADD;
        this.quantity = 1;
    }

    public QuoteItem(String description, Integer quantity, BigDecimal itemPrice) {
        this();
        this.description = description;
        this.quantity = quantity;
        this.itemPrice = itemPrice;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public QuoteItemState getState() {
        return state;
    }

    public void setState(QuoteItemState state) {
        this.state = state;
    }

    public QuoteItemAction getAction() {
        return action;
    }

    public void setAction(QuoteItemAction action) {
        this.action = action;
    }

    public String getProductOfferingId() {
        return productOfferingId;
    }

    public void setProductOfferingId(String productOfferingId) {
        this.productOfferingId = productOfferingId;
    }

    public String getProductOfferingName() {
        return productOfferingName;
    }

    public void setProductOfferingName(String productOfferingName) {
        this.productOfferingName = productOfferingName;
    }

    public String getProductCategory() {
        return productCategory;
    }

    public void setProductCategory(String productCategory) {
        this.productCategory = productCategory;
    }

    public BigDecimal getItemPrice() {
        return itemPrice;
    }

    public void setItemPrice(BigDecimal itemPrice) {
        this.itemPrice = itemPrice;
    }

    public BigDecimal getItemTotalPrice() {
        return itemTotalPrice;
    }

    public void setItemTotalPrice(BigDecimal itemTotalPrice) {
        this.itemTotalPrice = itemTotalPrice;
    }

    public OffsetDateTime getRequestedQuoteItemCompletionDate() {
        return requestedQuoteItemCompletionDate;
    }

    public void setRequestedQuoteItemCompletionDate(OffsetDateTime requestedQuoteItemCompletionDate) {
        this.requestedQuoteItemCompletionDate = requestedQuoteItemCompletionDate;
    }

    public OffsetDateTime getExpectedQuoteItemCompletionDate() {
        return expectedQuoteItemCompletionDate;
    }

    public void setExpectedQuoteItemCompletionDate(OffsetDateTime expectedQuoteItemCompletionDate) {
        this.expectedQuoteItemCompletionDate = expectedQuoteItemCompletionDate;
    }

    public String getQuoteItemTerms() {
        return quoteItemTerms;
    }

    public void setQuoteItemTerms(String quoteItemTerms) {
        this.quoteItemTerms = quoteItemTerms;
    }

    public String getQuoteItemAuthorizationCode() {
        return quoteItemAuthorizationCode;
    }

    public void setQuoteItemAuthorizationCode(String quoteItemAuthorizationCode) {
        this.quoteItemAuthorizationCode = quoteItemAuthorizationCode;
    }

    public Quote getQuote() {
        return quote;
    }

    public void setQuote(Quote quote) {
        this.quote = quote;
    }

    public List<QuoteItemPrice> getQuoteItemPrices() {
        return quoteItemPrices;
    }

    public void setQuoteItemPrices(List<QuoteItemPrice> quoteItemPrices) {
        this.quoteItemPrices = quoteItemPrices;
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
    public void addQuoteItemPrice(QuoteItemPrice quoteItemPrice) {
        quoteItemPrices.add(quoteItemPrice);
        quoteItemPrice.setQuoteItem(this);
    }

    public void removeQuoteItemPrice(QuoteItemPrice quoteItemPrice) {
        quoteItemPrices.remove(quoteItemPrice);
        quoteItemPrice.setQuoteItem(null);
    }

    @Override
    public String toString() {
        return "QuoteItem{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", description='" + description + '\'' +
                ", quantity=" + quantity +
                ", state=" + state +
                ", itemPrice=" + itemPrice +
                ", createdAt=" + createdAt +
                '}';
    }
}
