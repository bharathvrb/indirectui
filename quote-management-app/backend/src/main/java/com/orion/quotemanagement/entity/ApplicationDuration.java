package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Application Duration
 * Represents the duration for which a price alteration applies
 */
public enum ApplicationDuration {
    
    /**
     * One-time application
     */
    ONCE("once"),
    
    /**
     * Temporary application for a specific period
     */
    TEMPORARY("temporary"),
    
    /**
     * Recurring application (continues periodically)
     */
    RECURRING("recurring"),
    
    /**
     * Permanent application (ongoing)
     */
    PERMANENT("permanent"),
    
    /**
     * Until a specific condition is met
     */
    CONDITIONAL("conditional"),
    
    /**
     * For the duration of the contract
     */
    CONTRACT_DURATION("contractDuration"),
    
    /**
     * For a promotional period
     */
    PROMOTIONAL("promotional");

    private final String value;

    ApplicationDuration(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to ApplicationDuration enum
     * @param value String value
     * @return ApplicationDuration enum or null if not found
     */
    public static ApplicationDuration fromValue(String value) {
        for (ApplicationDuration duration : ApplicationDuration.values()) {
            if (duration.value.equalsIgnoreCase(value)) {
                return duration;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}