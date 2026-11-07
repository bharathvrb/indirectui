package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Note Priority
 * Represents the priority or importance level of notes
 */
public enum NotePriority {
    
    /**
     * Critical priority - requires immediate attention
     */
    CRITICAL("critical"),
    
    /**
     * High priority - should be addressed soon
     */
    HIGH("high"),
    
    /**
     * Medium priority - normal importance
     */
    MEDIUM("medium"),
    
    /**
     * Low priority - can be addressed later
     */
    LOW("low"),
    
    /**
     * Informational - for reference only
     */
    INFORMATIONAL("informational");

    private final String value;

    NotePriority(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to NotePriority enum
     * @param value String value
     * @return NotePriority enum or null if not found
     */
    public static NotePriority fromValue(String value) {
        for (NotePriority priority : NotePriority.values()) {
            if (priority.value.equalsIgnoreCase(value)) {
                return priority;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}