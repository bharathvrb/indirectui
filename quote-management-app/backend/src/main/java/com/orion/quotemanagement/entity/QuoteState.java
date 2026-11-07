package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Quote States
 * Represents the possible states of a quote in the telecommunications domain
 */
public enum QuoteState {
    
    /**
     * Quote has been received and acknowledged
     */
    RECEIVED("received"),

    /**
     * Quote is being processed
     */
    IN_PROGRESS("inProgress"),

    /**
     * Quote is pending approval
     */
    PENDING_APPROVAL("pendingApproval"),

    /**
     * Quote has been successfully completed
     */
    COMPLETED("completed"),

    /**
     * Quote processing has failed
     */
    FAILED("failed");

    private final String value;

    QuoteState(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to QuoteState enum
     * @param value String value
     * @return QuoteState enum or null if not found
     */
    public static QuoteState fromValue(String value) {
        for (QuoteState state : QuoteState.values()) {
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