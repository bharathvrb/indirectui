describe('Local development sign-in', function() {
    'use strict';
    var auth, root, location, backend, controller, scope, previous, sso;

    function session(expiresAt) {
        return {
            enabled: true, authenticated: true,
            user: { name: 'Fixture user', username: 'fixture-user', authType: 'local' },
            expiresAt: expiresAt || Date.now() + 3600000
        };
    }

    beforeEach(function() {
        previous = {
            local: window.__localAuth, localError: window.__localAuthError,
            instance: window.__msalInstance, config: window.AUTH_CONFIG
        };
        sso = {
            getActiveAccount: jasmine.createSpy('getActiveAccount').and.returnValue(null),
            acquireTokenSilent: jasmine.createSpy('acquireTokenSilent'),
            logoutRedirect: jasmine.createSpy('logoutRedirect'),
            loginRedirect: jasmine.createSpy('loginRedirect')
        };
        window.__msalInstance = sso;
        window.__localAuthError = null;
        window.AUTH_CONFIG = { clientId: 'fixture-client', tenantId: 'fixture-tenant', loginScopes: ['openid', 'profile'] };
        angular.mock.module('quoteManagement', function($controllerProvider) {
            ['QuoteListCtrl', 'QuoteDetailCtrl', 'SupportTicketsCtrl'].forEach(function(name) {
                $controllerProvider.register(name, function() {});
            });
        });
    });

    function initialize(initialSession) {
        window.__localAuth = initialSession || { enabled: true, authenticated: false, user: null, expiresAt: null };
        angular.mock.inject(function(AuthService, $rootScope, $location, $httpBackend, $controller, $templateCache) {
            auth = AuthService;
            root = $rootScope;
            location = $location;
            backend = $httpBackend;
            controller = $controller;
            ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
                $templateCache.put('app/components/' + path + '.html', '<div></div>');
            });
        });
    }

    function loginController() {
        scope = root.$new();
        controller('LoginCtrl', { $scope: scope });
        scope.credentials.username = 'fixture-user';
        scope.credentials.password = 'fixture-password';
    }

    afterEach(function() {
        if (scope) scope.$destroy();
        if (backend) {
            backend.verifyNoOutstandingExpectation();
            backend.verifyNoOutstandingRequest();
        }
        window.__localAuth = previous.local;
        window.__localAuthError = previous.localError;
        window.__msalInstance = previous.instance;
        window.AUTH_CONFIG = previous.config;
        scope = null;
        backend = null;
    });

    it('authenticates only after the server creates a valid session', function() {
        initialize();
        backend.expectPOST('/auth/local/login', { username: 'fixture-user', password: 'fixture-password' }).respond(200, session());
        auth.loginLocal('fixture-user', 'fixture-password');
        expect(auth.isAuthenticated()).toBe(false);
        backend.flush();
        expect(auth.isAuthenticated()).toBe(true);
        expect(auth.getUser().authType).toBe('local');
        expect(sso.acquireTokenSilent).not.toHaveBeenCalled();
    });

    it('restores a valid server session on page reload', function() {
        initialize(session());
        expect(auth.isAuthenticated()).toBe(true);
        expect(auth.getUser().username).toBe('fixture-user');
        expect(root.currentUser.authType).toBe('local');
    });

    it('does not trust an expired server session', function() {
        initialize(session(Date.now() - 1000));
        expect(auth.isAuthenticated()).toBe(false);
        expect(auth.getUser()).toBeNull();
    });

    it('rejects malformed or expired login responses', function() {
        initialize();
        var rejected;
        backend.expectPOST('/auth/local/login').respond(200, { authenticated: true, user: { username: 'fixture-user' } });
        auth.loginLocal('fixture-user', 'fixture-password').catch(function(error) { rejected = error; });
        backend.flush();
        expect(auth.isAuthenticated()).toBe(false);
        expect(rejected.data.message).toContain('valid local session');
    });

    it('uses the HTTP-only session cookie for proxy requests without fabricating a bearer token', function() {
        initialize(session());
        var result;
        angular.mock.inject(function(AuthInterceptor) {
            AuthInterceptor.request({
                url: '/api/quotedata/v1/quote',
                headers: { Authorization: 'stale-value', authorization: 'stale-value' }
            }).then(function(config) { result = config; });
        });
        root.$digest();
        expect(result.headers.Authorization).toBeUndefined();
        expect(result.headers.authorization).toBeUndefined();
        expect(sso.acquireTokenSilent).not.toHaveBeenCalled();
        expect(auth.isAuthenticated()).toBe(true);
    });

    it('allows the configured same-origin QuoteData service call for a local session', function() {
        initialize(session());
        var result;
        backend.expectGET('/api/quotedata/v1/quote?quoteRequestId=LOCAL-Q', function(headers) {
            return !headers.Authorization && /^qm-ui-/.test(headers.trackingId);
        }).respond(200, { quoteRequestId: 'LOCAL-Q', state: 'COMPLETED' });
        angular.mock.inject(function(QuoteService) {
            QuoteService.getQuote('LOCAL-Q').then(function(response) { result = response.data; });
        });
        backend.flush();
        expect(result.quoteRequestId).toBe('LOCAL-Q');
    });

    it('clears local sign-in at the server without logging out of Entra', function() {
        initialize(session());
        backend.expectPOST('/auth/local/logout', {}).respond(200, { enabled: true, authenticated: false });
        auth.logout();
        backend.flush();
        expect(auth.isAuthenticated()).toBe(false);
        expect(location.path()).toBe('/login');
        expect(sso.logoutRedirect).not.toHaveBeenCalled();
    });

    it('surfaces logout errors rather than claiming the session was revoked', function() {
        initialize(session());
        backend.expectPOST('/auth/local/logout').respond(500, {});
        var rejected;
        auth.logout().catch(function(error) { rejected = error; });
        backend.flush();
        expect(rejected.status).toBe(500);
        expect(auth.isAuthenticated()).toBe(true);
    });

    it('rejects local login when the server has not enabled it', function() {
        initialize({ enabled: false, authenticated: false });
        var rejected;
        auth.loginLocal('fixture-user', 'fixture-password').catch(function(error) { rejected = error; });
        root.$digest();
        expect(rejected.data.message).toContain('not enabled');
        expect(auth.isAuthenticated()).toBe(false);
    });

    it('returns to the intended quote and clears the password from the form', function() {
        initialize();
        location.url('/login?returnTo=%2Fquotes%2FFIXTURE-1');
        loginController();
        backend.expectPOST('/auth/local/login', { username: 'fixture-user', password: 'fixture-password' }).respond(200, session());
        scope.signInLocal();
        expect(scope.credentials.password).toBe('');
        expect(scope.localSigningIn).toBe(true);
        backend.flush();
        expect(location.path()).toBe('/quotes/FIXTURE-1');
        expect(scope.localSigningIn).toBe(false);
    });

    it('prevents duplicate submissions and parallel SSO redirects', function() {
        initialize();
        loginController();
        backend.expectPOST('/auth/local/login').respond(200, session());
        scope.signInLocal();
        scope.signInLocal();
        scope.signIn();
        backend.flush();
        expect(sso.loginRedirect).not.toHaveBeenCalled();
    });

    it('shows a generic wrong-password message without retaining the password', function() {
        initialize();
        loginController();
        backend.expectPOST('/auth/local/login').respond(401, { message: 'Incorrect username or password.' });
        scope.signInLocal();
        backend.flush();
        expect(scope.localError).toBe('Incorrect username or password.');
        expect(scope.credentials.password).toBe('');
        expect(scope.localSigningIn).toBe(false);
        expect(auth.isAuthenticated()).toBe(false);
    });

    it('explains throttling and permits retry after a failed attempt', function() {
        initialize();
        loginController();
        backend.expectPOST('/auth/local/login').respond(429, {});
        scope.signInLocal();
        backend.flush();
        expect(scope.localError).toContain('Too many sign-in attempts');
        expect(scope.localSigningIn).toBe(false);
    });

    it('validates missing credentials and supports an explicit password visibility toggle', function() {
        initialize();
        loginController();
        scope.credentials.username = '   ';
        scope.signInLocal();
        expect(scope.localError).toBe('Enter your username and password.');
        expect(scope.passwordVisible).toBe(false);
        scope.togglePassword();
        expect(scope.passwordVisible).toBe(true);
        scope.togglePassword();
        expect(scope.passwordVisible).toBe(false);
    });
});
