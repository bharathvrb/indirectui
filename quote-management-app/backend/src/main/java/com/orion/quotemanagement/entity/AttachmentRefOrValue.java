package com.orion.quotemanagement.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

/**
 * TMF 648 AttachmentRefOrValue entity for file management
 * Represents file attachments associated with quotes
 * Supports both file references and embedded content
 */
@Entity
@Table(name = "attachments", indexes = {
    @Index(name = "idx_attachment_external_id", columnList = "externalId"),
    @Index(name = "idx_attachment_quote_id", columnList = "quote_id"),
    @Index(name = "idx_attachment_type", columnList = "attachmentType"),
    @Index(name = "idx_attachment_mime_type", columnList = "mimeType")
})
public class AttachmentRefOrValue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the attachment (TMF 648 compliance)
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * A URL to the attachment
     */
    @Column(name = "href", length = 1000)
    private String href;

    /**
     * Type of attachment
     */
    @Column(name = "attachment_type", nullable = false, length = 100)
    @Enumerated(EnumType.STRING)
    @NotNull(message = "Attachment type is required")
    @JsonProperty("attachmentType")
    private AttachmentType attachmentType;

    /**
     * Name of the attachment
     */
    @Column(name = "name", length = 500)
    @Size(max = 500, message = "Attachment name cannot exceed 500 characters")
    private String name;

    /**
     * Description of the attachment
     */
    @Column(name = "description", length = 1000)
    @Size(max = 1000, message = "Attachment description cannot exceed 1000 characters")
    private String description;

    /**
     * MIME type of the attachment
     */
    @Column(name = "mime_type", length = 100)
    @JsonProperty("mimeType")
    @Size(max = 100, message = "MIME type cannot exceed 100 characters")
    private String mimeType;

    /**
     * Size of the attachment in bytes
     */
    @Column(name = "size_bytes")
    @JsonProperty("size")
    @Min(value = 0, message = "Size must be non-negative")
    private Long sizeBytes;

    /**
     * URL or path where the attachment is stored
     */
    @Column(name = "url", length = 2000)
    @Size(max = 2000, message = "URL cannot exceed 2000 characters")
    private String url;

    /**
     * File path on the server (for internal use)
     */
    @Column(name = "file_path", length = 1000)
    @JsonProperty("filePath")
    @Size(max = 1000, message = "File path cannot exceed 1000 characters")
    private String filePath;

    /**
     * Original filename when uploaded
     */
    @Column(name = "original_filename", length = 500)
    @JsonProperty("originalFilename")
    @Size(max = 500, message = "Original filename cannot exceed 500 characters")
    private String originalFilename;

    /**
     * Content (for small embedded attachments - use carefully due to size)
     * Note: For large files, use file path/URL instead
     */
    @Lob
    @Column(name = "content")
    private byte[] content;

    /**
     * Checksum for file integrity verification
     */
    @Column(name = "checksum", length = 64)
    @Size(max = 64, message = "Checksum cannot exceed 64 characters")
    private String checksum;

    /**
     * Checksum algorithm used (MD5, SHA-256, etc.)
     */
    @Column(name = "checksum_algorithm", length = 20)
    @JsonProperty("checksumAlgorithm")
    @Size(max = 20, message = "Checksum algorithm cannot exceed 20 characters")
    private String checksumAlgorithm;

    /**
     * Attachment status
     */
    @Column(name = "status", length = 50)
    @Enumerated(EnumType.STRING)
    private AttachmentStatus status;

    /**
     * Parent quote (many-to-one relationship)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quote_id", nullable = false)
    @NotNull(message = "Quote is required")
    @JsonIgnore
    private Quote quote;

    /**
     * Creation timestamp
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime createdAt;

    /**
     * Last update timestamp
     */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    private OffsetDateTime updatedAt;

    // Constructors
    public AttachmentRefOrValue() {
        this.status = AttachmentStatus.UPLOADED;
    }

    public AttachmentRefOrValue(String name, AttachmentType attachmentType, String mimeType) {
        this();
        this.name = name;
        this.attachmentType = attachmentType;
        this.mimeType = mimeType;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public String getHref() {
        return href;
    }

    public void setHref(String href) {
        this.href = href;
    }

    public AttachmentType getAttachmentType() {
        return attachmentType;
    }

    public void setAttachmentType(AttachmentType attachmentType) {
        this.attachmentType = attachmentType;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public byte[] getContent() {
        return content;
    }

    public void setContent(byte[] content) {
        this.content = content;
    }

    public String getChecksum() {
        return checksum;
    }

    public void setChecksum(String checksum) {
        this.checksum = checksum;
    }

    public String getChecksumAlgorithm() {
        return checksumAlgorithm;
    }

    public void setChecksumAlgorithm(String checksumAlgorithm) {
        this.checksumAlgorithm = checksumAlgorithm;
    }

    public AttachmentStatus getStatus() {
        return status;
    }

    public void setStatus(AttachmentStatus status) {
        this.status = status;
    }

    public Quote getQuote() {
        return quote;
    }

    public void setQuote(Quote quote) {
        this.quote = quote;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Utility methods
    
    /**
     * Check if attachment is stored as file (has file path)
     */
    public boolean isFileAttachment() {
        return filePath != null && !filePath.isEmpty();
    }

    /**
     * Check if attachment is embedded content
     */
    public boolean isEmbeddedAttachment() {
        return content != null && content.length > 0;
    }

    /**
     * Get human-readable file size
     */
    public String getFormattedSize() {
        if (sizeBytes == null) return "Unknown";
        
        if (sizeBytes < 1024) return sizeBytes + " B";
        if (sizeBytes < 1024 * 1024) return String.format("%.1f KB", sizeBytes / 1024.0);
        if (sizeBytes < 1024 * 1024 * 1024) return String.format("%.1f MB", sizeBytes / (1024.0 * 1024.0));
        return String.format("%.1f GB", sizeBytes / (1024.0 * 1024.0 * 1024.0));
    }

    @Override
    public String toString() {
        return "AttachmentRefOrValue{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", name='" + name + '\'' +
                ", attachmentType=" + attachmentType +
                ", mimeType='" + mimeType + '\'' +
                ", sizeBytes=" + sizeBytes +
                ", status=" + status +
                ", createdAt=" + createdAt +
                '}';
    }
}
