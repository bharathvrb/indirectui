package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Price Alteration Types
 * Represents different types of price alterations/modifications
 */
public enum PriceAlterationType {
    
    /**
     * Discount (reduction in price)
     */
    DISCOUNT("discount"),
    
    /**
     * Allowance (included amount or credit)
     */
    ALLOWANCE("allowance"),
    
    /**
     * Charge (additional fee or surcharge)
     */
    CHARGE("charge"),
    
    /**
     * Tax (applicable taxes)
     */
    TAX("tax"),
    
    /**
     * Fee (processing, service, or other fees)
     */
    FEE("fee"),
    
    /**
     * Penalty (charges for violations or late payments)
     */
    PENALTY("penalty"),
    
    /**
     * Bonus (additional credit or reward)
     */
    BONUS("bonus"),
    
    /**
     * Adjustment (general price adjustment)
     */
    ADJUSTMENT("adjustment");

    private final String value;

    PriceAlterationType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to PriceAlterationType enum
     * @param value String value
     * @return PriceAlterationType enum or null if not found
     */
    public static PriceAlterationType fromValue(String value) {
        for (PriceAlterationType type : PriceAlterationType.values()) {
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