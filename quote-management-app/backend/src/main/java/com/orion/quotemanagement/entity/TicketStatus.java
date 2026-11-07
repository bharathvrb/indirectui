package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum TicketStatus {
    OPEN("open"),
    IN_PROGRESS("inProgress"),
    PENDING_CUSTOMER("pendingCustomer"),
    RESOLVED("resolved"),
    CLOSED("closed"),
    CANCELLED("cancelled");

    private final String value;
    TicketStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    public static TicketStatus fromValue(String value) {
        for (TicketStatus s : values()) { if (s.value.equalsIgnoreCase(value)) return s; }
        return null;
    }
}