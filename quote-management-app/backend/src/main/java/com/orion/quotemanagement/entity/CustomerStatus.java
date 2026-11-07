package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 629 Customer status values
 */
public enum CustomerStatus {

    ACTIVE("active"),
    INACTIVE("inactive"),
    PENDING("pending"),
    SUSPENDED("suspended");

    private final String value;

    CustomerStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static CustomerStatus fromValue(String value) {
        for (CustomerStatus s : values()) {
            if (s.value.equalsIgnoreCase(value)) return s;
        }
        return null;
    }
}
