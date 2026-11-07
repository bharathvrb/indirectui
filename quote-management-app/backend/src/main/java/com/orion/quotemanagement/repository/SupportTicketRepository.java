package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.SupportTicket;
import com.orion.quotemanagement.entity.TicketPriority;
import com.orion.quotemanagement.entity.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {

    Optional<SupportTicket> findByTicketNumber(String ticketNumber);

    List<SupportTicket> findByQuoteId(Long quoteId);

    Page<SupportTicket> findByStatus(TicketStatus status, Pageable pageable);

    Page<SupportTicket> findByPriority(TicketPriority priority, Pageable pageable);

    @Query("SELECT t FROM SupportTicket t WHERE " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:priority IS NULL OR t.priority = :priority)")
    Page<SupportTicket> findByFilters(@Param("status") TicketStatus status,
                                      @Param("priority") TicketPriority priority,
                                      Pageable pageable);

    long countByStatus(TicketStatus status);

    boolean existsByTicketNumber(String ticketNumber);
}