package com.orion.quotemanagement.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * H2 Database Configuration for Quote Management Application
 * Sets up in-memory database for development and testing
 */
@Configuration
@Profile({"dev", "test"})
public class H2Config {

    private static final Logger logger = LoggerFactory.getLogger(H2Config.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Initialize database schema and sample data on application startup
     */
    @EventListener(ApplicationReadyEvent.class)
    public void initializeDatabase() {
        logger.info("Initializing H2 database for Quote Management Application");
        
        try {
            // Create additional indexes for performance
            createIndexes();
            
            logger.info("H2 database initialization completed successfully");
            logger.info("H2 Console available at: /h2-console");
            logger.info("JDBC URL: jdbc:h2:mem:quotedb");
            logger.info("Username: sa");
            
        } catch (Exception e) {
            logger.error("Error initializing H2 database", e);
        }
    }

    /**
     * Create database indexes for better query performance
     */
    private void createIndexes() {
        try {
            // Note: Actual table creation will be handled by JPA/Hibernate
            // This method will be populated once entities are created
            
            logger.debug("Database indexes will be created after entity initialization");
            
        } catch (Exception e) {
            logger.warn("Could not create database indexes: {}", e.getMessage());
        }
    }
}