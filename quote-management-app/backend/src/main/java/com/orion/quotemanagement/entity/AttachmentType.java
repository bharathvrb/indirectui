package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Attachment Types
 * Represents different types of attachments that can be associated with quotes
 */
public enum AttachmentType {
    
    /**
     * Quote definition document (PDF, Word, etc.)
     */
    QUOTE_DOCUMENT("quoteDocument"),
    
    /**
     * Product specification document
     */
    PRODUCT_SPECIFICATION("productSpecification"),
    
    /**
     * Technical requirements document
     */
    TECHNICAL_REQUIREMENTS("technicalRequirements"),
    
    /**
     * Terms and conditions document
     */
    TERMS_AND_CONDITIONS("termsAndConditions"),
    
    /**
     * Pricing sheet or breakdown
     */
    PRICING_SHEET("pricingSheet"),
    
    /**
     * Configuration file (JSON, XML, etc.)
     */
    CONFIGURATION_FILE("configurationFile"),
    
    /**
     * Customer requirements document
     */
    CUSTOMER_REQUIREMENTS("customerRequirements"),
    
    /**
     * Proposal document
     */
    PROPOSAL_DOCUMENT("proposalDocument"),
    
    /**
     * Supporting documentation
     */
    SUPPORTING_DOCUMENT("supportingDocument"),
    
    /**
     * Legal agreement or contract
     */
    LEGAL_DOCUMENT("legalDocument"),
    
    /**
     * Image file (diagrams, screenshots, etc.)
     */
    IMAGE("image"),
    
    /**
     * Spreadsheet (Excel, CSV, etc.)
     */
    SPREADSHEET("spreadsheet"),
    
    /**
     * Other miscellaneous attachment
     */
    OTHER("other");

    private final String value;

    AttachmentType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to AttachmentType enum
     * @param value String value
     * @return AttachmentType enum or null if not found
     */
    public static AttachmentType fromValue(String value) {
        for (AttachmentType type : AttachmentType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return value;
    }
}