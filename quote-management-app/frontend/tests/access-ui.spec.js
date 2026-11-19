describe('Quote page follows the permissions (stories 26558, 26563)', function() {
  'use strict';
  var root, scope, q, compile, service, loads, completions, retries, element, template, originalConfig, granted, isCase;

  beforeAll(function(done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/base/src/app/components/quote-detail/quote-detail.html');
    xhr.onload = function() { template = xhr.responseText; done(); };
    xhr.onerror = function() { done.fail('Cannot load quote detail template'); };
    xhr.send();
  });

  beforeEach(function() { originalConfig = window.APP_CONFIG; });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    if (scope) scope.$destroy();
    if (element) element.remove();
    element = null;
  });

  function fixture() {
    return {
      quoteRequestId: 'Q-ACCESS-1', externalId: 'EXT-1', state: 'FAILED', supportTicketNumber: 'SUP-1', sites: [], contacts: [],
      customerName: 'Synthetic Customer', dmaasIdSoa: 'SOA-1', dmaasIdMsa: 'MSA-1',
      stepExecutions: [
        { id: 1, stepName: 'ADDRESS_VALIDATION', stepStatus: 'SUCCESS' },
        { id: 5, stepName: 'CREATE_PROPOSAL', stepStatus: 'FAILURE' }
      ],
      errorDetails: [], events: []
    };
  }

  // permissions: the list of capability names that are allowed; the fake stands in for AccessService.
  function start(allowed, options) {
    options = options || {};
    granted = allowed;
    isCase = !!options.isCase;
    window.APP_CONFIG = angular.extend({}, originalConfig, { contractDownloadUrl: 'https://download.example/contract', features: { retryEnabled: true } });
    loads = []; completions = []; retries = [];
    service = {
      getQuote: jasmine.createSpy('getQuote').and.callFake(function() { var d = q.defer(); loads.push(d); return d.promise; }),
      completeQuote: jasmine.createSpy('completeQuote').and.callFake(function() { var d = q.defer(); completions.push(d); return d.promise; }),
      retryQuote: jasmine.createSpy('retryQuote').and.callFake(function() { var d = q.defer(); retries.push(d); return d.promise; }),
      canDownloadContract: function() { return true; },
      downloadContractByDmaasId: jasmine.createSpy('downloadContractByDmaasId')
    };
    angular.mock.module('quoteManagement', function($provide) {
      $provide.value('QuoteService', service);
      $provide.value('AccessService', {
        isEnabled: function() { return true; },
        isCase: function() { return isCase; },
        allows: function(name) { return granted.indexOf(name) !== -1 || (name === 'update' && (granted.indexOf('complete') !== -1 || granted.indexOf('edit') !== -1)); }
      });
      $provide.value('AuthService', {
        getUser: function() { return { name: 'Synthetic operator' }; },
        isAuthenticated: function() { return true; },
        getReturnUrl: function() { return '/quotes'; }
      });
    });
    angular.mock.inject(function($rootScope, $q, $compile, $controller, $templateCache) {
      root = $rootScope; q = $q; compile = $compile;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      scope = root.$new();
      scope.canUpdateQuotes = true;
      scope.access = { allows: function(name) { return granted.indexOf(name) !== -1; }, isCase: function() { return isCase; } };
      $controller('QuoteDetailCtrl', { $scope: scope, $routeParams: { id: 'Q-ACCESS-1' } });
    });
    if (options.data !== null) loads[0].resolve({ data: options.data || fixture() });
    root.$digest();
    element = compile('<div>' + template + '</div>')(scope);
    angular.element(document.body).append(element);
    root.$digest();
    return element[0];
  }

  function fail(response) {
    loads[0].reject(response);
    root.$digest();
  }

  describe('buttons', function() {
    it('shows Mark completed and Retry to someone who may complete', function() {
      var page = start(['complete', 'download']);
      expect(page.querySelector('#mark-completed')).not.toBeNull();
      expect(page.querySelector('#retry-quote')).not.toBeNull();
    });

    it('hides both for a read-only role, so the page offers no action the server would refuse', function() {
      var page = start(['download', 'viewAssigned']);
      expect(page.querySelector('#mark-completed')).toBeNull();
      expect(page.querySelector('#retry-quote')).toBeNull();
      scope.openCompleteDialog();
      expect(scope.completeDialogOpen).toBe(false);
      expect(scope.mayComplete()).toBe(false);
    });

    it('lets a role that may edit but not complete retry, but not complete', function() {
      var page = start(['edit']);
      expect(page.querySelector('#retry-quote')).not.toBeNull();
      expect(page.querySelector('#mark-completed')).toBeNull();
      expect(scope.mayRetry()).toBe(true);
      expect(scope.canRetry()).toBe(true);
    });

    it('cannot be talked into completing: the dialog and the submit are closed to a role without Complete', function() {
      start(['download']);
      scope.completeDialogOpen = true;
      scope.completeContext = { plan: { steps: [], blocked: [], tooMany: false } };
      expect(scope.canSubmitComplete()).toBe(false);
      scope.submitComplete();
      expect(service.completeQuote).not.toHaveBeenCalled();
    });

    it('still honours the old gate: nobody who is not signed in can update', function() {
      var page = start(['complete']);
      scope.canUpdateQuotes = false;
      root.$digest();
      expect(scope.mayComplete()).toBe(false);
      expect(page.querySelector('#mark-completed')).toBeNull();
    });
  });

  describe('way back', function() {
    it('links Home from the breadcrumb to someone who may list quotes', function() {
      expect(start(['listAll', 'complete']).querySelector('.qm-breadcrumb a')).not.toBeNull();
    });

    it('shows only the quote in the breadcrumb of someone who may not', function() {
      var page = start(['viewAssigned'], { isCase: true });
      expect(page.querySelector('.qm-breadcrumb a')).toBeNull();
      expect(page.querySelector('.qm-breadcrumb').textContent).toContain('EXT-1');
    });

    it('hides "Back to Home" on a load error for someone who may not list quotes', function() {
      var page = start([], { data: null, isCase: true });
      fail({ status: 403, data: { code: 'QUOTE_SCOPE_DENIED' }, headers: function() { return null; }, config: { headers: {} } });
      expect(Array.prototype.some.call(page.querySelectorAll('.qm-state-panel button'), function(button) { return /Back to Home/.test(button.textContent); })).toBe(false);
    });
  });

  describe('download', function() {
    it('offers the contract and customer downloads to a role that may download', function() {
      var page = start(['download']);
      expect(page.querySelector('.qm-profile-export')).not.toBeNull();
      scope.setTab('contract'); root.$digest();
      expect(scope.canDownloadContract()).toBe(true);
      expect(page.querySelector('#download-not-allowed')).toBeNull();
    });

    it('hides the customer export and explains the contract tab to a role that may not', function() {
      var page = start(['complete']);
      expect(page.querySelector('.qm-profile-export')).toBeNull();
      expect(scope.canExportCustomer()).toBe(false);
      scope.setTab('contract'); root.$digest();
      expect(scope.canDownloadContract()).toBe(false);
      expect(page.querySelector('#download-not-allowed').textContent).toContain('You are not allowed to download documents.');
      expect(page.querySelector('#detail-panel-contract').textContent).not.toContain('no download endpoint');
      scope.downloadContract('SOA');
      expect(service.downloadContractByDmaasId).not.toHaveBeenCalled();
    });
  });

  describe('load errors in the epic\'s words, each with its tracking id', function() {
    function errorOf(page) { return page.querySelector('#quote-load-error').textContent.replace(/\s+/g, ' ').trim(); }
    function failWith(status, data) {
      var page = start([], { data: null });
      fail({ status: status, data: data, headers: function() { return null; }, config: { headers: {} } });
      return page;
    }

    it('says a quote outside the person\'s scope is out of reach, without ever showing the quote ID', function() {
      var page = failWith(403, { code: 'QUOTE_SCOPE_DENIED', message: 'Access denied', trackingId: 'TRACE-SCOPE' });
      expect(page.querySelector('.qm-state-panel h1').textContent).toBe('Access denied');
      expect(errorOf(page)).toContain('You do not have access to this quote. Contact your Sales Support lead if you believe this is an error.');
      expect(errorOf(page)).toContain('Tracking ID: TRACE-SCOPE');
      expect(page.querySelector('.qm-state-panel').textContent).not.toContain('Q-ACCESS-1');
    });

    it('says a missing role is a missing role', function() {
      var page = failWith(403, { code: 'ROLE_MISSING', trackingId: 'TRACE-ROLE' });
      expect(errorOf(page)).toContain('You do not have an OMW role. Request access in myComcastAccess.');
      expect(errorOf(page)).toContain('TRACE-ROLE');
    });

    it('says the service is unavailable and still offers another try', function() {
      var page = failWith(503, { trackingId: 'TRACE-503' });
      expect(errorOf(page)).toContain('Unable to load quote details. The service is temporarily unavailable. Try again shortly.');
      expect(Array.prototype.some.call(page.querySelectorAll('.qm-state-panel button'), function(button) { return /Try loading again/.test(button.textContent); })).toBe(true);
    });

    it('says an expired Dynamics case has to be reopened, with no retry button', function() {
      var page = failWith(401, { code: 'GUID_EXPIRED', trackingId: 'TRACE-401' });
      expect(errorOf(page)).toContain('Session expired. Reopen the case from Dynamics.');
      expect(Array.prototype.some.call(page.querySelectorAll('.qm-state-panel button'), function(button) { return /Try loading again/.test(button.textContent); })).toBe(false);
    });

    it('keeps the old wording for answers the epic does not name', function() {
      var denied = failWith(403, { code: 'UPSTREAM_FORBIDDEN', message: 'Forbidden', trackingId: 'T' });
      expect(denied.querySelector('.qm-state-panel h1').textContent).toBe('Access denied');
      expect(errorOf(denied)).toContain('Ask an administrator for access to this quote.');
    });
  });

  describe('refused actions', function() {
    it('says "You are not allowed to perform this action." when Complete is refused for permission', function() {
      start(['complete']);
      scope.openCompleteDialog(); root.$digest();
      scope.submitComplete(); root.$digest();
      completions[0].reject({ status: 403, data: { code: 'ACTION_NOT_ALLOWED', trackingId: 'TRACE-A' }, headers: function() { return null; }, config: { headers: {} } });
      root.$digest();
      expect(scope.completeError).toBe('You are not allowed to perform this action.');
      expect(scope.completeTrackingId).toBe('TRACE-A');
    });

    it('says the same when Retry is refused, and the service message when it is down', function() {
      start(['complete']);
      scope.openRetryDialog(); root.$digest();
      scope.submitRetry(); root.$digest();
      retries[0].reject({ status: 403, data: { code: 'ACTION_NOT_ALLOWED' }, headers: function() { return null; }, config: { headers: {} } });
      root.$digest();
      expect(scope.retry.error).toBe('You are not allowed to perform this action.');
      scope.submitRetry(); root.$digest();
      retries[1].reject({ status: 503, data: {}, headers: function() { return null; }, config: { headers: {} } });
      root.$digest();
      expect(scope.retry.error).toBe('The service is temporarily unavailable. Try again shortly.');
    });
  });
});
