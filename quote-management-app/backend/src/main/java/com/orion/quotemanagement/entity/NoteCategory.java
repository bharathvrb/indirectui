package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Note Categories
 * Represents different categories of notes that can be added to quotes
 */
public enum NoteCategory {
    
    /**
     * General note or comment
     */
    GENERAL("general"),
    
    /**
     * Technical note or specification
     */
    TECHNICAL("technical"),
    
    /**
     * Commercial or pricing related note
     */
    COMMERCIAL("commercial"),
    
    /**
     * Legal or compliance note
     */
    LEGAL("legal"),
    
    /**
     * Customer communication or feedback
     */
    CUSTOMER_COMMUNICATION("customerCommunication"),
    
    /**
     * Internal process or workflow note
     */
    INTERNAL_PROCESS("internalProcess"),
    
    /**
     * Risk or issue identification
     */
    RISK("risk"),
    
    /**
     * Approval or decision note
     */
    APPROVAL("approval"),
    
    /**
     * Change or modification note
     */
    CHANGE("change"),
    
    /**
     * Status update or progress note
     */
    STATUS_UPDATE("statusUpdate"),
    
    /**
     * Quality assurance or review note
     */
    QUALITY_ASSURANCE("qualityAssurance"),
    
    /**
     * Implementation or deployment note
     */
    IMPLEMENTATION("implementation");

    private final String value;

    NoteCategory(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to NoteCategory enum
     * @param value String value
     * @return NoteCategory enum or null if not found
     */
    public static NoteCategory fromValue(String value) {
        for (NoteCategory category : NoteCategory.values()) {
            if (category.value.equalsIgnoreCase(value)) {
                return category;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}