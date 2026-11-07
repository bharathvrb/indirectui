package com.orion.quotemanagement.controller;

import com.orion.quotemanagement.entity.AttachmentRefOrValue;
import com.orion.quotemanagement.entity.AttachmentType;
import com.orion.quotemanagement.service.FileStorageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

/**
 * File Management REST Controller
 * Handles upload, retrieval and deletion of quote attachments
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    /**
     * POST /api/files/quote/{quoteId}
     * Upload a file attachment for a quote
     */
    @PostMapping("/quote/{quoteId}")
    public ResponseEntity<AttachmentRefOrValue> uploadFile(
            @PathVariable Long quoteId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "QUOTE_DOCUMENT") String attachmentType) {

        AttachmentType type;
        try {
            type = AttachmentType.fromValue(attachmentType);
            if (type == null) type = AttachmentType.QUOTE_DOCUMENT;
        } catch (Exception e) {
            type = AttachmentType.QUOTE_DOCUMENT;
        }

        try {
            AttachmentRefOrValue saved = fileStorageService.storeFile(quoteId, file, type);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * GET /api/files/quote/{quoteId}
     * List all attachments for a quote
     */
    @GetMapping("/quote/{quoteId}")
    public ResponseEntity<List<AttachmentRefOrValue>> listFiles(@PathVariable Long quoteId) {
        return ResponseEntity.ok(fileStorageService.getAttachmentsForQuote(quoteId));
    }

    /**
     * GET /api/files/{attachmentId}/download
     * Download a specific attachment
     */
    @GetMapping("/{attachmentId}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long attachmentId) {
        // Retrieve the attachment metadata
        List<AttachmentRefOrValue> all = fileStorageService.getAttachmentsForQuote(0L); // placeholder
        return ResponseEntity.notFound().build(); // Simplified - full impl would look up by ID
    }

    /**
     * DELETE /api/files/{attachmentId}
     * Delete an attachment
     */
    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<Void> deleteFile(@PathVariable Long attachmentId) {
        try {
            fileStorageService.deleteAttachment(attachmentId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException | IOException e) {
            return ResponseEntity.notFound().build();
        }
    }
}