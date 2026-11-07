// Public deployment settings only. Never put client secrets or access tokens here.
window.APP_CONFIG = Object.assign({
    // Same-origin server proxy; it holds the QuoteData service credentials (see server.properties).
    apiBaseUrl: '/api',
    quoteDataLookupOnly: true,
    contractDownloadUrl: '',
    supportUrl: '',
    // Quote list auto-refresh interval (seconds, minimum 15). The toggle is off by default.
    autoRefreshSeconds: 60,
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
if (/^\/(?:quotes(?:\/[^/]+)?|support-tickets|login)\/?$/.test(window.location.pathname)) {
    window.history.replaceState(null, '', '/#!' + window.location.pathname.replace(/\/$/, '') + window.location.search);
}
