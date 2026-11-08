describe('QuoteService HTTP contract', function() {
  'use strict';
  var service, backend, root, originalConfig;

  beforeEach(function() {
    originalConfig = window.APP_CONFIG;
    window.APP_CONFIG = angular.extend({}, originalConfig, { contractDownloadUrl: ' /api/documents ' });
    angular.mock.module('quoteManagement', function($provide) {
      $provide.constant('API_BASE_URL', '/api/');
      $provide.factory('AuthService', ['$q', function($q) {
        return { getUser: function() { return { name: 'Synthetic' }; }, isAuthenticated: function() { return true; },
          getReturnUrl: function() { return '/quotes'; }, acquireProxyIdentity: function() { return $q.when(null); } };
      }]);
    });
    angular.mock.inject(function(QuoteService, $httpBackend, $rootScope, $templateCache) {
      service = QuoteService; backend = $httpBackend; root = $rootScope;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
  });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    backend.verifyNoOutstandingExpectation();
    backend.verifyNoOutstandingRequest();
  });

  function tracked(headers) { return /^qm-ui-\d+-[a-z0-9]+$/.test(headers.trackingId); }

  it('lists quotes with the given query and a tracking ID', function() {
    backend.expectGET('/api/quotedata/v1/quote?page=0&size=25&ticketNumber=SUP-1', tracked).respond(200, { content: [] });
    service.getQuotes({ ticketNumber: 'SUP-1', page: 0, size: 25 });
    backend.flush();
    backend.expectGET('/api/quotedata/v1/quote').respond(200, {});
    service.getQuotes();
    backend.flush();
  });

  it('gets one quote by request ID, encoding special characters', function() {
    backend.expectGET('/api/quotedata/v1/quote?quoteRequestId=PARTNER-QUOTE+1%2F2', tracked).respond(200, {});
    service.getQuote('PARTNER-QUOTE 1/2');
    backend.flush();
  });

  it('finds a quote by exactly one trimmed identifier and rejects anything else without a request', function() {
    backend.expectGET('/api/quotedata/v1/quote?externalId=EXT-1').respond(200, {});
    service.findQuote({ externalId: ' EXT-1 ' });
    backend.flush();
    backend.expectGET('/api/quotedata/v1/quote?proposalId=P-1').respond(200, {});
    service.findQuote({ proposalId: 'P-1' });
    backend.flush();
    var rejections = [];
    [{}, null, { externalId: ' ' }, { externalId: 'A', proposalId: 'B' }].forEach(function(criteria) {
      service.findQuote(criteria).catch(function(error) { rejections.push(error.status); });
    });
    root.$digest();
    expect(rejections).toEqual([400, 400, 400, 400]);
  });

  it('completes a quote with only the resolution note', function() {
    backend.expectPOST('/api/quotedata/v1/quote/Q%2F1/complete', { resolutionNote: 'Fixed' }, tracked).respond(200, {});
    service.completeQuote('Q/1', 'Fixed');
    backend.flush();
  });

  it('retries a step with a bodiless POST to the step retry route', function() {
    backend.expectPOST('/api/quotedata/v1/quote/Q%201/steps/42/retry', undefined, tracked).respond(202, {});
    service.retryStep('Q 1', 42);
    backend.flush();
  });

  it('downloads contracts only from a configured URL', function() {
    expect(service.canDownloadContract()).toBe(true);
    backend.expectGET('/api/documents?dmaasId=SOA-1&documentType=SOA').respond(200, 'pdf');
    service.downloadContractByDmaasId('SOA', 'SOA-1');
    backend.flush();
    window.APP_CONFIG.contractDownloadUrl = '  ';
    expect(service.canDownloadContract()).toBe(false);
    var rejected;
    service.downloadContractByDmaasId('SOA', 'SOA-1').catch(function(error) { rejected = error; });
    root.$digest();
    expect(rejected.data.message).toBe('Contract download is not configured.');
  });
});
