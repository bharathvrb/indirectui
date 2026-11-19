// Public deployment settings only. Never put client secrets or access tokens here.
window.APP_CONFIG = Object.assign({
    // Same-origin server proxy; it holds the QuoteData service credentials (see server.properties).
    apiBaseUrl: '/api',
    // Home shows the default list of quotes (25 rows, newest first). false turns the list off and Home points to Search.
    defaultListEnabled: true,
    // Sent as category=... on the first load of that default list, and shown as the Category filter (the person can change it).
    // Leave blank to load every category.
    defaultCategory: 'Enterprise Multi-Site',
    // true: the Search page finds one quote by ID only. false: it also offers "Other fields" (free-text search).
    quoteDataLookupOnly: true,
    contractDownloadUrl: '',
    supportUrl: '',
    // Quote retry: true enables the quote-level Retry button. The server also needs QUOTEDATA_RETRY_ENABLED=true.
    features: { retryEnabled: false },
    // OMW access epic (BXTFOMW-26558 to 26564), UI side only. Every part is off until its backend API exists, so the app
    // behaves as before. Each object is merged key by key, so set only what you change.
    access: {
        // true: ask the server what the signed-in person may do and show only the permitted screens and buttons.
        enabled: false,
        permissionsUrl: '/api/quotemgmt/v1/me/permissions',
        // Where an employee requests an OMW role (https only). Blank: the "no role" screen shows the text without a link.
        requestRoleUrl: ''
    },
    // Quote opened from a Dynamics case: the page is framed by Dynamics and trades a one-time GUID for a one-quote session.
    embed: {
        enabled: false,
        // Exact origins (scheme and host, no path) allowed to frame this page and send the handshake.
        dynamicsOrigins: [],
        // <OMW_SOURCE_SYSTEM>: sent to Dynamics in the READY message.
        sourceSystem: '',
        // <INITIALIZE_PATH> of the Initialize API, for example /api/quotemgmt/v1/initialize.
        initializeUrl: '',
        handshakeTimeoutMs: 10000
    },
    // Address opened in a top-level window when sign-in cannot continue inside a frame. Blank: this site's sign-in page.
    signIn: { newWindowUrl: '' }
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
