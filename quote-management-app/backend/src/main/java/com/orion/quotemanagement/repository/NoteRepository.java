package com.orion.quotemanagement.repository;

import com.orion.quotemanagement.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByQuoteIdOrderByDateDesc(Long quoteId);
}