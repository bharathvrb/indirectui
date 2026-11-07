package com.orion.quotemanagement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("quoteUpdateAuthorization")
public class QuoteUpdateAuthorization {

    private static final String PLACEHOLDER_TENANT = "YOUR_COMCAST_TENANT_ID_HERE";
    private static final String PLACEHOLDER_CLIENT = "YOUR_AZURE_CLIENT_ID_HERE";

    @Value("${AZURE_TENANT_ID:" + PLACEHOLDER_TENANT + "}")
    private String azureTenantId;

    @Value("${AZURE_CLIENT_ID:" + PLACEHOLDER_CLIENT + "}")
    private String azureClientId;

    public boolean canUpdate(Authentication authentication) {
        if (!isSsoConfigured()) return true;
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_QUOTE_UPDATE".equals(authority.getAuthority()));
    }

    private boolean isSsoConfigured() {
        return !PLACEHOLDER_TENANT.equals(azureTenantId)
                && !PLACEHOLDER_CLIENT.equals(azureClientId);
    }
}