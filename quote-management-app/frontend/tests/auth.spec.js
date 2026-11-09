describe('Common SSO workspace', function() {
    'use strict';
    var auth, root, location, q, interceptor, instance, fakeWindow, account, previous;

    beforeEach(function() {
        account = null;
        instance = {
            getActiveAccount: jasmine.createSpy('getActiveAccount').and.callFake(function() { return account; }),
            loginRedirect: jasmine.createSpy('loginRedirect'),
            logoutRedirect: jasmine.createSpy('logoutRedirect'),
            acquireTokenSilent: jasmine.createSpy('acquireTokenSilent')
        };
        previous = {
            instance: window.__msalInstance, config: window.AUTH_CONFIG, bypass: window.__ssoBypass,
            appConfig: window.APP_CONFIG
        };
        fakeWindow = window;
        window.__msalInstance = instance;
        window.__ssoBypass = true;
        window.APP_CONFIG = angular.extend({}, window.APP_CONFIG);
        window.AUTH_CONFIG = { clientId: 'test-client', tenantId: 'test-tenant', redirectUri: 'https://ui.test/' };
        angular.mock.module('quoteManagement', function($provide, $controllerProvider) {
            $provide.constant('API_BASE_URL', '/api');
            ['QuoteListCtrl', 'QuoteDetailCtrl', 'SupportTicketsCtrl'].forEach(function(name) {
                $controllerProvider.register(name, function() {});
            });
        });
        angular.mock.inject(function(AuthService, $rootScope, $location, $q, AuthInterceptor, $templateCache) {
            auth = AuthService;
            root = $rootScope;
            location = $location;
            q = $q;
            interceptor = AuthInterceptor;
            ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
                $templateCache.put('app/components/' + path + '.html', '<div></div>');
            });
        });
    });

    afterEach(function() {
        window.__msalInstance = previous.instance;
        window.AUTH_CONFIG = previous.config;
        window.__ssoBypass = previous.bypass;
        window.APP_CONFIG = previous.appConfig;
    });

    it('does not grant access from the old bypass flag', function() {
        expect(auth.isAuthenticated()).toBe(false);
        expect(root.canUpdateQuotes).toBe(false);
    });

    it('preserves a case link and query state when routing to sign-in', function() {
        location.url('/quotes/Q-123?tab=errors');
        root.$digest();
        expect(location.path()).toBe('/login');
        expect(location.search().returnTo).toBe('/quotes/Q-123?tab=errors');
        expect(auth.getReturnUrl()).toBe('/quotes/Q-123?tab=errors');
    });

    it('accepts the Search page as a return destination', function() {
        location.search('returnTo', '/search?search=ABC');
        expect(auth.getReturnUrl()).toBe('/search?search=ABC');
        location.search('returnTo', '/search/extra');
        expect(auth.getReturnUrl()).toBe('/quotes');
    });

    it('rejects external or unrecognized return destinations', function() {
        ['https://outside.test/', '//outside.test', '/login', '/quotes\\outside', '/unknown'].forEach(function(target) {
            location.search('returnTo', target);
            expect(auth.getReturnUrl()).toBe('/quotes');
        });
    });

    it('requires a client and tenant for sign-in', function() {
        expect(auth.isSsoConfigured()).toBe(true);
        fakeWindow.AUTH_CONFIG.clientId = '';
        expect(auth.isSsoConfigured()).toBe(false);
    });

    it('requests only OIDC scopes on login by default', function() {
        instance.loginRedirect.and.returnValue(q.when());
        auth.login();
        expect(instance.loginRedirect).toHaveBeenCalledWith({
            scopes: ['openid', 'profile'],
            redirectStartPage: fakeWindow.location.href
        });
    });

    it('uses the ONP sign-in scopes and account selector without inventing API permissions', function() {
        fakeWindow.AUTH_CONFIG.loginScopes = ['openid', 'profile', 'email', 'User.Read'];
        fakeWindow.AUTH_CONFIG.loginPrompt = 'select_account';
        instance.loginRedirect.and.returnValue(q.when());
        auth.login();
        expect(instance.loginRedirect).toHaveBeenCalledWith({
            scopes: ['openid', 'profile', 'email', 'User.Read'],
            prompt: 'select_account',
            redirectStartPage: fakeWindow.location.href
        });
    });

    it('sends an SSO identity token only to the same-origin proxy, never the Graph access token', function() {
        account = { username: 'test-user' };
        fakeWindow.AUTH_CONFIG.loginScopes = ['openid', 'profile', 'email', 'User.Read'];
        instance.acquireTokenSilent.and.returnValue(q.when({ idToken: 'signed-test-identity', accessToken: 'graph-test-token' }));
        var config;
        interceptor.request({ url: '/api/quotedata/v1/quote' }).then(function(value) { config = value; });
        root.$digest();
        expect(config.headers.Authorization).toBe('Bearer ' + 'signed-test-identity');
        expect(instance.acquireTokenSilent.calls.mostRecent().args[0].scopes)
            .toEqual(['openid', 'profile', 'email', 'User.Read']);
    });

    it('never sends an identity token to a lookalike proxy origin', function() {
        account = { username: 'test-user' };
        var config = { url: 'https://outside.invalid/api/quotedata/v1/quote' };
        expect(interceptor.request(config)).toBe(config);
        expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
    });

    it('rejects a missing SSO identity token rather than falling back to the Graph token', function() {
        account = { username: 'test-user' };
        instance.acquireTokenSilent.and.returnValue(q.when({ accessToken: 'graph-test-token' }));
        var rejected;
        interceptor.request({ url: '/api/quotedata/v1/quote' }).catch(function(error) { rejected = error; });
        root.$digest();
        expect(rejected.authRequired).toBe(true);
        expect(rejected.status).toBe(401);
    });

    it('does not expire the user session when the upstream service token is rejected', function() {
        account = { username: 'test-user' };
        location.url('/quotes');
        interceptor.responseError({
            status: 502, data: { code: 'UPSTREAM_UNAUTHORIZED' }, config: { url: '/api/quotedata/v1/quote' }
        }).catch(angular.noop);
        root.$digest();
        expect(auth.isAuthenticated()).toBe(true);
        expect(location.path()).toBe('/quotes');
    });

    it('returns to login when the proxy cannot verify the caller identity', function() {
        account = { username: 'test-user' };
        location.url('/quotes/Q-123');
        interceptor.responseError({ status: 401, config: { url: '/api/quotedata/v1/quote' } }).catch(angular.noop);
        root.$digest();
        expect(auth.isAuthenticated()).toBe(false);
        expect(location.path()).toBe('/login');
        expect(location.search().returnTo).toBe('/quotes/Q-123');
    });

    it('does not attach a bearer token to templates or lookalike origins', function() {
        var template = { url: 'app/components/login/login.html' };
        var foreign = { url: 'https://quotes.test.evil/api/quotedata/v1/quote' };
        expect(interceptor.request(template)).toBe(template);
        expect(interceptor.request(foreign)).toBe(foreign);
        expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
    });

    it('attaches the identity token only after successful acquisition', function() {
        account = { username: 'test-user' };
        instance.acquireTokenSilent.and.returnValue(q.when({ idToken: 'test-identity' }));
        var config;
        interceptor.request({ url: '/api/quotedata/v1/quote' }).then(function(result) { config = result; });
        root.$digest();
        expect(config.headers.Authorization).toBe('Bearer test-identity');
    });

    it('rejects API requests instead of sending them after a token failure', function() {
        account = { username: 'test-user' };
        var failure = new Error('Token unavailable');
        instance.acquireTokenSilent.and.returnValue(q.reject(failure));
        var resolved = false, rejected;
        interceptor.request({ url: '/api/quotedata/v1/quote' })
            .then(function() { resolved = true; }, function(error) { rejected = error; });
        root.$digest();
        expect(resolved).toBe(false);
        expect(rejected).toBe(failure);
    });

    it('keeps the active URL when session reauthentication is needed', function() {
        account = { username: 'test-user' };
        location.url('/quotes/Q-456?tab=processing');
        auth.requireLogin('session-expired');
        expect(location.path()).toBe('/login');
        expect(location.search().returnTo).toBe('/quotes/Q-456?tab=processing');
        expect(location.search().reason).toBe('session-expired');
        expect(auth.isAuthenticated()).toBe(false);
    });

    it('rejects an unauthenticated API request without calling token acquisition', function() {
        var rejected;
        interceptor.request({ url: '/api/quotedata/v1/quote' }).catch(function(error) { rejected = error; });
        root.$digest();
        expect(rejected.status).toBe(401);
        expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
    });

    it('updates mobile navigation on the root scope', function() {
        root.toggleNavigation();
        expect(root.mobileMenuOpen).toBe(true);
        root.toggleNavigation();
        expect(root.mobileMenuOpen).toBe(false);
    });
});

describe('Compact SSO sign-in', function() {
    'use strict';
    var template, element, scope;
    beforeAll(function(done) {
        var request = new XMLHttpRequest();
        request.open('GET', '/base/src/app/components/login/login.html');
        request.onload = function() {
            if (request.status !== 200) { done.fail('Login template could not load.'); return; }
            template = request.responseText;
            done();
        };
        request.onerror = function() { done.fail('Login template could not load.'); };
        request.send();
    });
    beforeEach(angular.mock.module('quoteManagement'));
    afterEach(function() {
        if (scope) scope.$destroy();
        if (element) element.remove();
    });
    it('renders only the sign-in card without promotional captions', angular.mock.inject(function($rootScope, $compile, $templateCache) {
        $templateCache.put('app/components/login/login.html', '<div></div>');
        scope = $rootScope.$new();
        scope.ssoConfigured = true;
        element = $compile(template)(scope);
        scope.$digest();
        expect(element[0].querySelectorAll('section').length).toBe(1);
        expect(element[0].querySelector('#signin-title').textContent).toBe('Sign in');
        expect(element[0].querySelector('.qm-login-btn').disabled).toBe(false);
        ['Every quote', 'One clear', 'Find it faster', 'See the whole picture', 'Resolve with confidence', 'Diagnose']
            .forEach(function(caption) { expect(element[0].textContent).not.toContain(caption); });
    }));
});

describe('Workspace theme preferences', function() {
    'use strict';
    var previous;
    beforeEach(function() { previous = window.QuoteTheme.getPreference(); });
    afterEach(function() { window.QuoteTheme.setPreference(previous); });

    it('keeps Bootstrap and application themes synchronized', function() {
        ['dark', 'light'].forEach(function(theme) {
            window.QuoteTheme.setPreference(theme);
            expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe(theme);
            expect(window.localStorage.getItem('omw-theme')).toBe(theme);
        });
    });

    it('resolves system appearance without saving the resolved preference', function() {
        window.QuoteTheme.setPreference('system');
        expect(window.QuoteTheme.getPreference()).toBe('system');
        expect(window.localStorage.getItem('omw-theme')).toBe('system');
        expect(document.documentElement.getAttribute('data-theme'))
            .toBe(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    });
});
