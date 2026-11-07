package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Related Party Roles
 * Represents the roles that parties can have in relation to a quote
 */
public enum RelatedPartyRole {
    
    /**
     * Customer requesting the quote
     */
    CUSTOMER("customer"),
    
    /**
     * Sales representative handling the quote
     */
    SALES_AGENT("salesAgent"),
    
    /**
     * Partner organization involved in fulfillment
     */
    PARTNER("partner"),
    
    /**
     * Supplier providing products or services
     */
    SUPPLIER("supplier"),
    
    /**
     * Billing contact for the organization
     */
    BILLING_CONTACT("billingContact"),
    
    /**
     * Technical contact for implementation
     */
    TECHNICAL_CONTACT("technicalContact"),
    
    /**
     * Account manager for the customer
     */
    ACCOUNT_MANAGER("accountManager"),
    
    /**
     * Sponsor or approver within customer organization
     */
    SPONSOR("sponsor"),
    
    /**
     * Stakeholder involved in the quote process
     */
    STAKEHOLDER("stakeholder");

    private final String value;

    RelatedPartyRole(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to RelatedPartyRole enum
     * @param value String value
     * @return RelatedPartyRole enum or null if not found
     */
    public static RelatedPartyRole fromValue(String value) {
        for (RelatedPartyRole role : RelatedPartyRole.values()) {
            if (role.value.equalsIgnoreCase(value)) {
                return role;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}