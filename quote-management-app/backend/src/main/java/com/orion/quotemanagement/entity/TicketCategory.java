package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum TicketCategory {
    QUOTE_FAILURE("quoteFailure"),
    PRICING_ERROR("pricingError"),
    PRODUCT_CONFIGURATION("productConfiguration"),
    SYSTEM_ERROR("systemError"),
    DATA_VALIDATION("dataValidation"),
    INTEGRATION_FAILURE("integrationFailure"),
    TIMEOUT("timeout"),
    OTHER("other");

    private final String value;
    TicketCategory(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    public static TicketCategory fromValue(String value) {
        for (TicketCategory c : values()) { if (c.value.equalsIgnoreCase(value)) return c; }
        return null;
    }
}