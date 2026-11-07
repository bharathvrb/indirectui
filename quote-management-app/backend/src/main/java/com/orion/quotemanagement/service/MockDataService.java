package com.orion.quotemanagement.service;

import com.orion.quotemanagement.entity.*;
import com.orion.quotemanagement.repository.CustomerRepository;
import com.orion.quotemanagement.repository.QuoteRepository;
import com.orion.quotemanagement.repository.SupportTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Mock Data Generator Service
 * Generates TMF 648 compliant seed data for development/testing
 */
@Service
public class MockDataService {

    private static final Logger logger = LoggerFactory.getLogger(MockDataService.class);
    private final AtomicInteger ticketSeq = new AtomicInteger(1001);

    private final QuoteRepository quoteRepository;
    private final SupportTicketRepository ticketRepository;
    private final CustomerRepository customerRepository;

    public MockDataService(QuoteRepository quoteRepository, SupportTicketRepository ticketRepository,
                           CustomerRepository customerRepository) {
        this.quoteRepository = quoteRepository;
        this.ticketRepository = ticketRepository;
        this.customerRepository = customerRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void generateMockData() {
        if (quoteRepository.count() > 0) {
            logger.info("Mock data already exists, skipping generation");
            return;
        }

        logger.info("Generating TMF 648 compliant mock data...");

        generateCustomers();
        generateAcceptedQuotes();
        generateInProgressQuotes();
        generateFailedQuotesWithTickets();
        generateCompletedQuotes();
        generatePendingQuotes();
        generateRejectedQuotes();
        generateMultiSiteQuote();

        logger.info("Mock data generation complete. Total quotes: {}", quoteRepository.count());
    }

    // ── TMF 629 / TMF 632 Customer seed data ────────────────────────────────────

    private void generateCustomers() {
        // Apex Technologies Ltd – Enterprise, Gold tier
        Customer apex = buildCustomer("CUST-0019", "Apex Technologies Ltd", "Apex Tech",
                CustomerStatus.ACTIVE, "ORG-1019", "Organization",
                "ACC-ENT-0019", "Enterprise", "en", "Gold");
        addContact(apex, ContactMediumType.PHONE,     "work",    true,  null, "+1-415-555-0101", null, null, null, null, null, null, null);
        addContact(apex, ContactMediumType.EMAIL,     "billing", false, "billing@apextech.example.com", null, null, null, null, null, null, null, null);
        addContact(apex, ContactMediumType.EMAIL,     "technical", false, "noc@apextech.example.com", null, null, null, null, null, null, null, null);
        addContact(apex, ContactMediumType.POSTAL_ADDRESS, "headquarters", false, null, null, null,
                "1 Innovation Drive", "Suite 400", "San Francisco", "CA", "94105", "US");
        customerRepository.save(apex);

        // Meridian Group – Cloud, Platinum tier
        Customer meridian = buildCustomer("CUST-0042", "Meridian Group", "Meridian",
                CustomerStatus.ACTIVE, "ORG-1042", "Organization",
                "ACC-CLD-0042", "Cloud", "en", "Platinum");
        addContact(meridian, ContactMediumType.PHONE,   "main",    true,  null, "+44-20-7946-0802", null, null, null, null, null, null, null);
        addContact(meridian, ContactMediumType.MOBILE,  "account-manager", false, null, "+44-7911-123456", null, null, null, null, null, null, null);
        addContact(meridian, ContactMediumType.EMAIL,   "procurement", true, "procurement@meridiangroup.example.com", null, null, null, null, null, null, null, null);
        addContact(meridian, ContactMediumType.POSTAL_ADDRESS, "registered-office", false, null, null, null,
                "25 Canary Wharf", null, "London", "England", "E14 5AB", "GB");
        customerRepository.save(meridian);

        // Vertex Industries – Connectivity, Silver tier
        Customer vertex = buildCustomer("CUST-0088", "Vertex Industries", "Vertex",
                CustomerStatus.ACTIVE, "ORG-1088", "Organization",
                "ACC-CON-0088", "SMB", "en", "Silver");
        addContact(vertex, ContactMediumType.PHONE,   "reception",  true,  null, "+1-312-555-0188", null, null, null, null, null, null, null);
        addContact(vertex, ContactMediumType.EMAIL,   "it-manager", true,  "it@vertexindustries.example.com", null, null, null, null, null, null, null, null);
        addContact(vertex, ContactMediumType.POSTAL_ADDRESS, "hq", false, null, null, null,
                "900 N Michigan Ave", "Floor 14", "Chicago", "IL", "60611", "US");
        customerRepository.save(vertex);

        // Cascade Retail Systems – Failed quote customer
        Customer cascade = buildCustomer("CUST-0055", "Cascade Retail Systems", "Cascade Retail",
                CustomerStatus.ACTIVE, "ORG-1055", "Organization",
                "ACC-SMB-0055", "SMB", "en", "Bronze");
        addContact(cascade, ContactMediumType.PHONE, "support-desk", true, null, "+1-503-555-0055", null, null, null, null, null, null, null);
        addContact(cascade, ContactMediumType.EMAIL, "accounts",    false, "accounts@cascaderetail.example.com", null, null, null, null, null, null, null, null);
        customerRepository.save(cascade);

        // NovaTech Systems – Completed quote customer
        Customer novatech = buildCustomer("CUST-0033", "NovaTech Systems", "NovaTech",
                CustomerStatus.ACTIVE, "ORG-1033", "Organization",
                "ACC-ENT-0033", "Enterprise", "en", "Gold");
        addContact(novatech, ContactMediumType.PHONE,  "sales",   true,  null, "+1-650-555-0033", null, null, null, null, null, null, null);
        addContact(novatech, ContactMediumType.EMAIL,  "quotes",  true,  "quotes@novatech.example.com", null, null, null, null, null, null, null, null);
        addContact(novatech, ContactMediumType.POSTAL_ADDRESS, "office", false, null, null, null,
                "2600 Campus Drive", null, "Palo Alto", "CA", "94306", "US");
        customerRepository.save(novatech);

        // Landmark Architects – Pending quote customer
        Customer landmark = buildCustomer("CUST-0144", "Landmark Architects", "Landmark",
                CustomerStatus.ACTIVE, "ORG-1144", "Organization",
                "ACC-SMB-0144", "SMB", "en", "Bronze");
        addContact(landmark, ContactMediumType.EMAIL, "contact", true, "contact@landmarkarchitects.example.com", null, null, null, null, null, null, null, null);
        addContact(landmark, ContactMediumType.PHONE, "office",  true, null, "+1-212-555-0144", null, null, null, null, null, null, null);
        customerRepository.save(landmark);

        // Alpine Resources Inc – Rejected quote customer
        Customer alpine = buildCustomer("CUST-0079", "Alpine Resources Inc", "Alpine Resources",
                CustomerStatus.INACTIVE, "ORG-1079", "Organization",
                "ACC-CON-0079", "SMB", "en", "Bronze");
        alpine.setStatusReason("Contract not renewed - migrated to competitor");
        addContact(alpine, ContactMediumType.EMAIL, "procurement", true, "procurement@alpineresources.example.com", null, null, null, null, null, null, null, null);
        customerRepository.save(alpine);

        // SenseTech Manufacturing – IoT connectivity quote
        Customer senseTech = buildCustomer("CUST-0103", "SenseTech Manufacturing", "SenseTech",
                CustomerStatus.ACTIVE, "ORG-1103", "Organization",
                "ACC-IOT-0103", "SMB", "en", "Silver");
        addContact(senseTech, ContactMediumType.EMAIL, "operations", true, "ops@sensetech.example.com", null, null, null, null, null, null, null, null);
        addContact(senseTech, ContactMediumType.PHONE, "main", true, null, "+1-408-555-0103", null, null, null, null, null, null, null);
        customerRepository.save(senseTech);

        // Crestwood Logistics – Failed MPLS quote
        Customer crestwood = buildCustomer("CUST-0071", "Crestwood Logistics", "Crestwood",
                CustomerStatus.ACTIVE, "ORG-1071", "Organization",
                "ACC-CON-0071", "SMB", "en", "Bronze");
        addContact(crestwood, ContactMediumType.EMAIL, "it", true, "it@crestwoodlogistics.example.com", null, null, null, null, null, null, null, null);
        addContact(crestwood, ContactMediumType.PHONE, "main", true, null, "+1-503-555-0071", null, null, null, null, null, null, null);
        customerRepository.save(crestwood);

        // Pacific Rim Trading – Failed data centre quote
        Customer pacificRim = buildCustomer("CUST-0034", "Pacific Rim Trading", "Pacific Rim",
                CustomerStatus.ACTIVE, "ORG-1034", "Organization",
                "ACC-DC-0034", "Enterprise", "en", "Gold");
        addContact(pacificRim, ContactMediumType.EMAIL, "procurement", true, "procurement@pacificrimtrading.example.com", null, null, null, null, null, null, null, null);
        addContact(pacificRim, ContactMediumType.PHONE, "hq", true, null, "+65-6555-0034", null, null, null, null, null, null, null);
        customerRepository.save(pacificRim);

        // InterConnect Partners – Failed wholesale quote
        Customer interConnect = buildCustomer("CUST-0012", "InterConnect Partners", "InterConnect",
                CustomerStatus.ACTIVE, "ORG-1012", "Organization",
                "ACC-WHL-0012", "Enterprise", "en", "Platinum");
        addContact(interConnect, ContactMediumType.EMAIL, "wholesale", true, "wholesale@interconnectpartners.example.com", null, null, null, null, null, null, null, null);
        customerRepository.save(interConnect);

        // Sunrise Retail Group – Failed managed security quote
        Customer sunrise = buildCustomer("CUST-0092", "Sunrise Retail Group", "Sunrise Retail",
                CustomerStatus.ACTIVE, "ORG-1092", "Organization",
                "ACC-SMB-0092", "SMB", "en", "Bronze");
        addContact(sunrise, ContactMediumType.EMAIL, "contact", true, "contact@sunriseretail.example.com", null, null, null, null, null, null, null, null);
        addContact(sunrise, ContactMediumType.PHONE, "store-ops", true, null, "+1-702-555-0092", null, null, null, null, null, null, null);
        customerRepository.save(sunrise);

        // GreenSpace Properties – Completed WiFi quote
        Customer greenSpace = buildCustomer("CUST-0067", "GreenSpace Properties", "GreenSpace",
                CustomerStatus.ACTIVE, "ORG-1067", "Organization",
                "ACC-ENT-0067", "Enterprise", "en", "Silver");
        addContact(greenSpace, ContactMediumType.EMAIL, "facilities", true, "facilities@greenspaceproperties.example.com", null, null, null, null, null, null, null, null);
        addContact(greenSpace, ContactMediumType.PHONE, "hq", true, null, "+1-212-555-0067", null, null, null, null, null, null, null);
        customerRepository.save(greenSpace);

        // GlobalTrade Corporation – Pending MPLS VPN quote
        Customer globalTrade = buildCustomer("CUST-0001", "GlobalTrade Corporation", "GlobalTrade",
                CustomerStatus.ACTIVE, "ORG-1001", "Organization",
                "ACC-ENT-0001", "Enterprise", "en", "Platinum");
        addContact(globalTrade, ContactMediumType.EMAIL, "procurement", true, "procurement@globaltrade.example.com", null, null, null, null, null, null, null, null);
        addContact(globalTrade, ContactMediumType.PHONE, "global-hq", true, null, "+1-212-555-0001", null, null, null, null, null, null, null);
        addContact(globalTrade, ContactMediumType.POSTAL_ADDRESS, "headquarters", false, null, null, null,
                "350 Fifth Avenue", "Floor 42", "New York", "NY", "10118", "US");
        customerRepository.save(globalTrade);

        // BlueStream Media – Completed IP Transit quote (C010)
        Customer blueStream = buildCustomer("CUST-0018", "BlueStream Media", "BlueStream",
                CustomerStatus.ACTIVE, "ORG-1018", "Organization",
                "ACC-ENT-0018", "Enterprise", "en", "Gold");
        addContact(blueStream, ContactMediumType.EMAIL, "noc", true, "noc@bluestreammedia.example.com", null, null, null, null, null, null, null, null);
        addContact(blueStream, ContactMediumType.PHONE, "main", true, null, "+1-310-555-0018", null, null, null, null, null, null, null);
        customerRepository.save(blueStream);
    }

    private Customer buildCustomer(String externalId, String name, String tradingName,
                                    CustomerStatus status, String engagedPartyId, String engagedPartyType,
                                    String accountRef, String segment, String lang, String creditTier) {
        Customer c = new Customer(externalId, name, tradingName);
        c.setStatus(status);
        c.setEngagedPartyId(engagedPartyId);
        c.setEngagedPartyType(engagedPartyType);
        c.setAccountRef(accountRef);
        c.setSegment(segment);
        c.setLanguagePreference(lang);
        c.setCreditTier(creditTier);
        c.setValidFrom(OffsetDateTime.now().minusYears(1));
        c.setValidTo(OffsetDateTime.now().plusYears(2));
        c.setHref("/tmf-api/customerManagement/v4/customer/" + externalId);
        return c;
    }

    private void addContact(Customer customer, ContactMediumType type, String contactType, boolean preferred,
                             String email, String phone, String social,
                             String street1, String street2, String city, String state, String postCode, String country) {
        ContactMedium cm = new ContactMedium(type, contactType, preferred);
        cm.setEmailAddress(email);
        cm.setPhoneNumber(phone);
        cm.setSocialNetworkId(social);
        cm.setStreet1(street1);
        cm.setStreet2(street2);
        cm.setCity(city);
        cm.setStateOrProvince(state);
        cm.setPostCode(postCode);
        cm.setCountry(country);
        customer.addContactMedium(cm);
    }

    // ── Quote seed helpers ───────────────────────────────────────────────────────

    private void generateAcceptedQuotes() {
        Customer apexTech  = customerRepository.findByExternalId("CUST-0019").orElse(null);
        Customer meridian  = customerRepository.findByExternalId("CUST-0042").orElse(null);

        // Enterprise Network Upgrade - Received
        Quote q1 = buildQuote("PARTNER-QUOTE-A001", "Enterprise Network Upgrade - Q2 2026",
                QuoteState.RECEIVED, "Indirect", new BigDecimal("48750.00"), -60);
        q1.setVersion("3");
        q1.setRequestReason("Customer requested upgrade of core network infrastructure to support 10G connectivity");
        q1.setCustomer(apexTech);
        addQuoteItem(q1, "10G Core Switch Stack", "network-switch-10g", "Network Equipment",
                2, new BigDecimal("8500.00"), PriceType.ONE_TIME, RecurringChargePeriod.MONTHLY, new BigDecimal("1200.00"));
        addQuoteItem(q1, "Enterprise Firewall (HA Pair)", "firewall-ng-ha", "Security",
                1, new BigDecimal("12500.00"), PriceType.ONE_TIME, RecurringChargePeriod.MONTHLY, new BigDecimal("850.00"));
        addRelatedParty(q1, "Apex Technologies Ltd", RelatedPartyRole.CUSTOMER, "CUST-0019");
        addRelatedParty(q1, "Sales Region West", RelatedPartyRole.SALES_AGENT, "AGENT-W12");
        addNote(q1, "Sales Team West", "Quote accepted after third revision. Volume discount applied at 15%.", NoteCategory.COMMERCIAL);
        q1.setSubStep("Address Validation & Enrichment");
        q1.setRawPayload(loadRawPayload("qt-a001-quote.json"));
        quoteRepository.save(q1);

        // Cloud Migration Bundle - Received
        Quote q2 = buildQuote("PARTNER-QUOTE-A002", "Cloud Migration Bundle - Enterprise",
                QuoteState.RECEIVED, "Indirect", new BigDecimal("92000.00"), -45);
        q2.setRequestReason("Full migration of on-premise workloads to cloud infrastructure");
        q2.setCustomer(meridian);
        addQuoteItem(q2, "Cloud Compute - Large (24 months)", "cloud-compute-lg", "Cloud",
                10, new BigDecimal("4200.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("4200.00"));
        addQuoteItem(q2, "Professional Services - Migration", "ps-migration", "Professional Services",
                1, new BigDecimal("35000.00"), PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addRelatedParty(q2, "Meridian Group", RelatedPartyRole.CUSTOMER, "CUST-0042");
        addNote(q2, "Account Management", "Strategic account - expedited approval. SLA addendum attached.", NoteCategory.COMMERCIAL);
        q2.setSubStep("Customer Create");
        q2.setRawPayload(loadRawPayload("qt-a002-quote.json"));
        quoteRepository.save(q2);
    }

    private void generateInProgressQuotes() {
        Customer vertex      = customerRepository.findByExternalId("CUST-0088").orElse(null);
        Customer cascade     = customerRepository.findByExternalId("CUST-0055").orElse(null);
        Customer senseTech   = customerRepository.findByExternalId("CUST-0103").orElse(null);

        // SD-WAN Rollout
        Quote q3 = buildQuote("PARTNER-QUOTE-P003", "SD-WAN Multi-Site Rollout",
                QuoteState.IN_PROGRESS, "Indirect", new BigDecimal("67200.00"), -5);
        q3.setExpectedQuoteCompletionDate(OffsetDateTime.now().plusDays(7));
        q3.setRequestReason("Replace legacy MPLS with SD-WAN across 12 branch locations");
        q3.setCustomer(vertex);
        addQuoteItem(q3, "SD-WAN Edge Device (per site)", "sdwan-edge-100", "Connectivity",
                12, new BigDecimal("2400.00"), PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addQuoteItem(q3, "SD-WAN Management Platform", "sdwan-mgmt-platform", "Connectivity",
                1, new BigDecimal("18000.00"), PriceType.RECURRING, RecurringChargePeriod.ANNUAL, new BigDecimal("18000.00"));
        addRelatedParty(q3, "Vertex Industries", RelatedPartyRole.CUSTOMER, "CUST-0088");
        addNote(q3, "Technical Pre-Sales", "Site survey required before finalizing. 3 sites have constrained rack space.", NoteCategory.TECHNICAL);
        q3.setSubStep("Site Creation");
        q3.setRawPayload(loadRawPayload("qt-p003-quote.json"));
        quoteRepository.save(q3);

        // Unified Communications
        Quote q4 = buildQuote("PARTNER-QUOTE-P004", "Unified Communications Platform Refresh",
                QuoteState.IN_PROGRESS, "Indirect", new BigDecimal("31500.00"), -2);
        q4.setExpectedQuoteCompletionDate(OffsetDateTime.now().plusDays(10));
        q4.setCustomer(cascade);
        addQuoteItem(q4, "UC Softphone Licenses (500 users)", "uc-softphone-500", "Collaboration",
                500, new BigDecimal("18.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("9000.00"));
        addQuoteItem(q4, "Session Border Controller", "sbc-enterprise", "Collaboration",
                1, new BigDecimal("7500.00"), PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addRelatedParty(q4, "Northstar Financial", RelatedPartyRole.CUSTOMER, "CUST-0055");
        addNote(q4, "Sales Team East", "Customer currently evaluating two vendors. Decision expected EOW.", NoteCategory.COMMERCIAL);
        q4.setSubStep("Add Sites");
        q4.setRawPayload(loadRawPayload("qt-p004-quote.json"));
        quoteRepository.save(q4);

        // IoT Connectivity
        Quote q5 = buildQuote("PARTNER-QUOTE-P005", "IoT Sensor Fleet Connectivity",
                QuoteState.IN_PROGRESS, "Indirect", new BigDecimal("14800.00"), -1);
        q5.setExpectedQuoteCompletionDate(OffsetDateTime.now().plusDays(14));
        addQuoteItem(q5, "IoT SIM Cards (1000 units, 5MB/month)", "iot-sim-5mb", "IoT",
                1000, new BigDecimal("3.50"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("3500.00"));
        addRelatedParty(q5, "SenseTech Manufacturing", RelatedPartyRole.CUSTOMER, "CUST-0103");
        q5.setCustomer(senseTech);
        q5.setSubStep("Assign Offers");
        q5.setRawPayload(loadRawPayload("qt-p005-quote.json"));
        quoteRepository.save(q5);
    }

    private void generateFailedQuotesWithTickets() {
        Customer crestwood   = customerRepository.findByExternalId("CUST-0071").orElse(null);
        Customer pacificRim  = customerRepository.findByExternalId("CUST-0034").orElse(null);
        Customer interConnect = customerRepository.findByExternalId("CUST-0012").orElse(null);
        Customer sunrise     = customerRepository.findByExternalId("CUST-0092").orElse(null);

        // Failed: Pricing engine timeout
        Quote q6 = buildQuote("PARTNER-QUOTE-F006", "MPLS Bandwidth Upgrade - Critical Path",
                QuoteState.FAILED, "Indirect", BigDecimal.ZERO, -3);
        addQuoteItem(q6, "MPLS 1Gbps Circuit", "mpls-1g-circuit", "Connectivity",
                3, BigDecimal.ZERO, PriceType.RECURRING, RecurringChargePeriod.MONTHLY, BigDecimal.ZERO);
        addRelatedParty(q6, "Crestwood Logistics", RelatedPartyRole.CUSTOMER, "CUST-0071");
        q6.setCustomer(crestwood);
        addNote(q6, "Pricing Engine", "Pricing calculation timed out after 30s. Rate card lookup failed for international circuits.", NoteCategory.TECHNICAL);
        q6.setSubStep("Customer Creation");
        q6.setRawPayload(loadRawPayload("qt-f006-quote.json"));
        quoteRepository.save(q6);
        createTicket(q6, "PRICING-TIMEOUT-001",
                "Pricing engine timed out during circuit rate lookup (MPLS international routes)",
                TicketPriority.CRITICAL, TicketCategory.PRICING_ERROR);

        // Failed: Product catalog validation
        Quote q7 = buildQuote("PARTNER-QUOTE-F007", "Data Centre Colocation Bundle",
                QuoteState.FAILED, "Indirect", BigDecimal.ZERO, -7);
        addQuoteItem(q7, "Half Rack Colocation (Tier 3)", "dc-halfrack-t3", "Data Centre",
                4, BigDecimal.ZERO, PriceType.RECURRING, RecurringChargePeriod.MONTHLY, BigDecimal.ZERO);
        addRelatedParty(q7, "Pacific Rim Trading", RelatedPartyRole.CUSTOMER, "CUST-0034");
        q7.setCustomer(pacificRim);
        addNote(q7, "Product Catalog", "SKU 'dc-halfrack-t3' discontinued. No active substitution mapped.", NoteCategory.TECHNICAL);
        q7.setSubStep("Proposal Create");
        q7.setRawPayload(loadRawPayload("qt-f007-quote.json"));
        quoteRepository.save(q7);
        createTicket(q7, "CATALOG-INVALID-007",
                "Quote item references discontinued product SKU - no substitution available in catalog",
                TicketPriority.HIGH, TicketCategory.PRODUCT_CONFIGURATION);

        // Failed: Integration error
        Quote q8 = buildQuote("PARTNER-QUOTE-F008", "Wholesale Capacity Agreement",
                QuoteState.FAILED, "Indirect", BigDecimal.ZERO, -1);
        addQuoteItem(q8, "Dark Fibre IRU - Metro", "df-iru-metro", "Wholesale",
                1, BigDecimal.ZERO, PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addRelatedParty(q8, "InterConnect Partners", RelatedPartyRole.PARTNER, "PART-0012");
        q8.setCustomer(interConnect);
        addNote(q8, "Integration Layer", "APA backend returned 503 during feasibility check. Retry count exceeded.", NoteCategory.TECHNICAL);
        q8.setSubStep("Add Addon");
        q8.setRawPayload(loadRawPayload("qt-f008-quote.json"));
        quoteRepository.save(q8);
        createTicket(q8, "INTEGRATION-APA-503",
                "APA backend unavailable during feasibility check - maximum retries exceeded",
                TicketPriority.HIGH, TicketCategory.INTEGRATION_FAILURE);

        // Failed: Validation error
        Quote q9 = buildQuote("PARTNER-QUOTE-F009", "Managed Security Services - SMB",
                QuoteState.FAILED, "Indirect", BigDecimal.ZERO, -12);
        addRelatedParty(q9, "Sunrise Retail Group", RelatedPartyRole.CUSTOMER, "CUST-0092");
        q9.setCustomer(sunrise);
        addNote(q9, "Validation Engine", "Quote item quantity validation failed: max 50 units per order for this SKU, requested 200.", NoteCategory.TECHNICAL);
        q9.setSubStep("Aggregate");
        q9.setRawPayload(loadRawPayload("qt-f009-quote.json"));
        quoteRepository.save(q9);
        createTicket(q9, "VALIDATION-EXCEED-009",
                "Quote quantity exceeds maximum per-order limit for managed security SKU",
                TicketPriority.MEDIUM, TicketCategory.DATA_VALIDATION);
    }

    private void generateCompletedQuotes() {
        Customer novatech   = customerRepository.findByExternalId("CUST-0033").orElse(null);
        Customer blueStream = customerRepository.findByExternalId("CUST-0018").orElse(null);
        Customer greenSpace = customerRepository.findByExternalId("CUST-0067").orElse(null);

        Quote q10 = buildQuote("PARTNER-QUOTE-C010", "IP Transit Upgrade - 10Gbps",
                QuoteState.COMPLETED, "Indirect", new BigDecimal("28800.00"), -90);
        q10.setEffectiveQuoteCompletionDate(OffsetDateTime.now().minusDays(80));
        q10.setCustomer(novatech);
        addQuoteItem(q10, "IP Transit 10G Port", "ipt-10g-port", "Connectivity",
                1, new BigDecimal("2400.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("2400.00"));
        addRelatedParty(q10, "BlueStream Media", RelatedPartyRole.CUSTOMER, "CUST-0018");
        q10.setCustomer(blueStream);
        addNote(q10, "Provisioning Team", "Circuit provisioned and tested. Customer confirmed service acceptance.", NoteCategory.IMPLEMENTATION);
        q10.setRawPayload(loadRawPayload("qt-c010-quote.json"));
        quoteRepository.save(q10);

        Quote q11 = buildQuote("PARTNER-QUOTE-C011", "Managed WiFi - Office Campus",
                QuoteState.COMPLETED, "Indirect", new BigDecimal("18600.00"), -120);
        q11.setEffectiveQuoteCompletionDate(OffsetDateTime.now().minusDays(100));
        addQuoteItem(q11, "WiFi 6 Access Point (Indoor)", "wifi6-ap-indoor", "Wireless",
                24, new BigDecimal("450.00"), PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addQuoteItem(q11, "Managed WiFi Service", "managed-wifi-svc", "Wireless",
                1, new BigDecimal("1200.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("1200.00"));
        addRelatedParty(q11, "GreenSpace Properties", RelatedPartyRole.CUSTOMER, "CUST-0067");
        q11.setCustomer(greenSpace);
        q11.setRawPayload(loadRawPayload("qt-c011-quote.json"));
        quoteRepository.save(q11);
    }

    private void generatePendingQuotes() {
        Customer landmark    = customerRepository.findByExternalId("CUST-0144").orElse(null);
        Customer globalTrade = customerRepository.findByExternalId("CUST-0001").orElse(null);

        Quote q12 = buildQuote("PARTNER-QUOTE-PND012", "Global MPLS VPN Expansion",
                QuoteState.PENDING_APPROVAL, "Indirect", new BigDecimal("185000.00"), -10);
        q12.setExpectedQuoteCompletionDate(OffsetDateTime.now().plusDays(15));
        addQuoteItem(q12, "MPLS VPN Site Addition (per site)", "mpls-vpn-site", "Connectivity",
                25, new BigDecimal("1800.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("45000.00"));
        addRelatedParty(q12, "GlobalTrade Corporation", RelatedPartyRole.CUSTOMER, "CUST-0001");
        addRelatedParty(q12, "Tier-1 Accounts", RelatedPartyRole.ACCOUNT_MANAGER, "AM-T1-09");
        q12.setCustomer(globalTrade);
        addNote(q12, "Legal Team", "Custom SLA addendum under review. Do not finalise until legal sign-off.", NoteCategory.LEGAL);
        q12.setSubStep("Finalize");
        q12.setRawPayload(loadRawPayload("qt-pnd012-quote.json"));
        quoteRepository.save(q12);

        Quote q13 = buildQuote("PARTNER-QUOTE-PND013", "Backup & DR as a Service",
                QuoteState.PENDING_APPROVAL, "Indirect", new BigDecimal("9600.00"), -4);
        q13.setCustomer(landmark);
        addQuoteItem(q13, "BDRaaS - 5TB Storage Tier", "bdraas-5tb", "Cloud Services",
                1, new BigDecimal("800.00"), PriceType.RECURRING, RecurringChargePeriod.MONTHLY, new BigDecimal("800.00"));
        addRelatedParty(q13, "Landmark Architects", RelatedPartyRole.CUSTOMER, "CUST-0144");
        addNote(q13, "Solutions Architecture", "Awaiting customer sign-off on RTO/RPO requirements before pricing is finalised.", NoteCategory.TECHNICAL);
        q13.setSubStep("Finalize");
        q13.setRawPayload(loadRawPayload("qt-pnd013-quote.json"));
        quoteRepository.save(q13);
    }

    private void generateRejectedQuotes() {
        Customer alpine = customerRepository.findByExternalId("CUST-0079").orElse(null);

        Quote q14 = buildQuote("PARTNER-QUOTE-R014", "Satellite Backhaul - Remote Sites",
                QuoteState.FAILED, "Indirect", new BigDecimal("52000.00"), -30);
        q14.setEffectiveQuoteCompletionDate(OffsetDateTime.now().minusDays(25));
        q14.setCustomer(alpine);
        addQuoteItem(q14, "Satellite Modem (VSAT)", "vsat-modem-std", "Connectivity",
                8, new BigDecimal("2200.00"), PriceType.ONE_TIME, null, BigDecimal.ZERO);
        addRelatedParty(q14, "Alpine Resources Inc", RelatedPartyRole.CUSTOMER, "CUST-0079");
        addNote(q14, "Account Manager", "Customer rejected - competitor offered lower latency LEO solution at comparable price.", NoteCategory.COMMERCIAL);
        q14.setSubStep("Contact Reaction");
        q14.setRawPayload(loadRawPayload("qt-r014-quote.json"));
        quoteRepository.save(q14);
    }

    // ── Helper methods ──────────────────────────────────────────────────────────

    private void generateMultiSiteQuote() {
        // Create the Dominos Pizza customer (TMF 629)
        Customer dominos = buildCustomer("CUST-0200", "Dominos Pizza Inc.", "Dominos",
                CustomerStatus.ACTIVE, "ORG-1200", "Organization",
                "ACC-ENT-0200", "Enterprise", "en", "Gold");
        addContact(dominos, ContactMediumType.EMAIL, "procurement", true,
                "john.doe@dominos.com", null, null, null, null, null, null, null, null);
        addContact(dominos, ContactMediumType.PHONE, "main", true,
                null, "2155559999", null, null, null, null, null, null, null);
        addContact(dominos, ContactMediumType.POSTAL_ADDRESS, "headquarters", false,
                null, null, null, "100 MAIN ST", "SUITE 200", "PHILADELPHIA", "PA", "19103", "US");
        customerRepository.save(dominos);

        // Load the full TMF 648 JSON from the classpath resource
        String rawJson;
        try {
            ClassPathResource resource = new ClassPathResource("mock-data/dominos-quote.json");
            rawJson = resource.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warn("Could not load dominos-quote.json mock data: {}", e.getMessage());
            return;
        }

        Quote q = buildQuote("PARTNER-QUOTE-67890", "Multi-site deployment - Standalone + Package",
                QuoteState.IN_PROGRESS, "Indirect", new BigDecimal("869.65"), -2);
        q.setCustomer(dominos);
        q.setExpectedQuoteCompletionDate(OffsetDateTime.parse("2026-03-15T00:00:00Z"));
        q.setExpectedFulfillmentStartDate(OffsetDateTime.parse("2026-04-01T00:00:00Z"));
        q.setVersion("1");
        q.setRawPayload(rawJson);

        addRelatedParty(q, "Dominos Pizza Inc.", RelatedPartyRole.CUSTOMER, "CUST-0200");
        addNote(q, "Partner Sales Rep",
                "Site 1 needs standalone BI with static IP. Site 2 needs bundled Data Voice package.",
                NoteCategory.COMMERCIAL);
        q.setSubStep("Configure Offers");
        quoteRepository.save(q);
        logger.info("Generated multi-site Dominos quote: {}", q.getExternalId());
    }

    private Quote buildQuote(String extId, String description, QuoteState state, String category,
                              BigDecimal totalPrice, int daysOffset) {
        Quote q = new Quote();
        q.setExternalId(extId);
        q.setDescription(description);
        q.setState(state);
        q.setCategory(category);
        q.setQuoteTotalPrice(totalPrice);
        q.setQuoteDate(OffsetDateTime.now().plusDays(daysOffset));
        q.setValidUntil(OffsetDateTime.now().plusDays(daysOffset + 30));
        q.setVersion("1");
                if (state == QuoteState.COMPLETED) {
                        q.setSubStep("Contract Signed");
                }
        return q;
    }

    private void addQuoteItem(Quote quote, String desc, String offeringId, String category,
                               int qty, BigDecimal unitPrice, PriceType priceType,
                               RecurringChargePeriod period, BigDecimal recurringPrice) {
        QuoteItem item = new QuoteItem();
        item.setDescription(desc);
        item.setProductOfferingId(offeringId);
        item.setProductOfferingName(desc);
        item.setProductCategory(category);
        item.setQuantity(qty);
        item.setItemPrice(unitPrice.multiply(BigDecimal.valueOf(qty)));
        item.setItemTotalPrice(item.getItemPrice());
        item.setState(QuoteItemState.IN_PROGRESS);
        item.setAction(QuoteItemAction.ADD);

        QuoteItemPrice qip = new QuoteItemPrice();
        qip.setName("Initial charge");
        qip.setPriceType(priceType);
        qip.setPrice(unitPrice.multiply(BigDecimal.valueOf(qty)));
        qip.setCurrency("USD");
        if (period != null) qip.setRecurringChargePeriod(period);
        item.addQuoteItemPrice(qip);

        if (period != null && recurringPrice.compareTo(BigDecimal.ZERO) > 0) {
            QuoteItemPrice recurring = new QuoteItemPrice();
            recurring.setName("Recurring charge");
            recurring.setPriceType(PriceType.RECURRING);
            recurring.setPrice(recurringPrice);
            recurring.setCurrency("USD");
            recurring.setRecurringChargePeriod(period);
            item.addQuoteItemPrice(recurring);
        }

        quote.addQuoteItem(item);
    }

    private void addRelatedParty(Quote quote, String name, RelatedPartyRole role, String orgRefId) {
        RelatedParty rp = new RelatedParty();
        rp.setName(name);
        rp.setRole(role);
        rp.setOrganizationRefId(orgRefId);
        rp.setStatus(RelatedPartyStatus.ACTIVE);
        quote.addRelatedParty(rp);
    }

    private void addNote(Quote quote, String author, String text, NoteCategory category) {
        Note note = new Note();
        note.setAuthor(author);
        note.setText(text);
        note.setCategory(category);
        note.setPriority(NotePriority.MEDIUM);
        note.setStatus(NoteStatus.ACTIVE);
        quote.addNote(note);
    }

    private String loadRawPayload(String filename) {
        try {
            ClassPathResource resource = new ClassPathResource("mock-data/" + filename);
            return resource.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warn("Could not load mock-data/{}: {}", filename, e.getMessage());
            return null;
        }
    }

    private void createTicket(Quote quote, String failureCode, String failureReason,
                               TicketPriority priority, TicketCategory category) {
        SupportTicket ticket = new SupportTicket();
        ticket.setTicketNumber("TKT-" + String.format("%06d", ticketSeq.getAndIncrement()));
        ticket.setTitle("Quote Failure: " + quote.getDescription());
        ticket.setDescription("Auto-generated ticket for failed quote " + quote.getExternalId() + ". " + failureReason);
        ticket.setFailureReason(failureReason);
        ticket.setFailureCode(failureCode);
        ticket.setCategory(category);
        ticket.setPriority(priority);
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setQuote(quote);
        ticket.setReportedBy("System Auto-Generate");
        ticket.setAssigneeTeam(category == TicketCategory.PRICING_ERROR ? "Pricing Operations" :
                               category == TicketCategory.INTEGRATION_FAILURE ? "Integration Support" :
                               "Quote Processing Team");
        ticket.setDueDate(OffsetDateTime.now().plusDays(priority == TicketPriority.CRITICAL ? 1 : 3));
        ticketRepository.save(ticket);
    }
}