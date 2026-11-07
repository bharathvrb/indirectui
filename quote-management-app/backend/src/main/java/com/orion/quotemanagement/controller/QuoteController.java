package com.orion.quotemanagement.controller;

import com.orion.quotemanagement.entity.Quote;
import com.orion.quotemanagement.entity.QuoteState;
import com.orion.quotemanagement.service.QuoteService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * TMF 648 compliant Quote Management REST Controller
 * Base path: /tmf-api/quote/v4
 */
@RestController
@RequestMapping("/tmf-api/quote/v4")
public class QuoteController {

    private static final Logger logger = LoggerFactory.getLogger(QuoteController.class);

    private final QuoteService quoteService;

    public QuoteController(QuoteService quoteService) {
        this.quoteService = quoteService;
    }

    /**
     * GET /tmf-api/quote/v4/quote
     * List quotes with optional filtering, pagination, sorting
     */
    @GetMapping("/quote")
    public ResponseEntity<Map<String, Object>> listQuotes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String state) {

        Page<Quote> quotePage;
        if (state != null && !state.isBlank()) {
            QuoteState qs = QuoteState.fromValue(state);
            if (qs == null) return ResponseEntity.badRequest().build();
            quotePage = quoteService.getQuotesByState(qs, page, size);
        } else {
            quotePage = quoteService.getAllQuotes(page, size, sortBy, sortDir);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("quotes", quotePage.getContent());
        response.put("totalElements", quotePage.getTotalElements());
        response.put("totalPages", quotePage.getTotalPages());
        response.put("currentPage", quotePage.getNumber());
        response.put("pageSize", quotePage.getSize());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /tmf-api/quote/v4/quote/{id}
     * Retrieve a specific quote by internal ID
     */
    @GetMapping("/quote/{id}")
    public ResponseEntity<Quote> getQuote(@PathVariable Long id) {
        return quoteService.getQuoteById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /tmf-api/quote/v4/quote
     * Create a new quote
     */
    @PostMapping("/quote")
    public ResponseEntity<Quote> createQuote(@Valid @RequestBody Quote quote) {
        Quote created = quoteService.createQuote(quote);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * PATCH /tmf-api/quote/v4/quote/{id}/state
     * Update quote state
     */
    @PatchMapping("/quote/{id}/state")
    @PreAuthorize("@quoteUpdateAuthorization.canUpdate(authentication)")
    public ResponseEntity<Quote> updateQuoteState(
            @PathVariable Long id,
            @RequestParam String state) {

        QuoteState qs = QuoteState.fromValue(state);
        if (qs == null) return ResponseEntity.badRequest().build();

        try {
            Quote updated = quoteService.updateQuoteState(id, qs);
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-Error-Message", e.getMessage()).build();
        } catch (RuntimeException e) {
            logger.error("Failed to complete quote {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/quote/{id}/complete")
    @PreAuthorize("@quoteUpdateAuthorization.canUpdate(authentication)")
    public ResponseEntity<Quote> completeQuote(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(quoteService.completeFailedQuote(id, currentActorId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-Error-Message", e.getMessage()).build();
        } catch (RuntimeException e) {
            logger.error("Failed to retry quote {}", id, e);
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /tmf-api/quote/v4/quote/{id}/retry
     * Retry a failed quote - TMF 648 extension for Sales Platform
     */
    @PostMapping("/quote/{id}/retry")
    @PreAuthorize("@quoteUpdateAuthorization.canUpdate(authentication)")
    public ResponseEntity<Quote> retryQuote(@PathVariable Long id) {
        try {
            Quote retried = quoteService.retryQuote(id, currentActorId());
            return ResponseEntity.ok(retried);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .header("X-Error-Message", e.getMessage()).build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /tmf-api/quote/v4/quote/stats
     * Get quote counts by state (Sales Platform extension)
     */
    @GetMapping("/quote/stats")
    public ResponseEntity<Map<String, Long>> getQuoteStats() {
        Map<String, Long> stats = new HashMap<>();
        for (QuoteState state : QuoteState.values()) {
            stats.put(state.getValue(), quoteService.countByState(state));
        }
        return ResponseEntity.ok(stats);
    }

    private String currentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? "unknown" : authentication.getName();
    }
}