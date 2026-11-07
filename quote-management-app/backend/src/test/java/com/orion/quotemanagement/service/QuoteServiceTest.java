package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.Quote;
import com.orion.quotemanagement.entity.QuoteState;
import com.orion.quotemanagement.entity.QuoteStatusAudit;
import com.orion.quotemanagement.repository.QuoteRepository;
import com.orion.quotemanagement.repository.QuoteStatusAuditRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuoteServiceTest {

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private QuoteStatusAuditRepository auditRepository;

    private QuoteService quoteService;

    @BeforeEach
    void setUp() {
        quoteService = new QuoteService(quoteRepository, auditRepository);
    }

    @Test
    void completeFailedQuoteUpdatesStateAndAuditsActorAndTransition() {
        Quote quote = quote(QuoteState.FAILED);
        when(quoteRepository.findById(42L)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quote completed = quoteService.completeFailedQuote(42L, "sales-user-17");

        assertEquals(QuoteState.COMPLETED, completed.getState());
        assertEquals("Contract Signed", completed.getSubStep());
        assertNotNull(completed.getEffectiveQuoteCompletionDate());
        ArgumentCaptor<QuoteStatusAudit> auditCaptor = ArgumentCaptor.forClass(QuoteStatusAudit.class);
        verify(auditRepository).save(auditCaptor.capture());
        QuoteStatusAudit audit = auditCaptor.getValue();
        assertEquals(42L, audit.getQuoteId());
        assertEquals("sales-user-17", audit.getActorId());
        assertEquals(QuoteState.FAILED, audit.getPreviousStatus());
        assertEquals(QuoteState.COMPLETED, audit.getUpdatedStatus());
        assertNotNull(audit.getTimestamp());
    }

    @Test
    void retryFailedQuoteResumesProcessingAndAuditsTransition() {
        Quote quote = quote(QuoteState.FAILED);
        quote.setVersion("2");
        when(quoteRepository.findById(42L)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quote retried = quoteService.retryQuote(42L, "sales-user-17");

        assertEquals(QuoteState.IN_PROGRESS, retried.getState());
        assertEquals("Address Validation & Enrichment", retried.getSubStep());
        assertEquals("3", retried.getVersion());
        ArgumentCaptor<QuoteStatusAudit> auditCaptor = ArgumentCaptor.forClass(QuoteStatusAudit.class);
        verify(auditRepository).save(auditCaptor.capture());
        assertEquals(QuoteState.FAILED, auditCaptor.getValue().getPreviousStatus());
        assertEquals(QuoteState.IN_PROGRESS, auditCaptor.getValue().getUpdatedStatus());
    }

    @Test
    void recoveryRejectsQuotesThatAreNotFailedWithoutWritingAudit() {
        when(quoteRepository.findById(42L)).thenReturn(Optional.of(quote(QuoteState.COMPLETED)));

        assertThrows(IllegalStateException.class, () -> quoteService.completeFailedQuote(42L, "sales-user-17"));
        assertThrows(IllegalStateException.class, () -> quoteService.retryQuote(42L, "sales-user-17"));

        verify(auditRepository, never()).save(any(QuoteStatusAudit.class));
    }

    @Test
    void completedStateUpdateSetsContractSignedSubStatus() {
        Quote quote = quote(QuoteState.IN_PROGRESS);
        when(quoteRepository.findById(42L)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quote completed = quoteService.updateQuoteState(42L, QuoteState.COMPLETED);

        assertEquals(QuoteState.COMPLETED, completed.getState());
        assertEquals("Contract Signed", completed.getSubStep());
    }

    @Test
    void contractSignedIsNotAQuoteState() {
        assertNull(QuoteState.fromValue("contractSigned"));
    }

    private Quote quote(QuoteState state) {
        Quote quote = new Quote();
        quote.setId(42L);
        quote.setExternalId("PARTNER-QUOTE-TEST");
        quote.setState(state);
        return quote;
    }
}