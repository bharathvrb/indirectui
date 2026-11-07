package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Recurring Charge Periods
 * Represents the frequency of recurring charges
 */
public enum RecurringChargePeriod {
    
    /**
     * Daily recurring charge
     */
    DAILY("daily"),
    
    /**
     * Weekly recurring charge
     */
    WEEKLY("weekly"),
    
    /**
     * Monthly recurring charge
     */
    MONTHLY("monthly"),
    
    /**
     * Quarterly recurring charge (every 3 months)
     */
    QUARTERLY("quarterly"),
    
    /**
     * Semi-annual recurring charge (every 6 months)
     */
    SEMI_ANNUAL("semiAnnual"),
    
    /**
     * Annual recurring charge (yearly)
     */
    ANNUAL("annual"),
    
    /**
     * Biennial recurring charge (every 2 years)
     */
    BIENNIAL("biennial");

    private final String value;

    RecurringChargePeriod(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to RecurringChargePeriod enum
     * @param value String value
     * @return RecurringChargePeriod enum or null if not found
     */
    public static RecurringChargePeriod fromValue(String value) {
        for (RecurringChargePeriod period : RecurringChargePeriod.values()) {
            if (period.value.equalsIgnoreCase(value)) {
                return period;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}