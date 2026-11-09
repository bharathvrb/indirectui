// Public deployment settings only. Never put client secrets or access tokens here.
window.APP_CONFIG = Object.assign({
    // Same-origin server proxy; it holds the QuoteData service credentials (see server.properties).
    apiBaseUrl: '/api',
    // Home shows the default list of quotes (25 rows, newest first). false turns the list off and Home points to Search.
    defaultListEnabled: true,
    // true: the Search page finds one quote by ID only. false: it also offers "Other fields" (free-text search).
    quoteDataLookupOnly: true,
    contractDownloadUrl: '',
    supportUrl: '',
    // Step retry: true shows enabled Retry buttons. The server also needs QUOTEDATA_RETRY_ENABLED=true.
    features: { retryEnabled: false }
}, window.APP_CONFIG || {});

window.AUTH_CONFIG = Object.assign({
    // Temporary ONP UI LOWER - INT registration, matching ONP's public MSAL settings.
    clientId: 'ae57677b-0389-4a92-bbf5-078156e0886b',
    tenantId: '906aefe9-76a7-4f65-b82d-5ec20775d5aa',
    loginScopes: ['openid', 'profile', 'email', 'User.Read'],
    loginPrompt: 'select_account',
    redirectUri: window.location.origin + '/'
}, window.AUTH_CONFIG || {});

// Case links can use clean paths; the existing AngularJS router uses hash URLs.
if (/^\/(?:quotes(?:\/[^/]+)?|search|support-tickets|login)\/?$/.test(window.location.pathname)) {
    window.history.replaceState(null, '', '/#!' + window.location.pathname.replace(/\/$/, '') + window.location.search);
}
