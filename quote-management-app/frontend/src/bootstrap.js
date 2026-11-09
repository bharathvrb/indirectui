(function(window, angular) {
    'use strict';
    var config = window.AUTH_CONFIG || {};
    window.__msalInstance = null;
    window.__authError = null;
    window.__localAuth = { enabled: false, authenticated: false, user: null, expiresAt: null };
    window.__localAuthError = null;

    function boot() {
        angular.bootstrap(document.documentElement, ['quoteManagement']);
    }

    function failed(error) {
        window.__authError = 'Single sign-on could not start. Reload the page to try again, or contact your administrator.';
        console.error('SSO initialization failed:', error.errorCode || error.name || 'unknown');
        window.__msalInstance = null;
    }

    function initializeLocalSession() {
        var abort = new window.AbortController();
        var timeout = window.setTimeout(function() { abort.abort(); }, 5000);
        return window.fetch('/auth/local/session', { credentials: 'same-origin', cache: 'no-store', signal: abort.signal }).then(function(response) {
            if (response.status === 404) return null;
            if (!response.ok) throw new Error('Local session lookup failed.');
            return response.json();
        }).then(function(session) {
            if (!session) return;
            if (typeof session.enabled !== 'boolean' || typeof session.authenticated !== 'boolean' ||
                (session.authenticated && (!session.enabled || !session.user || typeof session.user.username !== 'string' ||
                    !Number.isFinite(session.expiresAt)))) {
                throw new Error('Local session response was invalid.');
            }
            window.__localAuth = session;
        }).catch(function(error) {
            window.__localAuthError = 'Local sign-in could not be initialized. Reload the page or check that the server is running.';
            console.error('Local session initialization failed:', error.name);
        }).finally(function() {
            window.clearTimeout(timeout);
        });
    }

    function initializeSso() {
        if (!config.clientId || !config.tenantId ||
            /YOUR_|HERE/.test(config.clientId + config.tenantId)) return Promise.resolve();
        if (!window.msal) {
            failed(new Error('Authentication library is unavailable.'));
            return Promise.resolve();
        }
        var instance;
        try {
            instance = new window.msal.PublicClientApplication({
                auth: {
                    clientId: config.clientId,
                    authority: 'https://login.microsoftonline.com/' + config.tenantId,
                    redirectUri: config.redirectUri,
                    postLogoutRedirectUri: config.redirectUri,
                    navigateToLoginRequestUrl: true
                },
                cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
            });
        } catch (error) {
            failed(error);
            return Promise.resolve();
        }
        return instance.initialize().then(function() {
            return instance.handleRedirectPromise();
        }).then(function(response) {
            if (response && response.account) instance.setActiveAccount(response.account);
            var accounts = instance.getAllAccounts();
            if (!instance.getActiveAccount() && accounts.length === 1) instance.setActiveAccount(accounts[0]);
            window.__msalInstance = instance;
        }, failed);
    }

    Promise.all([initializeSso(), initializeLocalSession()]).then(function() {
        boot();
    });
}(window, window.angular));
