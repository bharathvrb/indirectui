describe('Motion helpers', function() {
  'use strict';

  function seedRoutes($templateCache) {
    ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
      $templateCache.put('app/components/' + path + '.html', '<div></div>');
    });
  }

  describe('progress bar request counter', function() {
    var previous, root, backend, quoteService;

    beforeEach(function() {
      previous = { local: window.__localAuth, error: window.__localAuthError, instance: window.__msalInstance, config: window.AUTH_CONFIG };
      window.__msalInstance = { getActiveAccount: function() { return null; }, acquireTokenSilent: jasmine.createSpy('t'), loginRedirect: function() {}, logoutRedirect: function() {} };
      window.__localAuthError = null;
      window.__localAuth = { enabled: true, authenticated: true, user: { name: 'Fixture', username: 'fixture', authType: 'local' }, expiresAt: Date.now() + 3600000 };
      window.AUTH_CONFIG = { clientId: 'c', tenantId: 't', loginScopes: ['openid'] };
      angular.mock.module('quoteManagement', function($controllerProvider) {
        ['QuoteListCtrl', 'QuoteDetailCtrl', 'SupportTicketsCtrl'].forEach(function(name) { $controllerProvider.register(name, function() {}); });
      });
      angular.mock.inject(function($rootScope, $httpBackend, QuoteService, $templateCache) {
        root = $rootScope; backend = $httpBackend; quoteService = QuoteService; seedRoutes($templateCache);
      });
    });

    afterEach(function() {
      window.__localAuth = previous.local; window.__localAuthError = previous.error;
      window.__msalInstance = previous.instance; window.AUTH_CONFIG = previous.config;
    });

    it('starts at zero, counts requests in flight and returns to zero on success or failure', function() {
      root.$digest();
      expect(root.pendingRequests).toBe(0);
      backend.expectGET('/api/quotedata/v1/quote?quoteRequestId=A').respond(200, {});
      backend.expectGET('/api/quotedata/v1/quote?quoteRequestId=B').respond(500, {});
      quoteService.getQuote('A');
      quoteService.getQuote('B').catch(function() {});
      root.$digest();
      expect(root.pendingRequests).toBe(2);
      backend.flush(1);
      expect(root.pendingRequests).toBe(1);
      backend.flush();
      expect(root.pendingRequests).toBe(0);
    });

    it('never goes below zero and ignores requests that are not QuoteData calls', function() {
      angular.mock.inject(function(AuthInterceptor) {
        AuthInterceptor.response({ config: { qmTracked: true } });
        AuthInterceptor.responseError({ config: { qmTracked: true } }).catch(function() {});
        AuthInterceptor.response({ config: {} });
        AuthInterceptor.responseError({}).catch(function() {});
      });
      root.$digest();
      expect(root.pendingRequests).toBe(0);
      backend.expectGET('app/components/other.html').respond(200, '');
      angular.mock.inject(function($http) { $http.get('app/components/other.html'); });
      root.$digest();
      expect(root.pendingRequests).toBe(0);
      backend.flush();
      expect(root.pendingRequests).toBe(0);
    });
  });

  describe('qmPointerGlow directive', function() {
    var scope, compile, root, host, frames, matches;

    beforeEach(function() {
      matches = {};
      frames = [];
      spyOn(window, 'matchMedia').and.callFake(function(query) { return { matches: !!matches[query] }; });
      spyOn(window, 'requestAnimationFrame').and.callFake(function(callback) { frames.push(callback); return frames.length; });
      spyOn(window, 'cancelAnimationFrame');
      angular.mock.module('quoteManagement');
      angular.mock.inject(function($rootScope, $compile, $templateCache) {
        root = $rootScope; compile = $compile; seedRoutes($templateCache);
      });
      scope = root.$new();
    });

    function mount() {
      host = compile('<main qm-pointer-glow><div class="qm-start-card"><span class="inner">x</span></div><p class="plain">y</p></main>')(scope)[0];
      document.body.appendChild(host);
      root.$digest();
      return host;
    }
    afterEach(function() { if (host && host.parentNode) host.parentNode.removeChild(host); });

    function move(node, x, y) {
      node.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
    }

    it('publishes the pointer position to the hovered card, once per animation frame', function() {
      mount();
      var card = host.querySelector('.qm-start-card');
      var box = card.getBoundingClientRect();
      move(host.querySelector('.inner'), box.left + 12, box.top + 7);
      move(host.querySelector('.inner'), box.left + 20, box.top + 9);
      expect(frames.length).toBe(1);
      frames[0]();
      expect(card.style.getPropertyValue('--mx')).toBe('20px');
      expect(card.style.getPropertyValue('--my')).toBe('9px');
      frames[0]();
    });

    it('ignores movement over anything that is not a card', function() {
      mount();
      move(host.querySelector('.plain'), 5, 5);
      expect(frames.length).toBe(0);
    });

    it('does nothing for reduced motion or touch screens', function() {
      matches['(prefers-reduced-motion: reduce)'] = true;
      mount();
      move(host.querySelector('.inner'), 5, 5);
      expect(frames.length).toBe(0);
      host.parentNode.removeChild(host);
      matches = { '(hover: none)': true };
      mount();
      move(host.querySelector('.inner'), 5, 5);
      expect(frames.length).toBe(0);
    });

    it('stops listening and cancels a pending frame when its scope is destroyed', function() {
      mount();
      move(host.querySelector('.inner'), 5, 5);
      scope.$destroy();
      expect(window.cancelAnimationFrame).toHaveBeenCalled();
      var before = frames.length;
      move(host.querySelector('.inner'), 9, 9);
      expect(frames.length).toBe(before);
    });
  });
});
