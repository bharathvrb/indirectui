'use strict';

angular.module('quoteManagement')
    .factory('AuthService', ['$q', '$window', '$location', '$http', function($q, $window, $location, $http) {
        var instance = $window.__msalInstance;
        var config = $window.AUTH_CONFIG || {};
        var localSession = $window.__localAuth || { enabled: false, authenticated: false };
        var mode = localSession.authenticated ? 'local' : 'sso';
        var expired = false;

        function localActive() {
            return localSession.authenticated && localSession.user && localSession.expiresAt > Date.now();
        }

        function getUser() {
            if (expired) return null;
            if (mode === 'local') return localActive() ? localSession.user : null;
            return instance ? instance.getActiveAccount() : null;
        }

        function validScopes(scopes) {
            return angular.isArray(scopes) && scopes.length > 0 &&
                scopes.every(function(scope) { return typeof scope === 'string' && scope.trim(); });
        }

        function loginScopes() {
            return config.loginScopes || ['openid', 'profile'].concat(config.apiScopes || []);
        }

        function configured() {
            return !!(config.clientId && config.tenantId &&
                !/YOUR_|HERE/.test(config.clientId + config.tenantId) &&
                validScopes(loginScopes()));
        }

        function validReturnUrl(url) {
            if (typeof url !== 'string' || /[\\#]/.test(url)) return false;
            return /^(\/quotes(?:\/[^/?]+)?|\/support-tickets)(?:\?.*)?$/.test(url);
        }

        function requireLogin(reason) {
            expired = true;
            var destination = $location.path() === '/login' ? $location.search().returnTo : $location.url();
            var query = {};
            if (validReturnUrl(destination)) query.returnTo = destination;
            if (reason) query.reason = reason;
            $location.path('/login').search(query).replace();
        }

        function acquireSilently(scopes, identityOnly) {
            return $q.when(instance.acquireTokenSilent({
                scopes: scopes,
                account: instance.getActiveAccount()
            })).then(function(response) {
                var token = identityOnly ? response.idToken : response.accessToken;
                if (!token) {
                    if (identityOnly) {
                        return $q.reject({ status: 401, authRequired: true, message: 'Sign in again to verify your identity with the application server.' });
                    }
                    return $q.reject(new Error('SSO did not return an API access token.'));
                }
                return token;
            }, function(error) {
                if (($window.msal && error instanceof $window.msal.InteractionRequiredAuthError) ||
                    ['interaction_required', 'login_required', 'consent_required'].indexOf(error.errorCode) !== -1) {
                    requireLogin('session-expired');
                    return $q.reject({ status: 401, authRequired: true, message: 'Your session needs a new sign-in.' });
                }
                return $q.reject(error);
            });
        }

        return {
            getUser: getUser,
            isAuthenticated: function() { return !!getUser(); },
            isSsoConfigured: configured,
            getInitializationError: function() { return $window.__authError; },
            isLocalLoginSupported: function() {
                return ['localhost', '127.0.0.1', '[::1]'].indexOf($window.location.hostname) !== -1;
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
                    return $q.reject({ data: { message: 'Local sign-in is not enabled on this development server.' } });
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
                if (mode === 'local') return $q.when(null);
                return acquireSilently(loginScopes(), true);
            },
            acquireToken: function() {
                if (!getUser()) {
                    return $q.reject({ status: 401, authRequired: true, message: 'Please sign in to continue.' });
                }
                if (mode === 'local') {
                    return $q.reject({
                        status: 0,
                        code: 'LOCAL_LOGIN_API_UNAVAILABLE',
                        message: 'Local login opens the development workspace only. Sign out and use Comcast SSO with a configured QuoteData API scope to load backend data.'
                    });
                }
                if (!validScopes(config.apiScopes)) {
                    return $q.reject({
                        status: 0,
                        code: 'API_SCOPES_NOT_CONFIGURED',
                        message: 'SSO sign-in is available, but QuoteData access needs its own API scope. Configure AUTH_CONFIG.apiScopes in config.js.'
                    });
                }
                return acquireSilently(config.apiScopes, false);
            },
            logout: function() {
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
