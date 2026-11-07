package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Price Types
 * Represents different types of pricing for quote items
 */
public enum PriceType {
    
    /**
     * One-time price (setup fees, installation, etc.)
     */
    ONE_TIME("oneTime"),
    
    /**
     * Recurring price (monthly, yearly subscriptions, etc.)
     */
    RECURRING("recurring"),
    
    /**
     * Usage-based price (pay-per-use, consumption-based)
     */
    USAGE("usage"),
    
    /**
     * Allowance-based price (includes certain amount of usage)
     */
    ALLOWANCE("allowance"),
    
    /**
     * Tariff price (standard rate pricing)
     */
    TARIFF("tariff"),
    
    /**
     * Discount price (reductions from base price)
     */
    DISCOUNT("discount"),
    
    /**
     * Penalty price (charges for violations or overages)
     */
    PENALTY("penalty");

    private final String value;

    PriceType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to PriceType enum
     * @param value String value
     * @return PriceType enum or null if not found
     */
    public static PriceType fromValue(String value) {
        for (PriceType type : PriceType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}