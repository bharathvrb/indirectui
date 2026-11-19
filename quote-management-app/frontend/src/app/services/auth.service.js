'use strict';

angular.module('quoteManagement')
    .factory('AuthService', ['$q', '$window', '$location', '$http', function($q, $window, $location, $http) {
        var instance = $window.__msalInstance;
        var config = $window.AUTH_CONFIG || {};
        var localSession = $window.__localAuth || { enabled: false, authenticated: false };
        var mode = localSession.authenticated ? 'local' : 'sso';
        var expired = false;
        // A person who arrived from a Dynamics case has no sign-in of their own: the server session is bound to one quote.
        var caseSession = null;

        function localActive() {
            return localSession.authenticated && localSession.user && localSession.expiresAt > Date.now();
        }

        function getUser() {
            if (expired) return null;
            if (mode === 'case') return caseSession ? caseSession.user : null;
            if (mode === 'local') return localActive() ? localSession.user : null;
            return instance ? instance.getActiveAccount() : null;
        }

        function validScopes(scopes) {
            return angular.isArray(scopes) && scopes.length > 0 &&
                scopes.every(function(scope) { return typeof scope === 'string' && scope.trim(); });
        }

        function loginScopes() {
            return config.loginScopes || ['openid', 'profile'];
        }

        function configured() {
            return !!(config.clientId && config.tenantId &&
                !/YOUR_|HERE/.test(config.clientId + config.tenantId) &&
                validScopes(loginScopes()));
        }

        function validReturnUrl(url) {
            if (typeof url !== 'string' || /[\\#]/.test(url)) return false;
            return /^(\/quotes(?:\/[^/?]+)?|\/search|\/support-tickets)(?:\?.*)?$/.test(url);
        }

        function requireLogin(reason) {
            expired = true;
            if (mode === 'case') {
                // Nothing to sign in to: the case has to be reopened from Dynamics.
                $location.url('/no-access?reason=session').replace();
                return;
            }
            var destination = $location.path() === '/login' ? $location.search().returnTo : $location.url();
            var query = {};
            if (validReturnUrl(destination)) query.returnTo = destination;
            if (reason) query.reason = reason;
            $location.path('/login').search(query).replace();
        }

        // The server verifies this ID token as proof of identity; it is never forwarded to QuoteData.
        function acquireIdToken() {
            return $q.when(instance.acquireTokenSilent({
                scopes: loginScopes(),
                account: instance.getActiveAccount()
            })).then(function(response) {
                if (!response.idToken) {
                    return $q.reject({ status: 401, authRequired: true, message: 'Sign in again to verify your identity with the application server.' });
                }
                return response.idToken;
            }, function(error) {
                if (($window.msal && error instanceof $window.msal.InteractionRequiredAuthError) ||
                    ['interaction_required', 'login_required', 'consent_required'].indexOf(error.errorCode) !== -1) {
                    requireLogin('session-expired');
                    return $q.reject({ status: 401, authRequired: true, message: 'Your session needs a new sign-in.' });
                }
                return $q.reject(error);
            });
        }

        // Where "Continue sign-in in a new window" goes. It is the configured address, or this site's own sign-in page;
        // nothing from the page (and never a GUID) is added to it.
        function newWindowSignInUrl() {
            var configured = $window.APP_CONFIG && $window.APP_CONFIG.signIn && $window.APP_CONFIG.signIn.newWindowUrl;
            var fallback = $window.location.origin + '/#!/login';
            if (typeof configured !== 'string' || !configured.trim()) return fallback;
            try {
                var url = new URL(configured.trim(), $window.location.origin);
                return url.protocol === 'https:' || url.origin === $window.location.origin ? url.href : fallback;
            } catch (error) {
                return fallback;
            }
        }

        return {
            getUser: getUser,
            isCaseSession: function() { return mode === 'case' && !expired && !!caseSession; },
            setCaseSession: function(info) {
                caseSession = { quoteRequestId: info && info.quoteRequestId, user: { name: 'Dynamics case', username: '', authType: 'case' } };
                mode = 'case';
                expired = false;
            },
            newWindowSignInUrl: newWindowSignInUrl,
            isAuthenticated: function() { return !!getUser(); },
            isSsoConfigured: configured,
            getInitializationError: function() { return $window.__authError; },
            isLocalLoginSupported: function() {
                // Username/password sign-in is offered everywhere; the server decides whether it is configured.
                return true;
            },
            isLocalLoginEnabled: function() { return localSession.enabled === true; },
            getLocalInitializationError: function() { return $window.__localAuthError; },
            getReturnUrl: function() {
                var target = $location.search().returnTo;
                return validReturnUrl(target) ? target : '/quotes';
            },
            requireLogin: requireLogin,
            loginLocal: function(username, password) {
                if (!localSession.enabled) {
                    return $q.reject({ data: { message: 'Local sign-in is not enabled on this server.' } });
                }
                return $http.post('/auth/local/login', { username: username, password: password }).then(function(response) {
                    var session = response.data;
                    if (!session || !session.authenticated || !session.user ||
                        typeof session.user.username !== 'string' || !Number.isFinite(session.expiresAt) ||
                        session.expiresAt <= Date.now()) {
                        return $q.reject({ data: { message: 'The server did not create a valid local session.' } });
                    }
                    localSession = session;
                    mode = 'local';
                    expired = false;
                    return session.user;
                });
            },
            login: function() {
                if (!configured() || !instance) {
                    return $q.reject(new Error('Single sign-on is unavailable. Check the application configuration and reload.'));
                }
                var request = {
                    scopes: loginScopes(),
                    redirectStartPage: $window.location.href
                };
                if (config.loginPrompt) request.prompt = config.loginPrompt;
                return $q.when(instance.loginRedirect(request));
            },
            acquireProxyIdentity: function() {
                if (!getUser()) {
                    return $q.reject({ status: 401, authRequired: true, message: 'Please sign in to continue.' });
                }
                // Local callers use the server-validated HTTP-only cookie; SSO callers prove their identity.
                if (mode === 'local' || mode === 'case') return $q.when(null);
                return acquireIdToken();
            },
            logout: function() {
                if (mode === 'case') {
                    requireLogin();
                    return $q.when();
                }
                if (mode === 'local') {
                    return $http.post('/auth/local/logout', {}).then(function() {
                        localSession = { enabled: localSession.enabled, authenticated: false, user: null, expiresAt: null };
                        requireLogin();
                    });
                }
                if (!instance) {
                    requireLogin();
                    return $q.when();
                }
                return $q.when(instance.logoutRedirect({
                    account: instance.getActiveAccount(),
                    postLogoutRedirectUri: config.redirectUri
                }));
            }
        };
    }]);
