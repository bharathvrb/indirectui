describe('Dynamics launch, no-access screens and sign-in fallback (stories 26559, 26562, 26564)', function() {
  'use strict';
  var originalConfig, originalLocal, bridge, backend, timeout, root, location, injectorGet, warn;
  var CRM = 'https://crm.example.com', CRM2 = 'https://crm-int.example.com';
  var GUID = 'g1d-0123456789abcdef0123456789abcdef', TOKEN = 'handshake.token-0123456789abcdef';
  var INIT = '/api/quotemgmt/v1/initialize', PERMS = '/api/quotemgmt/v1/me/permissions';

  function makeBridge(options) {
    options = options || {};
    var made = {
      calls: [], handlers: [], parent: { name: 'dynamics-window' }, stopped: false,
      isFramed: function() { return options.framed !== false; },
      parentWindow: function() { return made.parent; },
      parentOrigin: function() { return options.parentOrigin || null; },
      post: jasmine.createSpy('post').and.callFake(function(message, origin) { made.calls.push(['post', origin, message]); }),
      listen: jasmine.createSpy('listen').and.callFake(function(handler) {
        made.calls.push(['listen']);
        made.handlers.push(handler);
        return function() { made.stopped = true; made.handlers = made.handlers.filter(function(item) { return item !== handler; }); };
      }),
      open: jasmine.createSpy('open').and.returnValue(true)
    };
    return made;
  }
  function deliver(origin, data, source) {
    bridge.handlers.slice().forEach(function(handler) {
      handler({ origin: origin, data: data, source: source === undefined ? bridge.parent : source });
    });
  }
  function handshake(extra) {
    return angular.extend({ code: 'HANDSHAKE', sourceSystem: 'cbsales_crm', details: { guid: GUID, token: TOKEN } }, extra || {});
  }

  function boot(options) {
    options = options || {};
    window.APP_CONFIG = angular.extend({}, originalConfig, {
      access: { enabled: options.access !== false },
      embed: angular.extend({ enabled: true, dynamicsOrigins: [CRM, CRM2], sourceSystem: 'OMW_UI', initializeUrl: INIT, handshakeTimeoutMs: 10000 }, options.embed || {})
    });
    bridge = makeBridge(options.bridge);
    if (options.signedIn) {
      window.__localAuth = { enabled: true, authenticated: true, user: { name: 'Synthetic', username: 'synthetic', authType: 'local' }, expiresAt: Date.now() + 3600000 };
    }
    angular.mock.module('quoteManagement', function($provide, $controllerProvider) {
      $provide.value('FrameBridge', bridge);
      ['QuoteListCtrl', 'QuoteDetailCtrl', 'SupportTicketsCtrl', 'LoginCtrl'].forEach(function(name) { $controllerProvider.register(name, function() {}); });
    });
    angular.mock.inject(function($httpBackend, $timeout, $rootScope, $location, $templateCache, $injector) {
      backend = $httpBackend; timeout = $timeout; root = $rootScope; location = $location; injectorGet = function(name) { return $injector.get(name); };
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets', 'access/access', 'embed/embed'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
  }

  beforeEach(function() {
    originalConfig = window.APP_CONFIG;
    originalLocal = window.__localAuth;
    warn = spyOn(console, 'warn');
  });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    window.__localAuth = originalLocal;
    if (backend) { backend.verifyNoOutstandingExpectation(); backend.verifyNoOutstandingRequest(); }
    backend = null;
  });

  describe('handshake service', function() {
    var states, run;
    function begin() {
      states = [];
      run = injectorGet('EmbedService').start(function(state) { states.push(state); });
    }
    function phases() { return states.map(function(state) { return state.phase; }); }
    function last() { return states[states.length - 1]; }

    describe('before the handshake', function() {
      beforeEach(function() { boot(); });
      afterEach(function() { if (run) run.cancel(); });

      it('registers the listener first, then sends READY to every allowed origin when it cannot tell which framed it, never to *', function() {
        begin();
        expect(bridge.calls.map(function(call) { return call[0]; }).slice(0, 3)).toEqual(['listen', 'post', 'post']);
        expect(bridge.calls.filter(function(call) { return call[0] === 'post'; }).map(function(call) { return call[1]; })).toEqual([CRM, CRM2]);
        expect(bridge.calls[1][2]).toEqual({ code: 'READY', sourceSystem: 'OMW_UI' });
        expect(JSON.stringify(bridge.calls)).not.toContain('"*"');
        expect(phases()).toEqual(['waiting']);
      });

      it('sends READY again every two seconds until the answer comes or the time runs out', function() {
        begin();
        expect(bridge.post.calls.count()).toBe(2);
        timeout.flush(2000);
        expect(bridge.post.calls.count()).toBe(4);
        timeout.flush(2000);
        expect(bridge.post.calls.count()).toBe(6);
      });

      it('fails with a clear message when no handshake arrives in time, and stops listening', function() {
        begin();
        timeout.flush(10000);
        expect(last()).toEqual(jasmine.objectContaining({ phase: 'failed', kind: 'timeout', message: 'The case did not send its quote. Reopen the case from Dynamics.' }));
        expect(bridge.stopped).toBe(true);
        timeout.verifyNoPendingTasks();
      });

      it('can be cancelled by the screen, which stops the listener and the timers', function() {
        begin();
        run.cancel();
        expect(bridge.stopped).toBe(true);
        timeout.verifyNoPendingTasks();
      });

      it('ignores messages from another origin, another window, another code or another shape, and logs only the origin', function() {
        begin();
        deliver('https://evil.example', handshake());
        deliver(CRM, handshake(), { name: 'some-other-window' });
        deliver(CRM, handshake({ code: 'READY' }));
        deliver(CRM, handshake({ sourceSystem: 'other_system' }));
        deliver(CRM, { code: 'HANDSHAKE', sourceSystem: 'cbsales_crm' });
        deliver(CRM, handshake({ details: { guid: 'has spaces and !', token: TOKEN } }));
        deliver(CRM, handshake({ details: { guid: GUID, token: 5 } }));
        deliver(CRM, 'text'); deliver(CRM, null); deliver(CRM, 42);
        expect(phases()).toEqual(['waiting']);
        expect(JSON.stringify(warn.calls.allArgs())).toContain('https://evil.example');
        expect(JSON.stringify(warn.calls.allArgs())).not.toContain(GUID);
        expect(JSON.stringify(warn.calls.allArgs())).not.toContain(TOKEN);
      });

      it('recognises only the exact handshake shape', function() {
        var embed = injectorGet('EmbedService');
        expect(embed.isHandshake(handshake())).toBe(true);
        expect(embed.isHandshake(handshake({ code: 'handshake' }))).toBe(false);
        expect(embed.isHandshake(handshake({ details: null }))).toBe(false);
        expect(embed.isHandshake({})).toBe(false);
      });
    });

    describe('which origin gets READY', function() {
      it('is only the origin the browser names as the parent, when that origin is allowed', function() {
        boot({ bridge: { parentOrigin: CRM2 } });
        begin();
        expect(bridge.post.calls.allArgs().map(function(args) { return args[1]; })).toEqual([CRM2]);
        run.cancel();
      });

      it('is every allowed origin when the named parent is not on the list', function() {
        boot({ bridge: { parentOrigin: 'https://evil.example' } });
        begin();
        expect(bridge.post.calls.allArgs().map(function(args) { return args[1]; })).toEqual([CRM, CRM2]);
        run.cancel();
      });
    });

    describe('with a valid handshake', function() {
      beforeEach(function() { boot(); begin(); });

      function acceptInitialize(body) {
        backend.expectPOST(INIT, { guid: GUID }, function(headers) {
          return headers.Authorization === 'Bearer ' + TOKEN && /^qm-ui-/.test(headers.trackingId);
        }).respond(200, body || { quoteRequestId: 'Q-CASE-1', access: 'READ', expiresInSeconds: 900 });
      }

      it('trades the GUID for a one-quote session, loads the permissions and opens that quote without the GUID in any address', function() {
        acceptInitialize();
        backend.expectGET(PERMS).respond(200, { sessionType: 'CASE', quoteRequestId: 'Q-CASE-1', permissions: ['VIEW_ASSIGNED_QUOTE', 'DOWNLOAD_QUOTE'] });
        deliver(CRM, handshake());
        root.$digest();
        expect(phases()).toEqual(['waiting', 'initializing']);
        backend.flush();
        root.$digest();
        expect(phases()).toEqual(['waiting', 'initializing', 'done']);
        expect(location.path()).toBe('/quotes/Q-CASE-1');
        expect(location.url()).not.toContain(GUID);
        expect(location.url()).not.toContain(TOKEN);
        expect(injectorGet('AuthService').isCaseSession()).toBe(true);
        expect(injectorGet('AuthService').getUser().authType).toBe('case');
        expect(injectorGet('AccessService').isCase()).toBe(true);
        expect(bridge.stopped).toBe(true);
        var sent = bridge.post.calls.count();
        timeout.flush(30000);
        expect(bridge.post.calls.count()).toBe(sent);
        expect(phases()).toEqual(['waiting', 'initializing', 'done']);
      });

      it('uses the first handshake only: a repeat or a later one starts nothing new', function() {
        acceptInitialize();
        backend.expectGET(PERMS).respond(200, { sessionType: 'CASE', quoteRequestId: 'Q-CASE-1', permissions: ['VIEW_ASSIGNED_QUOTE'] });
        deliver(CRM, handshake());
        deliver(CRM, handshake());
        deliver(CRM2, handshake());
        root.$digest();
        backend.flush();
      });

      [
        [401, { code: 'GUID_USED', trackingId: 'T-G' }, 'case-session', 'Session expired. Reopen the case from Dynamics.', 'T-G'],
        [401, { code: 'GUID_EXPIRED' }, 'case-session', 'Session expired. Reopen the case from Dynamics.', null],
        [401, { code: 'GUID_INVALID' }, 'case-session', 'Session expired. Reopen the case from Dynamics.', null],
        [401, { code: 'TOKEN_INVALID' }, 'case-session', 'Session expired. Reopen the case from Dynamics.', null],
        [403, { code: 'ROLE_MISSING', trackingId: 'T-R' }, 'role', 'You do not have an OMW role. Request access in myComcastAccess.', 'T-R'],
        [503, { code: 'SERVICE_UNAVAILABLE' }, 'unavailable', 'The service is temporarily unavailable. Try again shortly.', null],
        [500, null, 'invalid', 'The quote could not be opened. Reopen the case from Dynamics.', null]
      ].forEach(function(entry) {
        it('explains a ' + entry[0] + ' ' + (entry[1] && entry[1].code) + ' answer to Initialize and signs nobody in', function() {
          backend.expectPOST(INIT).respond(entry[0], entry[1]);
          deliver(CRM, handshake());
          root.$digest();
          backend.flush();
          expect(last()).toEqual(jasmine.objectContaining({ phase: 'failed', kind: entry[2], message: entry[3] }));
          // With no tracking id from the server, the one this page sent is shown, so support can still find the call.
          if (entry[4]) expect(last().trackingId).toBe(entry[4]); else expect(last().trackingId).toMatch(/^qm-ui-/);
          expect(injectorGet('AuthService').isCaseSession()).toBe(false);
          expect(bridge.stopped).toBe(true);
        });
      });

      [{}, { quoteRequestId: 5 }, { quoteRequestId: 'bad id!' }, { quoteRequestId: '' }, null].forEach(function(body) {
        it('rejects an Initialize answer without a usable quote ID (' + JSON.stringify(body) + ')', function() {
          backend.expectPOST(INIT).respond(200, body);
          deliver(CRM, handshake());
          root.$digest();
          backend.flush();
          expect(last()).toEqual(jasmine.objectContaining({ phase: 'failed', kind: 'invalid' }));
          expect(location.path()).not.toContain('/quotes/');
        });
      });
    });

    describe('when it is not set up', function() {
      it('says so at once and listens for nothing', function() {
        boot({ embed: { dynamicsOrigins: [] } });
        begin();
        expect(last()).toEqual(jasmine.objectContaining({ phase: 'failed', kind: 'not-configured', message: 'Opening a quote from Dynamics is not set up yet. Contact your administrator.' }));
        expect(bridge.listen).not.toHaveBeenCalled();
        expect(bridge.post).not.toHaveBeenCalled();
      });

      it('never sends the handshake token to another site: the Initialize address must be on this origin', function() {
        boot({ embed: { initializeUrl: 'https://elsewhere.example/api/initialize' } });
        expect(injectorGet('EmbedService').isConfigured()).toBe(false);
        begin();
        expect(last().kind).toBe('not-configured');
      });

      it('accepts an Initialize address on this origin, relative or absolute', function() {
        boot({ embed: { initializeUrl: window.location.origin + '/api/quotemgmt/v1/initialize' } });
        expect(injectorGet('EmbedService').isConfigured()).toBe(true);
      });

      it('rejects origins that are not exact (a path, a wildcard, the string null)', function() {
        boot({ embed: { dynamicsOrigins: ['https://crm.example.com/path', 'https://*.example.com', 'null', 'not a url', 5] } });
        expect(injectorGet('EmbedService').isConfigured()).toBe(false);
      });
    });
  });

  describe('Open-from-Dynamics screen', function() {
    var template;
    beforeAll(function(done) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/base/src/app/components/embed/embed.html');
      xhr.onload = function() { template = xhr.responseText; done(); };
      xhr.send();
    });

    function controller(options) {
      boot(options);
      var scope = root.$new();
      angular.mock.inject(function($controller) { $controller('EmbedCtrl', { $scope: scope }); });
      return scope;
    }
    function render(scope) {
      var element;
      angular.mock.inject(function($compile) { element = $compile('<div>' + template + '</div>')(scope); });
      root.$digest();
      return element[0];
    }

    it('says "Open this quote from Dynamics" when the page is opened on its own', function() {
      var scope = controller({ bridge: { framed: false } });
      var page = render(scope);
      expect(scope.phase).toBe('open-from-dynamics');
      expect(page.querySelector('#embed-title').textContent).toBe('Open this quote from Dynamics');
      expect(bridge.listen).not.toHaveBeenCalled();
    });

    it('says the same when the feature is off, even inside a frame', function() {
      var scope = controller({ embed: { enabled: false } });
      expect(scope.phase).toBe('open-from-dynamics');
    });

    it('runs the handshake when framed and shows each step, then a failure with its tracking id and a way to try again', function() {
      var scope = controller();
      var page = render(scope);
      expect(scope.phase).toBe('waiting');
      expect(page.querySelector('#embed-title').textContent).toBe('Opening your quote');
      expect(page.querySelector('#embed-retry')).toBeNull();
      backend.expectPOST(INIT).respond(401, { code: 'GUID_USED', trackingId: 'TRACE-9' });
      deliver(CRM, handshake());
      root.$digest();
      backend.flush();
      expect(scope.phase).toBe('failed');
      expect(page.querySelector('#embed-title').textContent).toBe('This quote could not be opened');
      expect(page.querySelector('#embed-message').textContent).toBe('Session expired. Reopen the case from Dynamics.');
      expect(page.textContent).toContain('TRACE-9');
      expect(page.querySelector('#embed-retry')).not.toBeNull();
      scope.begin();
      expect(scope.phase).toBe('waiting');
      scope.$destroy();
      var sent = bridge.post.calls.count();
      timeout.flush(30000);
      expect(bridge.post.calls.count()).toBe(sent);
    });

    it('stops the handshake when the person leaves the screen', function() {
      var scope = controller();
      scope.$destroy();
      expect(bridge.stopped).toBe(true);
    });
  });

  describe('no-access screen', function() {
    var template;
    beforeAll(function(done) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/base/src/app/components/access/access.html');
      xhr.onload = function() { template = xhr.responseText; done(); };
      xhr.send();
    });

    function open(reason, accessConfig) {
      boot({ access: true, signedIn: true });
      window.APP_CONFIG.access = angular.extend({ enabled: true }, accessConfig || {});
      location.url('/no-access' + (reason ? '?reason=' + reason : ''));
      var scope = root.$new();
      var element;
      angular.mock.inject(function($controller, $compile) {
        $controller('AccessCtrl', { $scope: scope });
        element = $compile('<div>' + template + '</div>')(scope);
      });
      root.$digest();
      return { scope: scope, page: element[0] };
    }

    it('tells a person with no OMW role what to do, in the epic\'s words', function() {
      var screen = open('role');
      expect(screen.page.querySelector('#access-message').textContent).toBe('You do not have access. Request an OMW role in myComcastAccess.');
      expect(screen.page.querySelector('#check-again')).not.toBeNull();
      expect(screen.page.querySelector('#request-role')).toBeNull();
    });

    it('links to the role request page when one is configured', function() {
      var screen = open('role', { requestRoleUrl: 'https://access.example/request' });
      expect(screen.page.querySelector('#request-role').getAttribute('href')).toBe('https://access.example/request');
    });

    [
      ['quote', 'Access denied', 'You do not have access to this quote. Contact your Sales Support lead if you believe this is an error.'],
      ['session', 'Session expired', 'Session expired. Reopen the case from Dynamics.'],
      ['unavailable', 'Service unavailable', 'The service is temporarily unavailable. Try again shortly.'],
      ['denied', 'Access denied', 'You are not allowed to perform this action.'],
      ['anything-else', 'Access denied', 'You are not allowed to perform this action.'],
      [null, 'Access denied', 'You are not allowed to perform this action.']
    ].forEach(function(entry) {
      it('shows "' + entry[1] + '" for reason ' + entry[0], function() {
        var screen = open(entry[0]);
        expect(screen.page.querySelector('#access-title').textContent).toBe(entry[1]);
        expect(screen.page.querySelector('#access-message').textContent).toBe(entry[2]);
      });
    });

    it('offers Check again only where waiting can help, and moves on when the permissions arrive', function() {
      var screen = open('role');
      backend.expectGET(PERMS).respond(200, { sessionType: 'DIRECT', quoteRequestId: null, permissions: ['LIST_ALL_QUOTES', 'VIEW_ANY_QUOTE'] });
      screen.scope.checkAgain();
      expect(screen.scope.checking).toBe(true);
      backend.flush();
      expect(screen.scope.checking).toBe(false);
      expect(location.url()).toBe('/quotes');
    });

    it('does not offer Check again for a quote that is out of scope', function() {
      expect(open('quote').page.querySelector('#check-again')).toBeNull();
    });

    it('stays on the screen, with its tracking id, when the role is still missing', function() {
      var screen = open('role');
      backend.expectGET(PERMS).respond(403, { code: 'ROLE_MISSING', trackingId: 'TRACE-NO-ROLE' });
      screen.scope.checkAgain();
      backend.flush();
      root.$digest();
      expect(location.path()).toBe('/no-access');
      expect(screen.page.textContent).toContain('TRACE-NO-ROLE');
    });

    it('offers sign-out to a signed-in person, but no way back while no page is known to be allowed', function() {
      var screen = open('quote');
      expect(screen.page.querySelector('#access-back')).toBeNull();
      expect(screen.page.querySelector('#access-signout')).not.toBeNull();
    });

    it('offers neither sign-out nor a way elsewhere inside a Dynamics case: the case has to be reopened', function() {
      boot({ access: true });
      injectorGet('AuthService').setCaseSession({ quoteRequestId: 'Q-CASE-1' });
      backend.expectGET(PERMS).respond(200, { sessionType: 'CASE', quoteRequestId: 'Q-CASE-1', permissions: ['VIEW_ASSIGNED_QUOTE'] });
      injectorGet('AccessService').load();
      backend.flush();
      location.url('/no-access?reason=session');
      var scope = root.$new(), element;
      angular.mock.inject(function($controller, $compile) {
        $controller('AccessCtrl', { $scope: scope });
        element = $compile('<div>' + template + '</div>')(scope);
      });
      root.$digest();
      expect(element[0].querySelector('#access-message').textContent).toBe('Session expired. Reopen the case from Dynamics.');
      expect(element[0].querySelector('#access-signout')).toBeNull();
      expect(scope.landing).toBe('/quotes/Q-CASE-1');
    });
  });

  describe('Continue sign-in in a new window (story 26564)', function() {
    var loginController;
    beforeEach(function() {
      // Register the real controller under another name by reading the source function through the module's invoke queue.
      var queue = angular.module('quoteManagement')._invokeQueue.filter(function(item) { return item[2][0] === 'LoginCtrl'; });
      loginController = queue[queue.length - 1][2][1];
    });
    function build(options) {
      boot(options);
      var scope = root.$new();
      angular.mock.inject(function($injector) { $injector.invoke(loginController, null, { $scope: scope }); });
      return scope;
    }

    it('is off for ordinary visitors, even in a frame, so the usual buttons stay', function() {
      var scope = build({ embed: { enabled: false } });
      expect(scope.framed).toBe(false);
    });

    it('is on when Dynamics launch is enabled and the page is framed', function() {
      expect(build().framed).toBe(true);
    });

    it('is off when the page is not framed', function() {
      expect(build({ bridge: { framed: false } }).framed).toBe(false);
    });

    it('opens this site\'s sign-in page in a top-level window from the click, with no GUID or token in the address', function() {
      var scope = build();
      scope.openSignInWindow();
      expect(bridge.open).toHaveBeenCalledTimes(1);
      var url = bridge.open.calls.mostRecent().args[0];
      expect(url).toBe(window.location.origin + '/#!/login');
      expect(url).not.toMatch(/guid|token/i);
      expect(scope.signInWindowOpened).toBe(true);
      expect(scope.popupBlocked).toBe(false);
    });

    it('says so when the browser blocks the new window', function() {
      var scope = build();
      bridge.open.and.returnValue(false);
      scope.openSignInWindow();
      expect(scope.popupBlocked).toBe(true);
      expect(scope.signInWindowOpened).toBe(false);
    });

    it('checks for the new sign-in and returns to where the person was going', function() {
      var scope = build({ signedIn: true });
      scope.signInWindowOpened = true;
      backend.expectGET(PERMS).respond(200, { sessionType: 'DIRECT', quoteRequestId: null, permissions: ['LIST_ALL_QUOTES'] });
      scope.checkSignedIn();
      expect(scope.checkingSignIn).toBe(true);
      backend.flush();
      expect(scope.checkingSignIn).toBe(false);
      expect(location.url()).toBe('/quotes');
    });

    it('tells the person to finish signing in when nothing is there yet', function() {
      var scope = build();
      backend.expectGET(PERMS).respond(401, { code: 'SESSION_INVALID' });
      scope.checkSignedIn();
      backend.flush();
      expect(scope.authError).toContain('Finish signing in in the other window');
    });
  });

  describe('AuthService in a Dynamics case, and the new-window address', function() {
    var auth;
    beforeEach(function() {
      boot();
      auth = injectorGet('AuthService');
    });

    it('treats a case session as signed in without a token of its own, and never offers a sign-in', function() {
      expect(auth.isAuthenticated()).toBe(false);
      auth.setCaseSession({ quoteRequestId: 'Q-CASE-1' });
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.isCaseSession()).toBe(true);
      expect(auth.getUser()).toEqual({ name: 'Dynamics case', username: '', authType: 'case' });
      var token = 'unset';
      auth.acquireProxyIdentity().then(function(value) { token = value; });
      root.$digest();
      expect(token).toBeNull();
      auth.requireLogin('session-expired');
      expect(location.url()).toBe('/no-access?reason=session');
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.isCaseSession()).toBe(false);
    });

    it('signing out of a case goes to the "reopen the case" message', function() {
      auth.setCaseSession({ quoteRequestId: 'Q-CASE-1' });
      auth.logout();
      root.$digest();
      expect(location.url()).toBe('/no-access?reason=session');
    });

    [
      [undefined, window.location.origin + '/#!/login'],
      ['', window.location.origin + '/#!/login'],
      ['https://signin.example.com/omw-ui/quotes', 'https://signin.example.com/omw-ui/quotes'],
      ['http://signin.example.com/omw-ui/quotes', window.location.origin + '/#!/login'],
      ['javascript:alert(1)', window.location.origin + '/#!/login'],
      ['/start', window.location.origin + '/start']
    ].forEach(function(entry) {
      it('uses ' + JSON.stringify(entry[0]) + ' as ' + entry[1], function() {
        window.APP_CONFIG.signIn = { newWindowUrl: entry[0] };
        expect(auth.newWindowSignInUrl()).toBe(entry[1]);
      });
    });
  });
});
