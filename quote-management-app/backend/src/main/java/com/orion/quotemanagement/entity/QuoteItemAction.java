package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Quote Item Actions
 * Represents the actions that can be performed on quote items
 */
public enum QuoteItemAction {
    
    /**
     * Add a new item to the quote
     */
    ADD("add"),
    
    /**
     * Modify an existing item in the quote
     */
    MODIFY("modify"),
    
    /**
     * Delete an item from the quote
     */
    DELETE("delete"),
    
    /**
     * No change to the item
     */
    NO_CHANGE("noChange");

    private final String value;

    QuoteItemAction(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to QuoteItemAction enum
     * @param value String value
     * @return QuoteItemAction enum or null if not found
     */
    public static QuoteItemAction fromValue(String value) {
        for (QuoteItemAction action : QuoteItemAction.values()) {
            if (action.value.equalsIgnoreCase(value)) {
                return action;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}