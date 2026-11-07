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
 * TMF 648 Note entity for quote annotations
 * Represents notes and comments associated with quotes
 * Provides audit trail and communication history
 */
@Entity
@Table(name = "notes", indexes = {
    @Index(name = "idx_note_external_id", columnList = "externalId"),
    @Index(name = "idx_note_quote_id", columnList = "quote_id"),
    @Index(name = "idx_note_author", columnList = "author"),
    @Index(name = "idx_note_date", columnList = "date")
})
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * External ID for the note (TMF 648 compliance)
     */
    @Column(name = "external_id", length = 255)
    @JsonProperty("externalId")
    private String externalId;

    /**
     * Author of the note (organization/role identifier, NO PII)
     */
    @Column(name = "author", nullable = false, length = 200)
    @NotNull(message = "Note author is required")
    @Size(max = 200, message = "Author cannot exceed 200 characters")
    private String author;

    /**
     * Date when the note was created
     */
    @Column(name = "date", nullable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
    @NotNull(message = "Note date is required")
    private OffsetDateTime date;

    /**
     * Text content of the note
     */
    @Column(name = "text", nullable = false, length = 4000)
    @NotNull(message = "Note text is required")
    @Size(min = 1, max = 4000, message = "Note text must be between 1 and 4000 characters")
    private String text;

    /**
     * System or application that created the note
     */
    @Column(name = "system", length = 100)
    @Size(max = 100, message = "System cannot exceed 100 characters")
    private String system;

    /**
     * Category of the note
     */
    @Column(name = "category", length = 100)
    @Enumerated(EnumType.STRING)
    private NoteCategory category;

    /**
     * Priority or importance level of the note
     */
    @Column(name = "priority", length = 50)
    @Enumerated(EnumType.STRING)
    private NotePriority priority;

    /**
     * Status of the note
     */
    @Column(name = "status", length = 50)
    @Enumerated(EnumType.STRING)
    private NoteStatus status;

    /**
     * Tags associated with the note (comma-separated)
     */
    @Column(name = "tags", length = 500)
    @Size(max = 500, message = "Tags cannot exceed 500 characters")
    private String tags;

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
    public Note() {
        this.date = OffsetDateTime.now();
        this.category = NoteCategory.GENERAL;
        this.priority = NotePriority.MEDIUM;
        this.status = NoteStatus.ACTIVE;
    }

    public Note(String author, String text) {
        this();
        this.author = author;
        this.text = text;
    }

    public Note(String author, String text, NoteCategory category) {
        this(author, text);
        this.category = category;
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

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        // Validation: Ensure no PII in author field
        if (author != null && (author.contains("@") || 
            author.matches(".*\\b(Mr\\.|Mrs\\.|Ms\\.|Dr\\.)\\b.*"))) {
            throw new IllegalArgumentException("Individual names or personal identifiers not allowed - use organization/role identifiers only");
        }
        this.author = author;
    }

    public OffsetDateTime getDate() {
        return date;
    }

    public void setDate(OffsetDateTime date) {
        this.date = date;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getSystem() {
        return system;
    }

    public void setSystem(String system) {
        this.system = system;
    }

    public NoteCategory getCategory() {
        return category;
    }

    public void setCategory(NoteCategory category) {
        this.category = category;
    }

    public NotePriority getPriority() {
        return priority;
    }

    public void setPriority(NotePriority priority) {
        this.priority = priority;
    }

    public NoteStatus getStatus() {
        return status;
    }

    public void setStatus(NoteStatus status) {
        this.status = status;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
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
     * Add a tag to the note
     */
    public void addTag(String tag) {
        if (tag == null || tag.trim().isEmpty()) return;
        
        if (this.tags == null || this.tags.isEmpty()) {
            this.tags = tag.trim();
        } else {
            this.tags += "," + tag.trim();
        }
    }

    /**
     * Remove a tag from the note
     */
    public void removeTag(String tag) {
        if (this.tags == null || tag == null) return;
        
        String[] tagArray = this.tags.split(",");
        StringBuilder newTags = new StringBuilder();
        
        for (String t : tagArray) {
            if (!t.trim().equals(tag.trim())) {
                if (newTags.length() > 0) newTags.append(",");
                newTags.append(t.trim());
            }
        }
        
        this.tags = newTags.toString();
    }

    /**
     * Check if note has a specific tag
     */
    public boolean hasTag(String tag) {
        if (this.tags == null || tag == null) return false;
        
        String[] tagArray = this.tags.split(",");
        for (String t : tagArray) {
            if (t.trim().equals(tag.trim())) {
                return true;
            }
        }
        return false;
    }

    @Override
    public String toString() {
        return "Note{" +
                "id=" + id +
                ", externalId='" + externalId + '\'' +
                ", author='" + author + '\'' +
                ", date=" + date +
                ", text='" + (text != null && text.length() > 50 ? text.substring(0, 50) + "..." : text) + '\'' +
                ", category=" + category +
                ", priority=" + priority +
                ", status=" + status +
                ", createdAt=" + createdAt +
                '}';
    }
}
