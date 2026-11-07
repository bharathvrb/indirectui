package com.orion.quotemanagement.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

/**
 * Security configuration enforcing Azure AD SSO authentication.
 *
 * When AZURE_TENANT_ID and AZURE_CLIENT_ID environment variables are set to
 * real values, all /tmf-api/** endpoints require a valid Azure AD Bearer token.
 *
 * When the environment variables are not set (placeholders remain), the backend
 * runs in open/dev mode and permits all requests so the UI loads without SSO.
 *
 * IMPORTANT: Do NOT set spring.security.oauth2.resourceserver.jwt.issuer-uri
 * in application.yml — Spring Boot would attempt to fetch JWKS at startup
 * even with placeholder values, crashing the app. The decoder is created here
 * programmatically only when real credentials are present.
 *
 * See README-SSO.md for app registration steps.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String PLACEHOLDER_TENANT = "YOUR_COMCAST_TENANT_ID_HERE";
    private static final String PLACEHOLDER_CLIENT  = "YOUR_AZURE_CLIENT_ID_HERE";

    @Value("${AZURE_TENANT_ID:" + PLACEHOLDER_TENANT + "}")
    private String azureTenantId;

    @Value("${AZURE_CLIENT_ID:" + PLACEHOLDER_CLIENT + "}")
    private String azureClientId;

    private boolean isSsoConfigured() {
        return !PLACEHOLDER_TENANT.equals(azureTenantId)
            && !PLACEHOLDER_CLIENT.equals(azureClientId);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(withDefaults())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
            );

        if (isSsoConfigured()) {
            // ── SSO active: require JWT on all API endpoints ────────────
            // Build the decoder here so it only contacts Azure AD when
            // real tenant/client IDs are present.
            String issuerUri = "https://login.microsoftonline.com/" + azureTenantId + "/v2.0";
            JwtDecoder jwtDecoder = JwtDecoders.fromIssuerLocation(issuerUri);

            http
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/h2-console/**").permitAll()
                    .requestMatchers("/actuator/health").permitAll()
                    .requestMatchers(
                        "/", "/index.html", "/app/**", "/assets/**",
                        "/*.ico", "/*.js", "/*.css", "/*.html"
                    ).permitAll()
                    .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                    .jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(jwtAuthenticationConverter())
                    )
                );
        } else {
            // ── Dev / pre-registration mode: permit everything ──────────
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        }

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("roles");
        authoritiesConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return converter;
    }
}

