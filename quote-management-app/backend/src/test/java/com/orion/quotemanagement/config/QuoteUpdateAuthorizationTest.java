package com.orion.quotemanagement.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuoteUpdateAuthorizationTest {

    @Test
    void ssoRequiresQuoteUpdateRole() {
        QuoteUpdateAuthorization authorization = configuredAuthorization();
        var permitted = new UsernamePasswordAuthenticationToken("sales-user", "n/a",
                List.of(new SimpleGrantedAuthority("ROLE_QUOTE_UPDATE")));
        var denied = new UsernamePasswordAuthenticationToken("read-only-user", "n/a",
                List.of(new SimpleGrantedAuthority("ROLE_QUOTE_READ")));

        assertTrue(authorization.canUpdate(permitted));
        assertFalse(authorization.canUpdate(denied));
    }

    @Test
    void devBypassAllowsLocalRecoveryActions() {
        QuoteUpdateAuthorization authorization = new QuoteUpdateAuthorization();
        ReflectionTestUtils.setField(authorization, "azureTenantId", "YOUR_COMCAST_TENANT_ID_HERE");
        ReflectionTestUtils.setField(authorization, "azureClientId", "YOUR_AZURE_CLIENT_ID_HERE");

        var localUser = new UsernamePasswordAuthenticationToken("anonymousUser", "n/a", List.of());
        assertTrue(authorization.canUpdate(localUser));
    }

    private QuoteUpdateAuthorization configuredAuthorization() {
        QuoteUpdateAuthorization authorization = new QuoteUpdateAuthorization();
        ReflectionTestUtils.setField(authorization, "azureTenantId", "configured-tenant");
        ReflectionTestUtils.setField(authorization, "azureClientId", "configured-client");
        return authorization;
    }
}