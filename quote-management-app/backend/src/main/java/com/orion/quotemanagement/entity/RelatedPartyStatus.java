package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Related Party Status
 * Represents the status of a related party in the quote context
 */
public enum RelatedPartyStatus {
    
    /**
     * Related party is active and available
     */
    ACTIVE("active"),
    
    /**
     * Related party is inactive or unavailable
     */
    INACTIVE("inactive"),
    
    /**
     * Related party is suspended temporarily
     */
    SUSPENDED("suspended"),
    
    /**
     * Related party is pending activation or approval
     */
    PENDING("pending"),
    
    /**
     * Related party has been terminated or removed
     */
    TERMINATED("terminated");

    private final String value;

    RelatedPartyStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to RelatedPartyStatus enum
     * @param value String value
     * @return RelatedPartyStatus enum or null if not found
     */
    public static RelatedPartyStatus fromValue(String value) {
        for (RelatedPartyStatus status : RelatedPartyStatus.values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}