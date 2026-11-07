package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TMF 648 compliant Attachment Status
 * Represents the status of file attachments
 */
public enum AttachmentStatus {
    
    /**
     * Attachment has been successfully uploaded
     */
    UPLOADED("uploaded"),
    
    /**
     * Attachment is currently being processed/uploaded
     */
    PROCESSING("processing"),
    
    /**
     * Attachment processing failed
     */
    FAILED("failed"),
    
    /**
     * Attachment has been validated and approved
     */
    VALIDATED("validated"),
    
    /**
     * Attachment has been rejected or is invalid
     */
    REJECTED("rejected"),
    
    /**
     * Attachment has been archived
     */
    ARCHIVED("archived"),
    
    /**
     * Attachment has been deleted
     */
    DELETED("deleted"),
    
    /**
     * Attachment is corrupted or cannot be accessed
     */
    CORRUPTED("corrupted"),
    
    /**
     * Attachment is pending review or approval
     */
    PENDING("pending");

    private final String value;

    AttachmentStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Convert string value to AttachmentStatus enum
     * @param value String value
     * @return AttachmentStatus enum or null if not found
     */
    public static AttachmentStatus fromValue(String value) {
        for (AttachmentStatus status : AttachmentStatus.values()) {
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