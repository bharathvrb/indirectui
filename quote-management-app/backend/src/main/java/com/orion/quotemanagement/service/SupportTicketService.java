package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.*;
import com.orion.quotemanagement.repository.QuoteRepository;
import com.orion.quotemanagement.repository.SupportTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class SupportTicketService {

    private static final Logger logger = LoggerFactory.getLogger(SupportTicketService.class);
    private final AtomicLong ticketCounter = new AtomicLong(1000);

    private final SupportTicketRepository ticketRepository;
    private final QuoteRepository quoteRepository;

    public SupportTicketService(SupportTicketRepository ticketRepository, QuoteRepository quoteRepository) {
        this.ticketRepository = ticketRepository;
        this.quoteRepository = quoteRepository;
    }

    @Transactional(readOnly = true)
    public Page<SupportTicket> getAllTickets(int page, int size, String sortBy) {
        return ticketRepository.findAll(PageRequest.of(page, size, Sort.by(sortBy).descending()));
    }

    @Transactional(readOnly = true)
    public Page<SupportTicket> getTicketsByFilters(TicketStatus status, TicketPriority priority, int page, int size) {
        return ticketRepository.findByFilters(status, priority, PageRequest.of(page, size, Sort.by("createdAt").descending()));
    }

    @Transactional(readOnly = true)
    public Optional<SupportTicket> getTicketById(Long id) {
        return ticketRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<SupportTicket> getTicketByNumber(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber);
    }

    public SupportTicket createTicketForFailedQuote(Long quoteId, String failureReason, String failureCode) {
        Quote quote = quoteRepository.findById(quoteId)
                .orElseThrow(() -> new RuntimeException("Quote not found: " + quoteId));

        SupportTicket ticket = new SupportTicket();
        ticket.setTicketNumber(generateTicketNumber());
        ticket.setTitle("Quote Processing Failure: " + quote.getExternalId());
        ticket.setDescription("Automatic ticket created for failed quote processing. " +
                "Quote ID: " + quote.getExternalId() + ". Failure: " + failureReason);
        ticket.setFailureReason(failureReason);
        ticket.setFailureCode(failureCode);
        ticket.setCategory(TicketCategory.QUOTE_FAILURE);
        ticket.setPriority(TicketPriority.HIGH);
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setQuote(quote);
        ticket.setDueDate(OffsetDateTime.now().plusDays(2));

        SupportTicket saved = ticketRepository.save(ticket);
        logger.info("Created support ticket {} for failed quote {}", saved.getTicketNumber(), quote.getExternalId());
        return saved;
    }

    public SupportTicket createTicket(SupportTicket ticket) {
        if (ticket.getTicketNumber() == null || ticket.getTicketNumber().isBlank()) {
            ticket.setTicketNumber(generateTicketNumber());
        }
        return ticketRepository.save(ticket);
    }

    public SupportTicket updateTicketStatus(Long id, TicketStatus newStatus, String resolution) {
        SupportTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found: " + id));
        ticket.setStatus(newStatus);
        if (resolution != null && !resolution.isBlank()) {
            ticket.setResolution(resolution);
        }
        if (newStatus == TicketStatus.RESOLVED || newStatus == TicketStatus.CLOSED) {
            ticket.setResolvedAt(OffsetDateTime.now());
        }
        return ticketRepository.save(ticket);
    }

    public SupportTicket retryFromTicket(Long ticketId) {
        SupportTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        ticket.incrementRetryCount();
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        return ticketRepository.save(ticket);
    }

    private String generateTicketNumber() {
        return "TKT-" + String.format("%06d", ticketCounter.getAndIncrement());
    }
}