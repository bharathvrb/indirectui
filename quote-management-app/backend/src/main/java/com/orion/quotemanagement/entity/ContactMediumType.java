package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 632 Contact medium types (Party Management API)
 */
public enum ContactMediumType {

    EMAIL("email"),
    PHONE("phone"),
    MOBILE("mobile"),
    FAX("fax"),
    POSTAL_ADDRESS("postalAddress"),
    SOCIAL_NETWORK("socialNetwork");

    private final String value;

    ContactMediumType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static ContactMediumType fromValue(String value) {
        for (ContactMediumType t : values()) {
            if (t.value.equalsIgnoreCase(value)) return t;
        }
        return null;
    }
}
