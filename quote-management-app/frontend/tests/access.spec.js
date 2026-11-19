describe('Access: permissions, route guard and error wording (stories 26558, 26559, 26563)', function() {
  'use strict';
  var originalConfig, backend, access, errors, root, location, authStub, q;
  var URL = '/api/quotemgmt/v1/me/permissions';

  function permissionsFor(sessionType, list, quote) {
    return { userId: 'U-1', sessionType: sessionType, quoteRequestId: quote || null, permissions: list };
  }
  var ADMIN = ['LIST_ALL_QUOTES', 'VIEW_ANY_QUOTE', 'VIEW_ASSIGNED_QUOTE', 'DOWNLOAD_QUOTE', 'EDIT_QUOTE', 'COMPLETE_QUOTE'];

  function configure(access) {
    window.APP_CONFIG = angular.extend({}, originalConfig, { access: access });
  }

  function boot(accessConfig) {
    configure(accessConfig);
    authStub = null;
    angular.mock.module('quoteManagement', function($provide, $controllerProvider) {
      ['QuoteListCtrl', 'QuoteDetailCtrl', 'SupportTicketsCtrl', 'LoginCtrl', 'AccessCtrl', 'EmbedCtrl'].forEach(function(name) {
        $controllerProvider.register(name, function() {});
      });
      $provide.factory('AuthService', ['$q', function($q) {
        authStub = {
          getUser: function() { return { name: 'Synthetic', username: 'synthetic', authType: 'local' }; },
          isAuthenticated: function() { return true; },
          getReturnUrl: function() { return '/quotes'; },
          requireLogin: jasmine.createSpy('requireLogin'),
          logout: function() { return $q.when(); }
        };
        return authStub;
      }]);
    });
    angular.mock.inject(function($httpBackend, AccessService, AccessErrors, $rootScope, $location, $templateCache, $q) {
      backend = $httpBackend; access = AccessService; errors = AccessErrors; root = $rootScope; location = $location; q = $q;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets', 'access/access', 'embed/embed'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
  }

  beforeEach(function() { originalConfig = window.APP_CONFIG; });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    if (backend) { backend.verifyNoOutstandingExpectation(); backend.verifyNoOutstandingRequest(); }
    backend = null;
  });

  describe('while access.enabled is off (the default)', function() {
    beforeEach(function() { boot({ enabled: false }); });

    it('allows everything and never calls the server, so the app behaves as before', function() {
      expect(access.isEnabled()).toBe(false);
      expect(access.status()).toBe('disabled');
      ['listAll', 'viewAny', 'search', 'view', 'update', 'download', 'edit', 'complete'].forEach(function(name) {
        expect(access.allows(name)).toBe(true);
      });
      expect(access.canOpenQuote('ANY')).toBe(true);
      var state;
      access.load().then(function(value) { state = value; });
      root.$digest();
      expect(state.status).toBe('disabled');
      expect(access.isCase()).toBe(false);
    });

    it('lets every page through the route guard', function() {
      ['/quotes', '/search', '/quotes/Q-1', '/support-tickets'].forEach(function(path) {
        location.url(path);
        root.$digest();
        expect(location.path()).toBe(path);
      });
    });
  });

  describe('when it is on', function() {
    beforeEach(function() { boot({ enabled: true }); });

    function loadWith(body, status) {
      backend.expectGET(URL, function(headers) { return /^qm-ui-/.test(headers.trackingId); }).respond(status || 200, body);
      var state;
      access.load().then(function(value) { state = value; });
      backend.flush();
      return state;
    }

    it('reads the permissions once and answers allows() from them, ignoring case and accepting the short names', function() {
      var state = loadWith(permissionsFor('DIRECT', ['list_all_quotes', 'View_Any_Quote', 'COMPLETE', 'download']));
      expect(state.status).toBe('ready');
      expect(access.sessionType()).toBe('DIRECT');
      expect(access.allows('listAll')).toBe(true);
      expect(access.allows('viewAny')).toBe(true);
      expect(access.allows('search')).toBe(true);
      expect(access.allows('complete')).toBe(true);
      expect(access.allows('update')).toBe(true);
      expect(access.allows('download')).toBe(true);
      expect(access.allows('edit')).toBe(false);
      expect(access.allows('nonsense')).toBe(false);
      access.load(); // cached: no second request
      root.$digest();
    });

    it('lets a read-only role see and download but not complete or edit (the permission table)', function() {
      loadWith(permissionsFor('DIRECT', ['VIEW_ASSIGNED_QUOTE', 'DOWNLOAD_QUOTE']));
      expect(access.allows('download')).toBe(true);
      expect(access.allows('complete')).toBe(false);
      expect(access.allows('edit')).toBe(false);
      expect(access.allows('update')).toBe(false);
      expect(access.allows('listAll')).toBe(false);
      expect(access.allows('search')).toBe(true);
      expect(access.landingPath()).toBe('/search');
    });

    it('never lists or searches in a Dynamics case session, whatever the permission strings say', function() {
      loadWith(permissionsFor('CASE', ADMIN, 'Q-BOUND-1'));
      expect(access.isCase()).toBe(true);
      expect(access.quoteRequestId()).toBe('Q-BOUND-1');
      expect(access.allows('listAll')).toBe(false);
      expect(access.allows('viewAny')).toBe(false);
      expect(access.allows('search')).toBe(false);
      expect(access.allows('view')).toBe(true);
      expect(access.canOpenQuote('Q-BOUND-1')).toBe(true);
      expect(access.canOpenQuote('Q-OTHER')).toBe(false);
      expect(access.landingPath()).toBe('/quotes/Q-BOUND-1');
    });

    [
      [403, { code: 'ROLE_MISSING', trackingId: 'TRACE-R' }, 'no-role', 'ROLE_MISSING', 'TRACE-R'],
      [403, { code: 'SCOPE_MISSING', trackingId: 'TRACE-S' }, 'denied', 'SCOPE_MISSING', 'TRACE-S'],
      [401, { code: 'SESSION_INVALID' }, 'expired', 'SESSION_INVALID', null],
      [503, { code: 'SERVICE_UNAVAILABLE', trackingId: 'TRACE-U' }, 'unavailable', 'SERVICE_UNAVAILABLE', 'TRACE-U'],
      [500, null, 'unavailable', null, null]
    ].forEach(function(entry) {
      it('reads a ' + entry[0] + ' answer as "' + entry[2] + '" and keeps its tracking id', function() {
        var state = loadWith(entry[1], entry[0]);
        expect(state.status).toBe(entry[2]);
        expect(access.code()).toBe(entry[3]);
        expect(access.trackingId()).toBe(entry[4] || access.trackingId());
        expect(access.allows('view')).toBe(false);
        if (entry[4] === null) expect(access.trackingId()).toMatch(/^qm-ui-/);
      });
    });

    it('treats a malformed answer as unavailable, never as permission', function() {
      [{ sessionType: 'DIRECT' }, { sessionType: 'OTHER', permissions: [] }, { sessionType: 'CASE', permissions: ['X'], quoteRequestId: null },
        { sessionType: 'CASE', permissions: ['X'], quoteRequestId: 'bad id!' }, 'text', [], { sessionType: 'DIRECT', permissions: 'ALL' }].forEach(function(body) {
        access.reset();
        var state = loadWith(body);
        expect(state.status).toBe('unavailable');
        expect(access.code()).toBe('MALFORMED');
        expect(access.allows('listAll')).toBe(false);
      });
    });

    it('shares one request between callers and can be reset or forced', function() {
      backend.expectGET(URL).respond(200, permissionsFor('DIRECT', ADMIN));
      access.load(); access.load();
      backend.flush();
      expect(access.status()).toBe('ready');
      backend.expectGET(URL).respond(200, permissionsFor('DIRECT', ['VIEW_ASSIGNED_QUOTE']));
      access.load(true);
      backend.flush();
      expect(access.allows('listAll')).toBe(false);
      access.reset();
      expect(access.status()).toBe('unknown');
      expect(access.allows('view')).toBe(false);
    });

    it('offers the request-role link only for an https address', function() {
      expect(access.requestRoleUrl()).toBe('');
      configure({ enabled: true, requestRoleUrl: 'http://insecure.example/request' });
      expect(access.requestRoleUrl()).toBe('');
      configure({ enabled: true, requestRoleUrl: ' https://access.example/request ' });
      expect(access.requestRoleUrl()).toBe('https://access.example/request');
    });

    describe('route guard', function() {
      function go(path, response, status) {
        backend.expectGET(URL).respond(status || 200, response);
        location.url(path);
        backend.flush();
        root.$digest();
      }

      it('lets an administrator into every page and asks for permissions once', function() {
        go('/quotes', permissionsFor('DIRECT', ADMIN));
        expect(location.path()).toBe('/quotes');
        ['/search', '/support-tickets', '/quotes/Q-9'].forEach(function(path) { location.url(path); root.$digest(); expect(location.path()).toBe(path); });
      });

      it('sends a person without an OMW role to the role message', function() {
        go('/quotes', { code: 'ROLE_MISSING', message: 'Access denied', trackingId: 'T-1' }, 403);
        expect(location.url()).toBe('/no-access?reason=role');
      });

      it('sends a person who may only view assigned quotes from Home and Tickets to Search, and still lets them open a quote', function() {
        go('/quotes', permissionsFor('DIRECT', ['VIEW_ASSIGNED_QUOTE', 'DOWNLOAD_QUOTE']));
        expect(location.url()).toBe('/search');
        location.url('/support-tickets'); root.$digest();
        expect(location.url()).toBe('/search');
        location.url('/quotes/Q-ASSIGNED'); root.$digest();
        expect(location.path()).toBe('/quotes/Q-ASSIGNED');
      });

      it('keeps a Dynamics case on its own quote and refuses every other page or quote', function() {
        go('/search', permissionsFor('CASE', ['VIEW_ASSIGNED_QUOTE'], 'Q-BOUND-1'));
        expect(location.url()).toBe('/quotes/Q-BOUND-1');
        location.url('/quotes'); root.$digest();
        expect(location.url()).toBe('/quotes/Q-BOUND-1');
        location.url('/quotes/Q-OTHER'); root.$digest();
        expect(location.url()).toBe('/no-access?reason=quote');
      });

      it('says "unavailable" when the permissions cannot be read', function() {
        go('/quotes', { code: 'SERVICE_UNAVAILABLE' }, 503);
        expect(location.url()).toBe('/no-access?reason=unavailable');
      });

      it('asks a direct user to sign in again when the session has expired', function() {
        go('/quotes', { code: 'SESSION_INVALID' }, 401);
        expect(authStub.requireLogin).toHaveBeenCalledWith('session-expired');
      });

      it('sends an expired Dynamics case to the "reopen the case" message, not to a sign-in', function() {
        go('/quotes/Q-BOUND-1', permissionsFor('CASE', ['VIEW_ASSIGNED_QUOTE'], 'Q-BOUND-1'));
        expect(location.path()).toBe('/quotes/Q-BOUND-1');
        backend.expectGET(URL).respond(401, { code: 'SESSION_INVALID' });
        access.load(true);
        backend.flush();
        expect(access.status()).toBe('expired');
        expect(access.isCase()).toBe(true);
        backend.expectGET(URL).respond(401, { code: 'SESSION_INVALID' });
        location.url('/search');
        backend.flush();
        root.$digest();
        expect(location.url()).toBe('/no-access?reason=session');
        expect(authStub.requireLogin).not.toHaveBeenCalled();
      });
    });
  });

  describe('error wording (story 26563)', function() {
    beforeEach(function() { boot({ enabled: false }); });

    [
      [403, 'QUOTE_SCOPE_DENIED', 'scope', 'You do not have access to this quote. Contact your Sales Support lead if you believe this is an error.'],
      [403, 'ROLE_MISSING', 'role', 'You do not have an OMW role. Request access in myComcastAccess.'],
      [403, 'ACTION_NOT_ALLOWED', 'action', 'You are not allowed to perform this action.'],
      [401, 'GUID_USED', 'case-session', 'Session expired. Reopen the case from Dynamics.'],
      [401, 'GUID_EXPIRED', 'case-session', 'Session expired. Reopen the case from Dynamics.'],
      [401, 'GUID_INVALID', 'case-session', 'Session expired. Reopen the case from Dynamics.'],
      [503, null, 'unavailable', 'The service is temporarily unavailable. Try again shortly.'],
      [503, 'SERVICE_UNAVAILABLE', 'unavailable', 'The service is temporarily unavailable. Try again shortly.']
    ].forEach(function(entry) {
      it('maps ' + entry[0] + ' ' + entry[1] + ' to its message', function() {
        var result = errors.describe({ status: entry[0], data: entry[1] ? { code: entry[1], trackingId: 'T-9' } : { trackingId: 'T-9' } });
        expect(result.kind).toBe(entry[2]);
        expect(result.message).toBe(entry[3]);
        expect(result.trackingId).toBe('T-9');
      });
    });

    it('treats a direct 401 as "sign in again" (no message here; the sign-in redirect does it)', function() {
      var result = errors.describe({ status: 401, data: { code: 'TOKEN_EXPIRED' } });
      expect(result.kind).toBe('sign-in');
      expect(result.message).toBeNull();
    });

    it('leaves every other answer alone, including the proxy\'s own 503 explanations', function() {
      [{ status: 403, data: { code: 'UPSTREAM_FORBIDDEN' } }, { status: 404 }, { status: 500 }, { status: 0 },
        { status: 503, data: { code: 'SERVICE_AUTH_NOT_CONFIGURED', message: 'Configure it.' } }, null, undefined].forEach(function(response) {
        var result = errors.describe(response);
        expect(result.kind).toBeNull();
        expect(result.message).toBeNull();
      });
    });

    it('finds the tracking id in the body, then a header, then the request', function() {
      expect(errors.trackingId({ data: { trackingId: 'BODY' } })).toBe('BODY');
      expect(errors.trackingId({ headers: function(name) { return name === 'x-tracking-id' ? 'HEADER' : null; } })).toBe('HEADER');
      expect(errors.trackingId({ config: { headers: { trackingId: 'REQUEST' } } })).toBe('REQUEST');
      expect(errors.trackingId({})).toBeNull();
    });
  });
});
