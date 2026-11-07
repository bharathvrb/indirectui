package com.orion.quotemanagement.controller;

import com.orion.quotemanagement.entity.*;
import com.orion.quotemanagement.service.SupportTicketService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Sales Support Ticket REST Controller
 * Manages support tickets for failed quote transactions
 */
@RestController
@RequestMapping("/api/support-tickets")
public class SupportTicketController {

    private final SupportTicketService ticketService;

    public SupportTicketController(SupportTicketService ticketService) {
        this.ticketService = ticketService;
    }

    /**
     * GET /api/support-tickets
     * List all tickets with optional filtering
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> listTickets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority) {

        TicketStatus ts = (status != null) ? TicketStatus.fromValue(status) : null;
        TicketPriority tp = (priority != null) ? TicketPriority.fromValue(priority) : null;

        Page<SupportTicket> ticketPage;
        if (ts != null || tp != null) {
            ticketPage = ticketService.getTicketsByFilters(ts, tp, page, size);
        } else {
            ticketPage = ticketService.getAllTickets(page, size, "createdAt");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("tickets", ticketPage.getContent());
        response.put("totalElements", ticketPage.getTotalElements());
        response.put("totalPages", ticketPage.getTotalPages());
        response.put("currentPage", ticketPage.getNumber());
        response.put("pageSize", ticketPage.getSize());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/support-tickets/{id}
     * Get a specific ticket by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<SupportTicket> getTicket(@PathVariable Long id) {
        return ticketService.getTicketById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/support-tickets
     * Create a new support ticket manually
     */
    @PostMapping
    public ResponseEntity<SupportTicket> createTicket(@Valid @RequestBody SupportTicket ticket) {
        SupportTicket created = ticketService.createTicket(ticket);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * POST /api/support-tickets/quote/{quoteId}
     * Auto-create a ticket from a failed quote
     */
    @PostMapping("/quote/{quoteId}")
    public ResponseEntity<SupportTicket> createTicketForQuote(
            @PathVariable Long quoteId,
            @RequestParam(defaultValue = "Manual ticket creation") String failureReason,
            @RequestParam(defaultValue = "MANUAL") String failureCode) {

        try {
            SupportTicket ticket = ticketService.createTicketForFailedQuote(quoteId, failureReason, failureCode);
            return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * PATCH /api/support-tickets/{id}/status
     * Update ticket status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<SupportTicket> updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String resolution) {

        TicketStatus ts = TicketStatus.fromValue(status);
        if (ts == null) return ResponseEntity.badRequest().build();

        try {
            return ResponseEntity.ok(ticketService.updateTicketStatus(id, ts, resolution));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/support-tickets/{id}/retry
     * Record a retry attempt from a ticket
     */
    @PostMapping("/{id}/retry")
    public ResponseEntity<SupportTicket> retryFromTicket(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(ticketService.retryFromTicket(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/support-tickets/stats
     * Get ticket counts by status
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getTicketStats() {
        Map<String, Long> stats = new HashMap<>();
        for (TicketStatus status : TicketStatus.values()) {
            stats.put(status.getValue(), ticketService.getAllTickets(0, 1, "createdAt")
                    .getTotalElements()); // simplified
        }
        // More accurate count
        stats.clear();
        stats.put("open", ticketService.getTicketsByFilters(TicketStatus.OPEN, null, 0, 1).getTotalElements());
        stats.put("inProgress", ticketService.getTicketsByFilters(TicketStatus.IN_PROGRESS, null, 0, 1).getTotalElements());
        stats.put("resolved", ticketService.getTicketsByFilters(TicketStatus.RESOLVED, null, 0, 1).getTotalElements());
        stats.put("closed", ticketService.getTicketsByFilters(TicketStatus.CLOSED, null, 0, 1).getTotalElements());
        return ResponseEntity.ok(stats);
    }
}