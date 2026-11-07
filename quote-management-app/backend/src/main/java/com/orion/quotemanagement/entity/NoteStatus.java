package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Note Status
 * Represents the status of notes in the quote lifecycle
 */
public enum NoteStatus {
    
    /**
     * Note is active and visible
     */
    ACTIVE("active"),
    
    /**
     * Note is archived but still accessible
     */
    ARCHIVED("archived"),
    
    /**
     * Note has been deleted or is no longer visible
     */
    DELETED("deleted"),
    
    /**
     * Note is pending review or approval
     */
    PENDING("pending"),
    
    /**
     * Note has been approved
     */
    APPROVED("approved"),
    
    /**
     * Note has been rejected
     */
    REJECTED("rejected"),
    
    /**
     * Note is in draft state
     */
    DRAFT("draft"),
    
    /**
     * Note has been resolved (for action items)
     */
    RESOLVED("resolved");

    private final String value;

    NoteStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to NoteStatus enum
     * @param value String value
     * @return NoteStatus enum or null if not found
     */
    public static NoteStatus fromValue(String value) {
        for (NoteStatus status : NoteStatus.values()) {
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