package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.AttachmentRefOrValue;
import com.orion.quotemanagement.entity.AttachmentStatus;
import com.orion.quotemanagement.entity.AttachmentType;
import com.orion.quotemanagement.repository.AttachmentRepository;
import com.orion.quotemanagement.repository.QuoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

@Service
@Transactional
public class FileStorageService {

    private static final Logger logger = LoggerFactory.getLogger(FileStorageService.class);
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "application/pdf", "application/json", "text/plain", "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel", "image/png", "image/jpeg", "image/gif"
    );
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private final AttachmentRepository attachmentRepository;
    private final QuoteRepository quoteRepository;

    @Value("${app.file-storage.path:./uploads}")
    private String storagePath;

    public FileStorageService(AttachmentRepository attachmentRepository, QuoteRepository quoteRepository) {
        this.attachmentRepository = attachmentRepository;
        this.quoteRepository = quoteRepository;
    }

    public AttachmentRefOrValue storeFile(Long quoteId, MultipartFile file, AttachmentType attachmentType) throws IOException {
        // Validate file
        validateFile(file);

        var quote = quoteRepository.findById(quoteId)
                .orElseThrow(() -> new RuntimeException("Quote not found: " + quoteId));

        // Generate safe filename
        String uuid = UUID.randomUUID().toString();
        String originalFilename = sanitizeFilename(Objects.requireNonNull(file.getOriginalFilename()));
        String storedFilename = uuid + "_" + originalFilename;

        // Determine sub-directory
        Path targetDir = Paths.get(storagePath, "quotes");
        Files.createDirectories(targetDir);
        Path targetPath = targetDir.resolve(storedFilename);

        // Save file
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        // Compute checksum
        String checksum = computeChecksum(file.getBytes());

        // Create attachment record
        AttachmentRefOrValue attachment = new AttachmentRefOrValue();
        attachment.setExternalId(uuid);
        attachment.setName(originalFilename);
        attachment.setAttachmentType(attachmentType);
        attachment.setMimeType(file.getContentType());
        attachment.setSizeBytes(file.getSize());
        attachment.setFilePath(targetPath.toString());
        attachment.setOriginalFilename(originalFilename);
        attachment.setChecksum(checksum);
        attachment.setChecksumAlgorithm("SHA-256");
        attachment.setStatus(AttachmentStatus.UPLOADED);
        attachment.setQuote(quote);

        AttachmentRefOrValue saved = attachmentRepository.save(attachment);
        logger.info("Stored file {} for quote {}", originalFilename, quoteId);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<AttachmentRefOrValue> getAttachmentsForQuote(Long quoteId) {
        return attachmentRepository.findByQuoteId(quoteId);
    }

    public void deleteAttachment(Long attachmentId) throws IOException {
        AttachmentRefOrValue attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));

        if (attachment.getFilePath() != null) {
            Path path = Paths.get(attachment.getFilePath());
            Files.deleteIfExists(path);
        }
        attachment.setStatus(AttachmentStatus.DELETED);
        attachmentRepository.save(attachment);
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) throw new IllegalArgumentException("File is empty");
        if (file.getSize() > MAX_FILE_SIZE) throw new IllegalArgumentException("File exceeds 10MB limit");
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }
    }

    private String sanitizeFilename(String filename) {
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String computeChecksum(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            return "checksum-unavailable";
        }
    }
}