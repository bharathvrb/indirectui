package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.Quote;
import com.orion.quotemanagement.entity.QuoteState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuoteRepository extends JpaRepository<Quote, Long> {

    Optional<Quote> findByExternalId(String externalId);

    List<Quote> findByState(QuoteState state);

    Page<Quote> findByState(QuoteState state, Pageable pageable);

    Page<Quote> findAll(Pageable pageable);

    @Query("SELECT q FROM Quote q WHERE q.state = :state AND q.quoteDate BETWEEN :from AND :to")
    List<Quote> findByStateAndDateRange(@Param("state") QuoteState state,
                                        @Param("from") OffsetDateTime from,
                                        @Param("to") OffsetDateTime to);

    @Query("SELECT q FROM Quote q WHERE q.quoteDate BETWEEN :from AND :to")
    List<Quote> findByDateRange(@Param("from") OffsetDateTime from,
                                @Param("to") OffsetDateTime to);

    @Query("SELECT q FROM Quote q WHERE " +
           "(:state IS NULL OR q.state = :state) AND " +
           "(:category IS NULL OR q.category = :category)")
    Page<Quote> findByFilters(@Param("state") QuoteState state,
                              @Param("category") String category,
                              Pageable pageable);

    long countByState(QuoteState state);

    boolean existsByExternalId(String externalId);
}