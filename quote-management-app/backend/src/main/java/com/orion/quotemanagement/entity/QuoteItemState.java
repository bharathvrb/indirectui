package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Quote Item States
 * Represents the possible states of a quote item
 */
public enum QuoteItemState {
    
    /**
     * Quote item is being processed
     */
    IN_PROGRESS("inProgress"),
    
    /**
     * Quote item has been successfully completed
     */
    COMPLETED("completed"),
    
    /**
     * Quote item processing has failed
     */
    FAILED("failed"),
    
    /**
     * Quote item has been rejected
     */
    REJECTED("rejected"),
    
    /**
     * Quote item has been accepted
     */
    ACCEPTED("accepted"),
    
    /**
     * Quote item is pending review
     */
    PENDING("pending"),
    
    /**
     * Quote item is cancelled
     */
    CANCELLED("cancelled");

    private final String value;

    QuoteItemState(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to QuoteItemState enum
     * @param value String value
     * @return QuoteItemState enum or null if not found
     */
    public static QuoteItemState fromValue(String value) {
        for (QuoteItemState state : QuoteItemState.values()) {
            if (state.value.equalsIgnoreCase(value)) {
                return state;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}