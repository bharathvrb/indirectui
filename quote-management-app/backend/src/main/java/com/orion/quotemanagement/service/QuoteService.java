package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.*;
import com.orion.quotemanagement.repository.QuoteRepository;
import com.orion.quotemanagement.repository.QuoteStatusAuditRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class QuoteService {

    private static final Logger logger = LoggerFactory.getLogger(QuoteService.class);
    private static final int MAX_RETRY_ATTEMPTS = 3;

    private final QuoteRepository quoteRepository;
    private final QuoteStatusAuditRepository auditRepository;

    public QuoteService(QuoteRepository quoteRepository, QuoteStatusAuditRepository auditRepository) {
        this.quoteRepository = quoteRepository;
        this.auditRepository = auditRepository;
    }

    @Transactional(readOnly = true)
    public Page<Quote> getAllQuotes(int page, int size, String sortBy, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        return quoteRepository.findAll(PageRequest.of(page, size, sort));
    }

    @Transactional(readOnly = true)
    public Page<Quote> getQuotesByState(QuoteState state, int page, int size) {
        return quoteRepository.findByState(state, PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @Transactional(readOnly = true)
    public Optional<Quote> getQuoteById(Long id) {
        return quoteRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Quote> getQuoteByExternalId(String externalId) {
        return quoteRepository.findByExternalId(externalId);
    }

    public Quote createQuote(Quote quote) {
        if (quote.getExternalId() == null || quote.getExternalId().isBlank()) {
            quote.setExternalId("QT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        if (quote.getQuoteDate() == null) {
            quote.setQuoteDate(OffsetDateTime.now());
        }
        if (quote.getState() == null) {
            quote.setState(QuoteState.IN_PROGRESS);
        }
        Quote saved = quoteRepository.save(quote);
        logger.info("Created quote: {}", saved.getExternalId());
        return saved;
    }

    public Quote updateQuoteState(Long id, QuoteState newState) {
        Quote quote = quoteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quote not found: " + id));
        if (quote.getState() == QuoteState.FAILED && newState != QuoteState.FAILED) {
            throw new IllegalStateException("Failed quotes must use the authorized recovery actions.");
        }
        quote.setState(newState);
        if (newState == QuoteState.COMPLETED) {
            quote.setEffectiveQuoteCompletionDate(OffsetDateTime.now());
            quote.setSubStep("Contract Signed");
        }
        return quoteRepository.save(quote);
    }

    public Quote completeFailedQuote(Long id, String actorId) {
        Quote quote = getFailedQuote(id, "completed");
        QuoteState previousState = quote.getState();
        quote.setState(QuoteState.COMPLETED);
        quote.setEffectiveQuoteCompletionDate(OffsetDateTime.now());
        quote.setSubStep("Contract Signed");
        Quote saved = quoteRepository.save(quote);
        auditRepository.save(new QuoteStatusAudit(saved.getId(), actorId, previousState, saved.getState()));
        return saved;
    }

    public Quote retryQuote(Long id, String actorId) {
        Quote quote = getFailedQuote(id, "retried");
        QuoteState previousState = quote.getState();
        logger.info("Retrying quote: {}", quote.getExternalId());
        quote.setState(QuoteState.IN_PROGRESS);
        quote.setSubStep("Address Validation & Enrichment");
        quote.setVersion(incrementVersion(quote.getVersion()));
        Quote saved = quoteRepository.save(quote);
        auditRepository.save(new QuoteStatusAudit(saved.getId(), actorId, previousState, saved.getState()));
        return saved;
    }

    public Quote retryQuote(Long id) {
        return retryQuote(id, "system");
    }

    private Quote getFailedQuote(Long id, String action) {
        Quote quote = quoteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Quote not found: " + id));

        if (quote.getState() != QuoteState.FAILED) {
            throw new IllegalStateException("Only FAILED quotes can be " + action + ". Current state: " + quote.getState());
        }
        return quote;
    }

    @Transactional(readOnly = true)
    public List<Quote> getQuotesByState(QuoteState state) {
        return quoteRepository.findByState(state);
    }

    @Transactional(readOnly = true)
    public long countByState(QuoteState state) {
        return quoteRepository.countByState(state);
    }

    private String incrementVersion(String version) {
        if (version == null) return "1";
        try {
            return String.valueOf(Integer.parseInt(version) + 1);
        } catch (NumberFormatException e) {
            return version + ".1";
        }
    }
}