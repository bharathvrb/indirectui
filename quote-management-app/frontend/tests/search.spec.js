describe('Unified quote search workspace', function() {
  'use strict';
  var root, location, timeout, q, controller, componentController, compile, service, view, scope;
  var requests, element, templates = {}, originalConfig;
  var templatePaths = [
    'app/components/shared/quote-table.html',
    'app/components/quote-list/quote-list.html',
    'app/components/support-tickets/support-tickets.html'
  ];

  beforeAll(function(done) {
    var pending = templatePaths.length;
    templatePaths.forEach(function(path) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/base/src/' + path);
      xhr.onload = function() {
        if (xhr.status !== 200) { done.fail('Cannot load test template: ' + path); return; }
        templates[path] = xhr.responseText;
        if (!--pending) done();
      };
      xhr.onerror = function() { done.fail('Cannot load test template: ' + path); };
      xhr.send();
    });
  });

  beforeEach(function() {
    try { localStorage.removeItem('omw-recent-searches'); } catch (error) { /* storage unavailable */ }
    originalConfig = window.APP_CONFIG;
    window.APP_CONFIG = angular.extend({}, window.APP_CONFIG, { quoteDataLookupOnly: false });
    requests = [];
    service = {
      getQuotes: jasmine.createSpy('getQuotes').and.callFake(function(params) {
        var deferred = q.defer();
        requests.push({ params: angular.copy(params), deferred: deferred });
        return deferred.promise;
      }),
      getQuote: jasmine.createSpy('getQuote').and.callFake(function(quoteRequestId) {
        var deferred = q.defer();
        requests.push({ params: { quoteRequestId: quoteRequestId }, deferred: deferred });
        return deferred.promise;
      }),
      findQuote: jasmine.createSpy('findQuote').and.callFake(function(criteria) {
        var deferred = q.defer();
        requests.push({ params: angular.copy(criteria), deferred: deferred });
        return deferred.promise;
      })
    };
    angular.mock.module('quoteManagement', function($provide) {
      $provide.value('QuoteService', service);
      $provide.value('AuthService', {
        getUser: function() { return { name: 'Test user' }; },
        isAuthenticated: function() { return true; },
        getReturnUrl: function() { return '/quotes'; }
      });
    });
    angular.mock.inject(function($rootScope, $location, $timeout, $q, $controller, $componentController, $compile, $templateCache, QuoteViewService) {
      root = $rootScope;
      location = $location;
      timeout = $timeout;
      q = $q;
      controller = $controller;
      componentController = $componentController;
      compile = $compile;
      view = QuoteViewService;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      $templateCache.put(templatePaths[0], templates[templatePaths[0]]);
    });
  });

  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    if (scope && !scope.$$destroyed) scope.$destroy();
    if (element) element.remove();
    element = null;
    scope = null;
  });

  // Home (/quotes) shows the default list; the search features live on /search. Specs for lookup-only
  // deployments and for typing in the search box therefore start on /search.
  // route: pass {} to run the controller with no page mode, which shows the search box and the filters together.
  function start(name, url, route) {
    location.url(url || (window.APP_CONFIG.quoteDataLookupOnly ? '/search' : '/quotes'));
    root.$digest();
    scope = root.$new();
    controller(name || 'QuoteListCtrl', route ? { $scope: scope, $route: route } : { $scope: scope });
    root.$digest();
  }

  function resolve(index, rows, extra) {
    var params = requests[index].params;
    requests[index].deferred.resolve({
      data: angular.extend({
        content: rows || [],
        totalElements: rows && rows.length ? params.page * params.size + rows.length : 0,
        totalPages: rows && rows.length ? params.page + 1 : 0,
        page: params.page,
        size: params.size
      }, extra || {})
    });
    root.$digest();
  }

  function renderTable() {
    element = compile('<quote-table rows="quotes" loading="loading" error="error" tracking-id="trackingId" ready="dataReady" ' +
      'current-page="currentPage" total-pages="totalPages" total-elements="totalElements" page-size="pageSize" ' +
      'on-page="goToPage(page)" on-retry="refresh()"></quote-table>')(scope);
    root.$digest();
    return element[0];
  }

  it('uses the confirmed default server page and newest-created ordering once', function() {
    start();
    expect(requests.length).toBe(1);
    expect(requests[0].params).toEqual({ page: 0, size: 25, sort: 'createdAt,desc' });
    expect(scope.loading).toBe(true);
    expect(scope.totalElements).toBeNull();
  });

  it('does not request an unsupported unfiltered list in lookup-only deployments', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start();
    expect(requests.length).toBe(0);
    expect(scope.lookupOnly).toBe(true);
    expect(scope.loading).toBe(false);
    expect(scope.dataReady).toBe(false);
    expect(scope.searchError).toBeNull();
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    expect(element[0].querySelector('#quote-state')).toBeNull();
    expect(element[0].textContent).toContain('Enter a quote request ID, external ID, or proposal ID');
  });

  it('uses the external ID lookup when that type is chosen in a lookup-only deployment', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start();
    scope.useSearchType('externalId');
    root.$digest();
    scope.searchTerm = 'PARTNER-EXAMPLE-001';
    scope.onSearchChange();
    timeout.flush(300);
    expect(service.findQuote).toHaveBeenCalledOnceWith({ externalId: 'PARTNER-EXAMPLE-001' });
    expect(service.getQuotes).not.toHaveBeenCalled();
    requests[0].deferred.resolve({ data: { quoteRequestId: 'REQUEST-001', externalId: 'PARTNER-EXAMPLE-001' } });
    root.$digest();
    expect(scope.quotes[0].quoteRequestId).toBe('REQUEST-001');
    expect(scope.totalElements).toBe(1);
  });

  it('supports proposal lookup without sending an invented generic search parameter', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=PROPOSAL-001&searchBy=proposalId');
    expect(service.findQuote).toHaveBeenCalledOnceWith({ proposalId: 'PROPOSAL-001' });
    requests[0].deferred.resolve({ data: { quoteRequestId: 'REQUEST-001' } });
    root.$digest();
    expect(scope.totalElements).toBe(1);
    expect(location.search().searchBy).toBe('proposalId');
  });

  it('looks up a quote request ID in lookup-only mode', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    var id = '123456789-11111111-2222-4333-8444-555555555555';
    start('QuoteListCtrl', '/quotes?search=' + id + '&searchBy=quoteRequestId');
    expect(service.getQuote).toHaveBeenCalledOnceWith(id);
    expect(service.findQuote).not.toHaveBeenCalled();
  });

  it('explains unavailable generic text search rather than issuing a rejected request', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=Example&searchBy=text');
    expect(requests.length).toBe(0);
    expect(scope.searchError).toContain('requires a quote request ID');
    scope.clearFilters();
    root.$digest();
    expect(scope.searchBy).toBe('text');
    expect(scope.searchError).toBeNull();
    expect(requests.length).toBe(0);
  });

  it('validates external lookup response identity and supports a meaningful 404', function() {
    expect(function() {
      view.readPage({ quoteRequestId: 'Q-1', externalId: 'OTHER' }, { externalId: 'EXPECTED', size: 25 });
    }).toThrow();
    start('QuoteListCtrl', '/quotes?search=EXTERNAL-001&searchBy=externalId');
    requests[0].deferred.reject({ status: 404 });
    root.$digest();
    expect(scope.error).toBe('Quote not found for this identifier.');
  });

  it('uses the documented exact lookup for a complete numeric-prefix quote request ID', function() {
    var id = '123456789-11111111-2222-4333-8444-555555555555';
    start('QuoteListCtrl', '/quotes?search=' + id + '&searchBy=quoteRequestId');
    expect(service.getQuote).toHaveBeenCalledOnceWith(id);
    expect(service.getQuotes).not.toHaveBeenCalled();
    requests[0].deferred.resolve({
      data: { quoteRequestId: id, externalId: 'EXAMPLE-1', customerName: 'Example', state: 'FAILED', sites: [] }
    });
    root.$digest();
    expect(scope.quotes.length).toBe(1);
    expect(scope.quotes[0].quoteRequestId).toBe(id);
    expect(scope.totalElements).toBe(1);
    expect(scope.totalPages).toBe(1);
    expect(scope.currentPage).toBe(0);
    expect(scope.error).toBeNull();
  });

  it('moves focus to the results heading after a page change, then cleans up its timer', function() {
    start('QuoteListCtrl', '/quotes?page=0');
    resolve(0, [{ quoteRequestId: 'Q-1' }], { totalElements: 60, totalPages: 3 });
    var table = renderTable();
    document.body.appendChild(element[0]);
    angular.element(table.querySelector('button[aria-label="Page 2"]')).triggerHandler('click');
    root.$digest();
    resolve(1, [{ quoteRequestId: 'Q-26' }], { totalElements: 60, totalPages: 3 });
    timeout.flush(0);
    expect(document.activeElement).toBe(table.querySelector('.qm-results-heading'));
  });

  it('keeps the ticket URL in sync when the server corrects the page', function() {
    start('SupportTicketsCtrl', '/support-tickets?ticketNumber=SUP-1&page=9');
    requests[0].deferred.resolve({ data: { content: [{ quoteRequestId: 'Q-1' }], totalElements: 1, totalPages: 1, page: 0, size: 25 } });
    root.$digest();
    expect(location.search().page).toBe(0);
  });

  it('labels exact lookups and their filter chips by identifier type', function() {
    start();
    scope.searchBy = 'proposalId'; scope.searchTerm = 'P-1';
    expect(scope.lookupLabel()).toBe('proposal ID');
    expect(scope.activeFilterChips()[0].label).toBe('Proposal ID: P-1');
    scope.searchBy = 'externalId';
    expect(scope.activeFilterChips()[0].label).toBe('External ID: P-1');
    scope.searchBy = 'text';
    expect(scope.lookupLabel()).toBe('');
    expect(scope.activeFilterChips()[0].label).toBe('Search: P-1');
  });

  it('builds an exact lookup only for a chosen identifier type and a non-empty value', function() {
    var id = 'PARTNER-QUOTE-1509260632-df5d85a2-3f08-4876-8848-826f2d3c1551';
    expect(view.lookupCriteria(id, 'quoteRequestId')).toEqual({ quoteRequestId: id });
    expect(view.lookupCriteria(' EXT-1 ', 'externalId')).toEqual({ externalId: 'EXT-1' });
    expect(view.lookupCriteria('P-1', 'proposalId')).toEqual({ proposalId: 'P-1' });
    // No type chosen, the general text search and an empty value never make an exact lookup, whatever the value looks like.
    expect(view.lookupCriteria(id, '')).toBeNull();
    expect(view.lookupCriteria(id, 'text')).toBeNull();
    expect(view.lookupCriteria('   ', 'externalId')).toBeNull();
    expect(view.smart).toBeUndefined();
    expect(view.exactQuoteId).toBeUndefined();
  });

  it('shows server errors as they are and never tries another identifier', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=EXT-500&searchBy=externalId');
    requests[0].deferred.reject({ status: 502, data: { code: 'UPSTREAM_FAILED', message: 'QuoteData is unavailable.' } });
    root.$digest();
    expect(service.getQuote).not.toHaveBeenCalled();
    expect(scope.error).toBe('QuoteData is unavailable.');
    scope.$destroy();
    start('QuoteListCtrl', '/quotes?search=EXT-404&searchBy=externalId');
    requests[1].deferred.reject({ status: 404 });
    root.$digest();
    expect(service.getQuote).not.toHaveBeenCalled();
    expect(scope.error).toBe('Quote not found for this identifier.');
  });

  it('supports explicit ID lookup for IDs with other formats and saves the search type', function() {
    start('QuoteListCtrl', '/quotes?search=EXAMPLE-ID&searchBy=quoteRequestId&page=4');
    expect(scope.searchBy).toBe('quoteRequestId');
    expect(service.getQuote).toHaveBeenCalledOnceWith('EXAMPLE-ID');
    expect(location.search().page).toBe(0);
    expect(location.search().searchBy).toBe('quoteRequestId');
  });

  it('allows a UUID-shaped external or opportunity ID to use general search explicitly', function() {
    var id = '11111111-2222-4333-8444-555555555555';
    start('QuoteListCtrl', '/quotes?search=' + id + '&searchBy=text');
    expect(service.getQuote).not.toHaveBeenCalled();
    expect(requests[0].params.search).toBe(id);
    expect(requests[0].params.searchBy).toBeUndefined();
  });

  it('visibly pauses list filters during exact lookup and restores them for general search', function() {
    start('QuoteListCtrl', '/search?search=EXAMPLE-ID&searchBy=quoteRequestId&state=COMPLETED', {});
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    expect(service.getQuote).toHaveBeenCalledOnceWith('EXAMPLE-ID');
    expect(element[0].querySelector('#quote-state').disabled).toBe(true);
    expect(element[0].querySelector('#quote-from').disabled).toBe(true);
    expect(scope.filters.state).toBe('COMPLETED');
    scope.searchBy = 'text';
    scope.applyFilters();
    root.$digest();
    expect(requests[1].params.state).toBe('COMPLETED');
    expect(requests[1].params.search).toBe('EXAMPLE-ID');
    expect(element[0].querySelector('#quote-state').disabled).toBe(false);
  });

  it('does not send an empty explicit quote ID request', function() {
    start('QuoteListCtrl', '/search?searchBy=quoteRequestId');
    expect(requests.length).toBe(0);
    expect(scope.searchError).toBeNull();
    scope.submitSearch();
    expect(requests.length).toBe(0);
    expect(scope.searchError).toBe('Enter a quote request ID.');
    scope.clearFilters();
    root.$digest();
    expect(scope.searchError).toBeNull();
    expect(requests.length).toBe(0);
  });

  it('does not mistake an error envelope or a different quote for a successful ID match', function() {
    var params = { quoteRequestId: 'EXAMPLE-ID', page: 0, size: 25 };
    [{ message: 'Not found' }, { quoteRequestId: 'DIFFERENT-ID' }, { content: [] }, null].forEach(function(response) {
      expect(function() { view.readPage(response, params); }).toThrow();
    });
  });

  it('keeps an exact lookup 404 distinct from successful empty list results', function() {
    start('QuoteListCtrl', '/quotes?search=EXAMPLE-ID&searchBy=quoteRequestId');
    requests[0].deferred.reject({ status: 404 });
    root.$digest();
    expect(scope.error).toBe('Quote not found for this request ID.');
    expect(scope.dataReady).toBe(false);
  });

  it('ignores a stale exact lookup after switching to general search', function() {
    start('QuoteListCtrl', '/quotes?search=EXAMPLE-ID&searchBy=quoteRequestId');
    scope.searchBy = 'text';
    scope.searchTerm = 'Example customer';
    scope.applyFilters();
    resolve(1, [{ quoteRequestId: 'NEW-RESULT' }]);
    requests[0].deferred.resolve({ data: { quoteRequestId: 'EXAMPLE-ID' } });
    root.$digest();
    expect(scope.quotes[0].quoteRequestId).toBe('NEW-RESULT');
    expect(requests.length).toBe(2);
  });

  it('explains network failures and retains the request tracking ID', function() {
    start();
    requests[0].deferred.reject({
      status: 0, headers: function() { return null; }, config: { headers: { trackingId: 'TRACE-CLIENT' } }
    });
    root.$digest();
    expect(scope.error).toContain('Cannot reach the Quote Management server');
    expect(scope.trackingId).toBe('TRACE-CLIENT');
  });

  it('explains unauthorized API responses rather than implying no matching quote', function() {
    start();
    requests[0].deferred.reject({ status: 401 });
    root.$digest();
    expect(scope.error).toContain('Sign in again');
    expect(scope.dataReady).toBe(false);
  });

  it('surfaces proxy service-configuration failures without claiming an empty result', function() {
    start();
    requests[0].deferred.reject({
      status: 503,
      data: { code: 'SERVICE_AUTH_NOT_CONFIGURED', message: 'Configure QuoteData service authentication on the server.', trackingId: 'TRACE-PROXY' }
    });
    root.$digest();
    expect(scope.error).toBe('Configure QuoteData service authentication on the server.');
    expect(scope.trackingId).toBe('TRACE-PROXY');
    expect(scope.dataReady).toBe(false);
  });

  it('shows explicit all-values labels for empty filter selections', function() {
    start();
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    var labels = {
      'quote-state': 'All states', 'quote-design': 'All design statuses',
      'quote-category': 'All categories', 'quote-channel': 'All channels'
    };
    Object.keys(labels).forEach(function(id) {
      expect(element[0].querySelector('#' + id).selectedOptions[0].textContent).toBe(labels[id]);
    });
    scope.filters.state = 'FAILED';
    root.$digest();
    expect(element[0].querySelector('#quote-state').selectedOptions[0].textContent).toBe('Failed');
    scope.clearFilters();
    root.$digest();
    expect(element[0].querySelector('#quote-state').selectedOptions[0].textContent).toBe('All states');
  });

  it('maps the QuoteData page field and corrects the URL without another request', function() {
    start('QuoteListCtrl', '/quotes?page=9&state=FAILED');
    resolve(0, [{ quoteRequestId: 'Q-26', state: 'FAILED' }], { page: 1, totalElements: 51, totalPages: 3 });
    expect(scope.currentPage).toBe(1);
    expect(scope.totalElements).toBe(51);
    expect(scope.totalPages).toBe(3);
    expect(location.search().page).toBe(1);
    expect(location.search().state).toBe('FAILED');
    expect(requests.length).toBe(1);
  });

  it('normalizes optional columns and known response aliases without inventing fields', function() {
    var page = view.readPage({
      quotes: [{ QUOTE_REQUEST_ID: 'Q-1', STATE: 'inProgress', DESIGN_STATUS: 'REVIEW', UPDATED_AT: '2026-04-20', skyTicketNumber: 'SKY-1' }],
      totalElements: 1, totalPages: 1, number: 0, size: 25
    }, { page: 0, size: 25 });
    expect(page.items[0].quoteRequestId).toBe('Q-1');
    expect(page.items[0].state).toBe('IN_PROGRESS');
    expect(page.items[0].designStatus).toBe('REVIEW');
    expect(page.items[0].updatedAt).toBe('2026-04-20');
    expect(page.items[0].customerName).toBeNull();
    expect(page.items[0].supportTicketNumber).toBe('SKY-1');
  });

  it('falls back to SKY tickets when support ticket fields are null, empty, or whitespace', function() {
    var rows = [null, '', '   ', undefined].map(function(value, index) {
      return { quoteRequestId: 'Q-' + index, supportTicketNumber: value, ticketNumber: value, skyTicketNumber: 'SKY-' + index };
    });
    var page = view.readPage(rows, { page: 0, size: 25 });
    page.items.forEach(function(row, index) {
      expect(row.supportTicketNumber).toBe('SKY-' + index);
    });
  });

  it('rejects malformed envelopes and invalid paging metadata', function() {
    [{}, { content: [] }, { content: {}, totalElements: 0 }, { content: [null], totalElements: 1, totalPages: 1, page: 0, size: 25 },
      { content: [], totalElements: 'unknown', totalPages: 0, page: 0, size: 25 },
      { content: [], totalElements: 0, totalPages: 0, page: -1, size: 25 }
    ].forEach(function(data) {
      expect(function() { view.readPage(data, { page: 0, size: 25 }); }).toThrow();
    });
  });

  it('shows malformed API data as an error rather than successful empty results', function() {
    start();
    requests[0].deferred.resolve({ data: { trackingId: 'TRACK-BAD' } });
    root.$digest();
    expect(scope.error).toContain('unrecognized response');
    expect(scope.trackingId).toBe('TRACK-BAD');
    expect(scope.dataReady).toBe(false);
    expect(scope.totalElements).toBeNull();
    expect(scope.loading).toBe(false);
  });

  it('uses latest-request-wins for refresh during an existing request', function() {
    start();
    scope.refresh();
    expect(requests.length).toBe(2);
    resolve(1, [{ quoteRequestId: 'NEW', state: 'COMPLETED' }]);
    resolve(0, [{ quoteRequestId: 'OLD', state: 'FAILED' }]);
    expect(scope.quotes[0].quoteRequestId).toBe('NEW');
    expect(scope.error).toBeNull();
  });

  it('ignores a stale failure and does not finish a newer loading state', function() {
    start();
    scope.filters.state = 'COMPLETED';
    scope.applyFilters();
    requests[0].deferred.reject({ status: 500, data: { trackingId: 'OLD' } });
    root.$digest();
    expect(scope.loading).toBe(true);
    expect(scope.error).toBeNull();
    resolve(1, [{ quoteRequestId: 'NEW' }]);
    expect(scope.quotes[0].quoteRequestId).toBe('NEW');
  });

  it('debounces free text by 300 ms and commits the latest value once', function() {
    start();
    scope.searchTerm = 'first';
    scope.onSearchChange();
    timeout.flush(200);
    scope.searchTerm = '  latest  ';
    scope.onSearchChange();
    timeout.flush(299);
    expect(requests.length).toBe(1);
    timeout.flush(1);
    expect(requests.length).toBe(2);
    expect(requests[1].params.search).toBe('latest');
    root.$digest();
    expect(requests.length).toBe(2);
    expect(location.search().search).toBe('latest');
  });

  it('combines a pending text edit and filter change into one committed request', function() {
    start();
    scope.searchTerm = 'Customer';
    scope.onSearchChange();
    scope.filters.state = 'FAILED';
    scope.applyFilters();
    timeout.flush(300);
    expect(requests.length).toBe(2);
    expect(requests[1].params.search).toBe('Customer');
    expect(requests[1].params.state).toBe('FAILED');
    expect(requests[1].params.page).toBe(0);
  });

  it('flushes a pending search on refresh without sending a second debounced request', function() {
    start('QuoteListCtrl', '/quotes?page=2');
    scope.searchTerm = 'fresh';
    scope.onSearchChange();
    scope.refresh();
    timeout.flush(300);
    expect(requests.length).toBe(2);
    expect(requests[1].params.page).toBe(0);
    expect(requests[1].params.search).toBe('fresh');
  });

  it('does not commit draft search text when an older page finishes loading', function() {
    start();
    scope.searchTerm = 'draft';
    scope.onSearchChange();
    resolve(0, [{ quoteRequestId: 'Q-1' }]);
    expect(location.search().search).toBeUndefined();
    expect(scope.searchTerm).toBe('draft');
    timeout.flush(300);
    expect(requests.length).toBe(2);
    expect(requests[1].params.search).toBe('draft');
  });

  it('does not erase pending text on a local URL update', function() {
    start();
    scope.filters.state = 'FAILED';
    scope.applyFilters();
    scope.searchTerm = 'typed before digest';
    scope.onSearchChange();
    root.$digest();
    expect(scope.searchTerm).toBe('typed before digest');
    timeout.flush(300);
    expect(requests.length).toBe(3);
    expect(requests[2].params.search).toBe('typed before digest');
  });

  it('cancels the debounce and ignores in-flight results after controller destruction', function() {
    start();
    scope.searchTerm = 'cancelled';
    scope.onSearchChange();
    scope.$destroy();
    timeout.flush(300);
    resolve(0, [{ quoteRequestId: 'LATE' }]);
    expect(requests.length).toBe(1);
    expect(scope.quotes).toEqual([]);
  });

  it('rejects reversed dates without a request or stale results', function() {
    start();
    scope.filters.fromDate = new Date(2026, 4, 12);
    scope.filters.toDate = new Date(2026, 4, 1);
    scope.applyFilters();
    expect(requests.length).toBe(1);
    expect(scope.validationError).toContain('on or before');
    resolve(0, [{ quoteRequestId: 'STALE' }]);
    expect(scope.quotes).toEqual([]);
    expect(scope.totalElements).toBeNull();
    scope.filters.fromDate = null;
    scope.filters.toDate = null;
    scope.applyFilters();
    expect(requests.length).toBe(2);
  });

  it('rejects invalid URL dates and preserves local calendar boundaries for valid dates', function() {
    start('QuoteListCtrl', '/quotes?fromDate=2026-02-31');
    expect(requests.length).toBe(0);
    expect(scope.validationError).toContain('valid created dates');
    scope.filters.fromDate = new Date(2026, 4, 1);
    scope.filters.toDate = new Date(2026, 4, 12);
    scope.applyFilters();
    expect(requests.length).toBe(1);
    expect(requests[0].params.createdFrom).toBe('2026-05-01T00:00:00');
    expect(requests[0].params.createdTo).toBe('2026-05-12T23:59:59.999');
    expect(requests[0].params.fromDate).toBeUndefined();
    expect(location.search().fromDate).toBe('2026-05-01');
  });

  it('restores URL date inputs as local Date models without ngModel errors or timezone shifts', function() {
    start('QuoteListCtrl', '/quotes?fromDate=2026-05-01&toDate=2026-05-12');
    element = compile(templates[templatePaths[1]])(scope);
    expect(function() { root.$digest(); }).not.toThrow();
    expect(scope.filters.fromDate instanceof Date).toBe(true);
    expect(scope.filters.fromDate.getDate()).toBe(1);
    expect(element[0].querySelector('#quote-from').value).toBe('2026-05-01');
    expect(element[0].querySelector('#quote-to').value).toBe('2026-05-12');
    expect(scope.quoteFilters.fromDate.$valid).toBe(true);
    expect(scope.quoteFilters.toDate.$valid).toBe(true);
    expect(requests[0].params.createdTo).toBe('2026-05-12T23:59:59.999');

    location.url('/quotes?fromDate=2026-05-03&toDate=2026-05-04');
    expect(function() { root.$digest(); }).not.toThrow();
    expect(element[0].querySelector('#quote-from').value).toBe('2026-05-03');
    expect(element[0].querySelector('#quote-to').value).toBe('2026-05-04');
    expect(requests.length).toBe(2);
  });

  it('renders invalid URL dates without an ngModel Date exception and makes no request', function() {
    start('QuoteListCtrl', '/quotes?fromDate=invalid&toDate=2026-02-31');
    element = compile(templates[templatePaths[1]])(scope);
    expect(function() { root.$digest(); }).not.toThrow();
    expect(scope.validationError).toContain('valid created dates');
    expect(requests.length).toBe(0);
    expect(element[0].querySelector('#quote-from').value).toBe('');
    expect(element[0].querySelector('#quote-to').value).toBe('');
  });

  it('invalidates an in-flight failure when URL navigation restores an invalid range', function() {
    start();
    location.url('/quotes?fromDate=2026-05-12&toDate=2026-05-01');
    root.$digest();
    requests[0].deferred.reject({ status: 500, data: { trackingId: 'STALE-FAILURE' } });
    root.$digest();
    expect(requests.length).toBe(1);
    expect(scope.validationError).toContain('on or before');
    expect(scope.loading).toBe(false);
    expect(scope.dataReady).toBe(false);
    expect(scope.error).toBeNull();
    expect(scope.trackingId).toBeNull();
    expect(scope.totalElements).toBeNull();
    expect(scope.quotes).toEqual([]);
  });

  it('clears invalid date input without stale form validity blocking the new request', function() {
    start();
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    scope.quoteFilters.fromDate.$setViewValue('not-a-date');
    root.$digest();
    expect(scope.validationError).toContain('valid created dates');
    expect(requests.length).toBe(1);
    scope.clearFilters();
    root.$digest();
    expect(scope.validationError).toBeNull();
    expect(requests.length).toBe(2);
    expect(requests[1].params.createdFrom).toBeUndefined();
  });

  describe('refresh only on request', function() {
    it('never reloads by itself, however long the page stays open, and reloads once per Refresh click', function() {
      var interval;
      angular.mock.inject(function($interval) { interval = $interval; });
      start();
      expect(requests.length).toBe(1);
      resolve(0, []);
      interval.flush(10 * 60 * 1000);
      expect(requests.length).toBe(1);
      expect(scope.autoRefresh).toBeUndefined();
      expect(scope.toggleAutoRefresh).toBeUndefined();
      scope.refresh();
      expect(requests.length).toBe(2);
    });

    it('shows the four summary tiles once, and does not repeat statuses in a mix bar, pills or summary line', function() {
      start();
      expect(scope.kpis).toBeNull();
      resolve(0, [{ quoteRequestId: 'A', state: 'FAILED' }, { quoteRequestId: 'B', state: 'COMPLETED' }, { quoteRequestId: 'C', state: 'IN_PROGRESS' },
        { quoteRequestId: 'D', state: 'FAILED' }, { quoteRequestId: 'E', state: 'RECEIVED' }]);
      expect(scope.kpis).toEqual({ failed: 2, inProgress: 1, completed: 1 });
      element = compile(templates[templatePaths[1]])(scope);
      root.$digest();
      var tiles = Array.prototype.map.call(element[0].querySelectorAll('.qm-kpi-card'), function(tile) {
        return [tile.querySelector('.qm-kpi-label').textContent, tile.querySelector('.qm-kpi-value').textContent];
      });
      expect(tiles).toEqual([['Total quotes', '5'], ['In progress', '1'], ['Failed', '2'], ['Completed', '1']]);
      expect(element[0].querySelector('.qm-kpi-note')).toBeNull();
      expect(element[0].textContent).not.toContain('counts every page');
      expect(element[0].textContent).not.toMatch(/All pages|This page/);
      expect(element[0].querySelector('.qm-quick, .qm-mix, .qm-meta-line, .qm-autorefresh')).toBeNull();
      expect(scope.quickStates).toBeUndefined();
      expect(scope.stateMix).toBeUndefined();
    });

    it('shows dashes in the tiles while nothing has loaded and after an error, never zeros', function() {
      start();
      element = compile(templates[templatePaths[1]])(scope);
      root.$digest();
      var values = Array.prototype.map.call(element[0].querySelectorAll('.qm-kpi-value'), function(node) { return node.textContent; });
      expect(values).toEqual(['—', '—', '—', '—']);
      requests[0].deferred.reject({ status: 500, data: { code: 'X', message: 'x' } });
      root.$digest();
      expect(scope.kpis).toBeNull();
    });
  });

  describe('Home and Search are separate pages', function() {
    function mount() {
      element = compile(templates[templatePaths[1]])(scope);
      root.$digest();
      return element[0];
    }
    function hidden(node) { return node.classList.contains('ng-hide'); }
    function tiles(page) { return page.querySelectorAll('.qm-lookup-tile'); }
    function names(page) {
      return Array.prototype.map.call(tiles(page), function(tile) { return tile.querySelector('strong').textContent; });
    }

    it('Home lists the default 25 newest quotes at once and shows the summary tiles, the filters and a link to Search, not the search box', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true; // only limits the Search page
      start('QuoteListCtrl', '/quotes');
      expect(scope.pageMode).toBe('home');
      expect(scope.lookupOnly).toBe(false);
      expect(requests.length).toBe(1);
      expect(requests[0].params).toEqual({ page: 0, size: 25, sort: 'createdAt,desc' });
      var page = mount();
      expect(hidden(page.querySelector('.qm-omnibar-wrap'))).toBe(true);
      expect(tiles(page).length).toBe(0);
      expect(page.querySelector('#quote-state')).not.toBeNull();
      expect(page.querySelectorAll('.qm-kpi-card').length).toBe(4);
      expect(page.querySelector('.qm-mix, .qm-quick-pill, #quote-auto-refresh')).toBeNull();
      expect(page.querySelector('.qm-title').textContent).toBe('Quotes');
      expect(page.querySelector('.qm-greeting')).toBeNull();
      expect(page.textContent).not.toMatch(/Good (morning|afternoon|evening)/);
      expect(page.querySelector('a.qm-search-link').getAttribute('href')).toBe('#!/search');
    });

    it('Search starts with Look up by: one tile per lookup type, no value field, no request and no filters', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search');
      expect(scope.pageMode).toBe('search');
      expect(scope.searchBy).toBe('');
      expect(requests.length).toBe(0);
      expect(scope.dataReady).toBe(false);
      var page = mount();
      expect(page.querySelector('#lookup-by-label').textContent).toContain('Look up by');
      expect(names(page)).toEqual(['Quote request ID', 'External ID', 'Proposal ID', 'Support ticket']);
      expect(tiles(page)[3].getAttribute('href')).toBe('#!/support-tickets');
      // Look up by comes before the value field, which stays hidden until a type is chosen; there is no type dropdown.
      expect(hidden(page.querySelector('.qm-omnibar-wrap'))).toBe(true);
      expect(page.querySelector('.qm-lookup').compareDocumentPosition(page.querySelector('.qm-omnibar-wrap')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(page.querySelector('#quote-search-type, .qm-omnibar select')).toBeNull();
      expect(page.querySelector('#quote-state')).toBeNull();
      expect(page.querySelector('.qm-title').textContent).toBe('Search');
      expect(page.textContent).not.toMatch(/Smart search/i);
      expect(page.querySelector('.qm-idle-hidden quote-table')).not.toBeNull();
    });

    it('offers Other fields as a fifth tile only when the backend supports general search', function() {
      start('QuoteListCtrl', '/search');
      expect(scope.lookupOnly).toBe(false);
      expect(names(mount())).toEqual(['Quote request ID', 'External ID', 'Proposal ID', 'Other fields', 'Support ticket']);
    });

    it('choosing a tile shows the value field for that type, selects the tile, focuses the field and clears the old lookup', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search?search=OLD-1&searchBy=quoteRequestId');
      requests[0].deferred.resolve({ data: { quoteRequestId: 'OLD-1' } });
      root.$digest();
      var page = mount();
      document.body.appendChild(page);
      angular.element(tiles(page)[1]).triggerHandler('click');
      timeout.flush();
      expect(scope.searchBy).toBe('externalId');
      expect(scope.searchTerm).toBe('');
      expect(scope.quotes).toEqual([]);
      expect(scope.dataReady).toBe(false);
      expect(requests.length).toBe(1);
      expect(location.search().searchBy).toBe('externalId');
      expect(location.search().search).toBeUndefined();
      expect(hidden(page.querySelector('.qm-omnibar-wrap'))).toBe(false);
      expect(page.querySelector('#lookup-value-label').textContent).toContain('Enter the external ID');
      expect(page.querySelector('#quote-search').getAttribute('placeholder')).toBe('Paste or type the external ID');
      expect(tiles(page)[1].classList.contains('is-selected')).toBe(true);
      expect(tiles(page)[1].getAttribute('aria-pressed')).toBe('true');
      expect(tiles(page)[0].getAttribute('aria-pressed')).toBe('false');
      expect(document.activeElement).toBe(page.querySelector('#quote-search'));
      document.body.removeChild(page);
    });

    it('choosing the type that is already chosen keeps what was typed', function() {
      start('QuoteListCtrl', '/search?search=KEEP-1&searchBy=externalId');
      scope.useSearchType('externalId');
      expect(scope.searchTerm).toBe('KEEP-1');
    });

    it('typing into the value field reaches the controller (the input is not in a child scope) and searches with the chosen type', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search');
      var page = mount();
      angular.element(tiles(page)[1]).triggerHandler('click');
      var input = angular.element(page.querySelector('#quote-search'));
      input.val('hello'); input.triggerHandler('input');
      expect(scope.searchTerm).toBe('hello');
      timeout.flush(300);
      expect(service.findQuote).toHaveBeenCalledOnceWith({ externalId: 'hello' });
    });

    it('asks for a value only after Search is pressed with the value field empty', function() {
      start('QuoteListCtrl', '/search');
      var page = mount();
      angular.element(tiles(page)[0]).triggerHandler('click');
      expect(scope.searchError).toBeNull();
      expect(page.querySelector('.qm-search-error')).toBeNull();
      angular.element(page.querySelector('form')).triggerHandler('submit');
      expect(page.querySelector('.qm-search-error').textContent).toContain('Enter a quote request ID.');
      expect(requests.length).toBe(0);
      scope.useSearchType('externalId');
      root.$digest();
      scope.submitSearch();
      expect(scope.searchError).toBe('Enter an external ID.');
      scope.searchTerm = 'Q-1';
      scope.onSearchChange();
      expect(scope.searchError).toBeNull();
    });

    it('Clear empties the value and the address but keeps the chosen type', function() {
      start('QuoteListCtrl', '/search?search=EXT-1&searchBy=externalId');
      requests[0].deferred.resolve({ data: { quoteRequestId: 'Q-1', externalId: 'EXT-1' } });
      root.$digest();
      scope.clearFilters();
      root.$digest();
      expect(scope.searchBy).toBe('externalId');
      expect(scope.searchTerm).toBe('');
      expect(scope.dataReady).toBe(false);
      expect(location.search().search).toBeUndefined();
      expect(location.search().searchBy).toBe('externalId');
      expect(requests.length).toBe(1);
    });

    it('Search with an ID makes one lookup and hides the idle results once a quote has loaded', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search?search=PARTNER-1&searchBy=externalId');
      expect(service.findQuote).toHaveBeenCalledOnceWith({ externalId: 'PARTNER-1' });
      requests[0].deferred.resolve({ data: { quoteRequestId: 'Q-1', externalId: 'PARTNER-1', state: 'FAILED' } });
      root.$digest();
      var page = mount();
      expect(page.querySelector('.qm-idle-hidden')).toBeNull();
      expect(page.querySelector('#quote-search').value).toBe('PARTNER-1');
    });

    it('does not guess the type of a value: without a chosen type nothing is looked up', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search?search=11111111-2222-4333-8444-555555555555');
      expect(scope.searchBy).toBe('');
      expect(requests.length).toBe(0);
      expect(service.getQuote).not.toHaveBeenCalled();
      expect(service.findQuote).not.toHaveBeenCalled();
    });

    it('moves an old /quotes?search= link to the Search page, keeping the whole query', function() {
      location.url('/quotes?search=OLD-1&searchBy=externalId&state=FAILED');
      root.$digest();
      expect(location.path()).toBe('/search');
      expect(location.search()).toEqual({ search: 'OLD-1', searchBy: 'externalId', state: 'FAILED' });
      location.url('/quotes?state=FAILED');
      root.$digest();
      expect(location.path()).toBe('/quotes');
    });

    it('Home can be switched off with defaultListEnabled: false and then points to Search without any request', function() {
      var original = window.APP_CONFIG.defaultListEnabled;
      window.APP_CONFIG.defaultListEnabled = false;
      start('QuoteListCtrl', '/quotes');
      expect(requests.length).toBe(0);
      expect(scope.listEnabled).toBe(false);
      var page = mount();
      expect(page.textContent).toContain('The default list is turned off');
      expect(page.querySelector('.qm-filter-card')).toBeNull();
      expect(page.querySelector('.qm-action-btn')).toBeNull();
      expect(page.querySelector('.qm-idle-hidden quote-table')).not.toBeNull();
      window.APP_CONFIG.defaultListEnabled = original;
    });
  });

  describe('product tour video', function() {
    function mount() {
      element = compile(templates[templatePaths[1]])(scope);
      document.body.appendChild(element[0]);
      root.$digest();
      return element[0];
    }

    it('is offered on Home only, and the video is not in the page until it is opened', function() {
      start('QuoteListCtrl', '/quotes');
      var page = mount();
      expect(page.querySelector('#tour-open').textContent).toContain('Watch tour');
      expect(page.querySelector('video')).toBeNull();
      expect(page.querySelector('#tour-dialog')).toBeNull();
      scope.$destroy();
      element.remove();
      start('QuoteListCtrl', '/search');
      expect(mount().querySelector('#tour-open')).toBeNull();
    });

    it('writes no media address in the template text, so nothing downloads before the dialog is opened', function() {
      expect(templates[templatePaths[1]]).not.toMatch(/(?:\ssrc|poster)="assets\/media/);
      expect(templates[templatePaths[1]]).toContain('ng-attr-src="{{tourFiles.mp4}}"');
    });

    it('opens a dialog with the video, an MP4 and a WebM source, a poster and chapter buttons', function() {
      start('QuoteListCtrl', '/quotes');
      var page = mount();
      var opener = page.querySelector('#tour-open');
      opener.focus();
      angular.element(opener).triggerHandler('click');
      root.$digest();
      var dialog = page.querySelector('#tour-dialog');
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      var video = dialog.querySelector('video#tour-video');
      expect(video.hasAttribute('controls')).toBe(true);
      expect(video.getAttribute('preload')).toBe('metadata');
      expect(video.getAttribute('poster')).toBe('assets/media/quote-management-tour.jpg');
      var sources = Array.prototype.map.call(video.querySelectorAll('source'), function(source) { return source.getAttribute('src') + ' ' + source.getAttribute('type'); });
      expect(sources).toEqual(['assets/media/quote-management-tour.mp4 video/mp4', 'assets/media/quote-management-tour.webm video/webm']);
      var chapters = Array.prototype.map.call(dialog.querySelectorAll('.qm-tour-chapters button'), function(button) { return button.textContent.trim(); });
      expect(chapters).toEqual(['Sign in', 'Home', 'Filters', 'Open a quote', 'Journey and errors', 'Tabs', 'Search']);
      timeout.flush(0);
      expect(document.activeElement).toBe(dialog.querySelector('#tour-close'));
    });

    it('lists chapters in order, each starting inside the video', function() {
      start('QuoteListCtrl', '/quotes');
      var times = scope.tourChapters.map(function(chapter) { return chapter.time; });
      expect(times[0]).toBe(0);
      times.forEach(function(time, index) { if (index) expect(time).toBeGreaterThan(times[index - 1]); });
      expect(times[times.length - 1]).toBeLessThan(89);
    });

    it('jumps to a chapter and plays from there', function() {
      start('QuoteListCtrl', '/quotes');
      var page = mount();
      scope.openTour(); root.$digest();
      var video = page.querySelector('#tour-video');
      var play = spyOn(video, 'play').and.returnValue(Promise.resolve());
      angular.element(page.querySelectorAll('.qm-tour-chapters button')[3]).triggerHandler('click');
      expect(play).toHaveBeenCalled();
      scope.closeTour(); root.$digest();
      expect(function() { scope.seekTour(10); }).not.toThrow(); // nothing to seek once the video is gone
    });

    it('closes with Close, Escape or a click outside, pauses the video and returns focus to Watch tour', function() {
      start('QuoteListCtrl', '/quotes');
      var page = mount();
      var opener = page.querySelector('#tour-open');
      [function() { angular.element(page.querySelector('#tour-close')).triggerHandler('click'); },
       function() { scope.tourKeydown({ key: 'Escape', preventDefault: function() {} }); },
       function() { angular.element(page.querySelector('.recovery-dialog-backdrop')).triggerHandler('click'); }].forEach(function(close) {
        opener.focus();
        angular.element(opener).triggerHandler('click');
        root.$digest();
        var pause = spyOn(page.querySelector('#tour-video'), 'pause');
        close();
        root.$digest();
        timeout.flush(0);
        expect(pause).toHaveBeenCalled();
        expect(page.querySelector('#tour-dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
      });
    });

    it('keeps Tab inside the dialog', function() {
      start('QuoteListCtrl', '/quotes');
      var page = mount();
      scope.openTour(); root.$digest();
      var stops = page.querySelectorAll('#tour-dialog button, #tour-dialog video[controls]');
      stops[stops.length - 1].focus();
      var forward = { key: 'Tab', shiftKey: false, preventDefault: jasmine.createSpy('forward') };
      scope.tourKeydown(forward);
      expect(forward.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(stops[0]);
      var back = { key: 'Tab', shiftKey: true, preventDefault: jasmine.createSpy('back') };
      scope.tourKeydown(back);
      expect(back.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(stops[stops.length - 1]);
    });
  });

  describe('recent searches', function() {
    function mount() {
      element = compile(templates[templatePaths[1]])(scope);
      root.$digest();
      return element[0];
    }

    // Lookup-only deployments answer with the single matching quote.
    function found(index, term) {
      requests[index].deferred.resolve({ data: { quoteRequestId: term + '-uuid', externalId: term } });
      root.$digest();
    }

    it('remembers only successful exact lookups, newest first, five at most, and replays them with their type', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start('QuoteListCtrl', '/search');
      scope.useSearchType('externalId');
      root.$digest();
      ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'A-2'].forEach(function(term) {
        scope.searchTerm = term;
        scope.applyFilters();
        found(requests.length - 1, term);
      });
      expect(scope.recentSearches.map(function(item) { return item.term; })).toEqual(['A-2', 'A-6', 'A-5', 'A-4', 'A-3']);
      expect(JSON.parse(localStorage.getItem('omw-recent-searches')).length).toBe(5);
      scope.searchTerm = 'NOT-FOUND';
      scope.applyFilters();
      requests[requests.length - 1].deferred.reject({ status: 404, data: { code: 'QUOTE_NOT_FOUND', message: 'Quote not found' } });
      root.$digest();
      expect(scope.recentSearches[0].term).toBe('A-2');
      var host = mount();
      expect(host.querySelectorAll('.qm-recent-chip').length).toBe(5);
      var count = requests.length;
      scope.useSearchType('proposalId');
      root.$digest();
      scope.useRecent({ term: 'A-4', by: 'externalId' });
      expect(scope.searchTerm).toBe('A-4');
      expect(scope.searchBy).toBe('externalId');
      expect(requests.length).toBe(count + 1);
    });

    it('ignores corrupted or unavailable recent-search storage and recent items without a chosen type', function() {
      localStorage.setItem('omw-recent-searches', '{not json');
      start('QuoteListCtrl', '/search');
      expect(scope.recentSearches).toEqual([]);
      localStorage.setItem('omw-recent-searches', JSON.stringify([{ term: 'ok', by: 'externalId' }, { term: 5, by: 'externalId' }, { term: 'bad', by: 'hack' }, { term: 'old', by: 'auto' }, null]));
      scope.$destroy();
      start('QuoteListCtrl', '/search');
      expect(scope.recentSearches).toEqual([{ term: 'ok', by: 'externalId' }]);
      spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
      window.APP_CONFIG.quoteDataLookupOnly = true;
      scope.$destroy();
      start('QuoteListCtrl', '/search');
      scope.useSearchType('externalId');
      root.$digest();
      scope.searchTerm = 'B-1';
      scope.applyFilters();
      expect(function() { found(requests.length - 1, 'B-1'); }).not.toThrow();
      expect(scope.recentSearches[0].term).toBe('B-1');
    });
  });

  it('uses the visible form submit on the Search page to flush the debounce exactly once', function() {
    start('QuoteListCtrl', '/search');
    expect(requests.length).toBe(0);
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    scope.useSearchType('text');
    root.$digest();
    var input = angular.element(element[0].querySelector('#quote-search'));
    input.val('submitted');
    input.triggerHandler('input');
    angular.element(element[0].querySelector('form')).triggerHandler('submit');
    timeout.flush(300);
    expect(requests.length).toBe(1);
    expect(requests[0].params.search).toBe('submitted');
    expect(element[0].querySelector('button[type="submit"]').textContent).toBe('Search');
  });

  it('restores Back/Forward URL filters and pages on Home with exactly one request per navigation', function() {
    start('QuoteListCtrl', '/quotes?state=FAILED&page=2');
    var firstUrl = location.url();
    scope.filters.state = 'COMPLETED';
    scope.applyFilters();
    root.$digest();
    var secondUrl = location.url();
    expect(requests.length).toBe(2);
    location.url(firstUrl);
    root.$digest();
    expect(requests.length).toBe(3);
    expect(scope.filters.state).toBe('FAILED');
    expect(requests[2].params.page).toBe(2);
    location.url(secondUrl);
    root.$digest();
    expect(requests.length).toBe(4);
    expect(requests[3].params.state).toBe('COMPLETED');
    expect(requests[3].params.page).toBe(0);
  });

  it('restores Back/Forward search terms and pages on the Search page with exactly one request per navigation', function() {
    start('QuoteListCtrl', '/search?search=first&searchBy=text&page=2');
    var firstUrl = location.url();
    scope.searchTerm = 'second';
    scope.applyFilters();
    root.$digest();
    var secondUrl = location.url();
    expect(requests.length).toBe(2);
    location.url(firstUrl);
    root.$digest();
    expect(requests.length).toBe(3);
    expect(scope.searchTerm).toBe('first');
    expect(requests[2].params.page).toBe(2);
    location.url(secondUrl);
    root.$digest();
    expect(requests.length).toBe(4);
    expect(scope.searchTerm).toBe('second');
    expect(requests[3].params.search).toBe('second');
  });

  it('cancels pending search text when navigation restores another URL', function() {
    start();
    scope.searchTerm = 'discarded';
    scope.onSearchChange();
    location.url('/quotes?search=restored&page=3');
    root.$digest();
    timeout.flush(300);
    expect(requests.length).toBe(2);
    expect(scope.searchTerm).toBe('restored');
    expect(requests[1].params.page).toBe(3);
  });

  it('preserves selected and previously observed filter options on empty pages', function() {
    start('QuoteListCtrl', '/quotes?category=Saved&designStatus=REVIEW&channelType=Partner');
    resolve(0, [{ quoteRequestId: 'Q-1', category: 'Observed', channelType: 'Direct', designStatus: 'DESIGNED' }]);
    scope.refresh();
    resolve(1, []);
    expect(scope.categoryOptions).toEqual(['Observed', 'Saved']);
    expect(scope.channelTypeOptions).toEqual(['Direct', 'Partner']);
    expect(scope.designStatusOptions).toEqual(['DESIGNED', 'REVIEW']);
    expect(scope.filters.category).toBe('Saved');
  });

  it('requests a server page without slicing the current rows or duplicating URL requests', function() {
    start();
    resolve(0, [{ quoteRequestId: 'Q-1' }], { totalElements: 260, totalPages: 11 });
    scope.goToPage(10);
    root.$digest();
    expect(requests.length).toBe(2);
    expect(requests[1].params.page).toBe(10);
    expect(scope.quotes).toEqual([]);
    resolve(1, [{ quoteRequestId: 'Q-251' }], { totalElements: 260, totalPages: 11 });
    expect(scope.quotes[0].quoteRequestId).toBe('Q-251');
    expect(scope.currentPage).toBe(10);
  });

  it('does not display fake KPI zeros or old rows during an API error', function() {
    start();
    resolve(0, [{ quoteRequestId: 'Q-1', state: 'FAILED' }]);
    scope.refresh();
    expect(scope.totalElements).toBeNull();
    requests[1].deferred.reject({ status: 503, headers: function(name) { return name === 'x-tracking-id' ? 'TRACK-503' : null; } });
    root.$digest();
    expect(scope.error).toContain('retry');
    expect(scope.trackingId).toBe('TRACK-503');
    expect(scope.dataReady).toBe(false);
    expect(scope.quotes).toEqual([]);
    expect(scope.totalElements).toBeNull();
  });

  it('renders genuine empty results as success with zero matching quotes', function() {
    start();
    resolve(0, []);
    expect(scope.dataReady).toBe(true);
    expect(scope.totalElements).toBe(0);
    expect(scope.error).toBeNull();
  });

  it('keeps ticket lookup idle until a trimmed nonempty ticket is submitted', function() {
    start('SupportTicketsCtrl', '/support-tickets');
    expect(requests.length).toBe(0);
    scope.ticketNumber = '   ';
    scope.searchByTicket();
    expect(requests.length).toBe(0);
    expect(scope.validationError).toContain('ticket number');
    scope.ticketNumber = '  SKY-123  ';
    scope.searchByTicket();
    root.$digest();
    expect(requests.length).toBe(1);
    expect(requests[0].params).toEqual({ ticketNumber: 'SKY-123', page: 0, size: 25, sort: 'createdAt,desc' });
    expect(scope.ticketNumber).toBe('SKY-123');
    expect(location.search().ticketNumber).toBe('SKY-123');
  });

  it('loads every ticket result page with the committed ticket, not an unsubmitted edit', function() {
    start('SupportTicketsCtrl', '/support-tickets?ticketNumber=SUP-123');
    resolve(0, [{ quoteRequestId: 'Q-1' }], { totalElements: 76, totalPages: 4 });
    scope.ticketNumber = 'unsubmitted';
    scope.goToPage(3);
    root.$digest();
    expect(requests.length).toBe(2);
    expect(requests[1].params.ticketNumber).toBe('SUP-123');
    expect(requests[1].params.page).toBe(3);
    resolve(1, [{ quoteRequestId: 'Q-76' }], { totalElements: 76, totalPages: 4 });
    expect(scope.results[0].quoteRequestId).toBe('Q-76');
    expect(scope.ticketNumber).toBe('unsubmitted');
  });

  it('restores ticket and page from Back/Forward query state once', function() {
    start('SupportTicketsCtrl', '/support-tickets?ticketNumber=FIRST&page=1');
    location.url('/support-tickets?ticketNumber=SECOND&page=2');
    root.$digest();
    expect(requests.length).toBe(2);
    expect(scope.ticketNumber).toBe('SECOND');
    expect(requests[1].params.page).toBe(2);
    location.url('/support-tickets?ticketNumber=FIRST&page=1');
    root.$digest();
    expect(requests.length).toBe(3);
    expect(scope.lastSearchTicket).toBe('FIRST');
    expect(requests[2].params.page).toBe(1);
  });

  it('keeps the most recently searched ticket when responses arrive out of order', function() {
    start('SupportTicketsCtrl', '/support-tickets?ticketNumber=OLD');
    scope.ticketNumber = 'NEW';
    scope.searchByTicket();
    resolve(1, [{ quoteRequestId: 'NEW-QUOTE' }]);
    resolve(0, [{ quoteRequestId: 'OLD-QUOTE' }]);
    expect(scope.results[0].quoteRequestId).toBe('NEW-QUOTE');
    expect(scope.lastSearchTicket).toBe('NEW');
    expect(location.search().ticketNumber).toBe('NEW');
  });

  it('invalidates pending ticket results when cleared or submitted empty', function() {
    start('SupportTicketsCtrl', '/support-tickets?ticketNumber=OLD');
    scope.ticketNumber = '  ';
    scope.searchByTicket();
    resolve(0, [{ quoteRequestId: 'OLD-QUOTE' }]);
    expect(scope.results).toEqual([]);
    expect(scope.dataReady).toBe(false);
    scope.clearSearch();
    root.$digest();
    expect(location.search().ticketNumber).toBeUndefined();
    expect(requests.length).toBe(1);
    expect(scope.validationError).toBeNull();
  });

  it('renders all ten required columns and missing optional values in the shared component', function() {
    start();
    resolve(0, [{ quoteRequestId: 'Q /1', externalId: 'EXT-1', state: null, designStatus: null, updatedAt: null }]);
    var table = renderTable();
    var headings = Array.prototype.map.call(table.querySelectorAll('thead th'), function(node) { return node.textContent; });
    expect(headings).toEqual(['Quote Request ID', 'External ID', 'Category', 'State', 'Design Status', 'Customer Name',
      'Channel Type', 'Created At', 'Updated At', 'Support Ticket Number']);
    var cells = table.querySelectorAll('tbody td');
    expect(cells.length).toBe(10);
    expect(cells[3].textContent.trim()).toBe('—');
    expect(cells[4].textContent.trim()).toBe('—');
    expect(cells[8].textContent.trim()).toBe('—');
    expect(cells[0].querySelector('a').getAttribute('href')).toBe('#!/quotes/Q%20%2F1');
  });

  it('bounds pagination to seven page numbers with accessible first/last controls', function() {
    start('QuoteListCtrl', '/quotes?page=500');
    resolve(0, [{ quoteRequestId: 'Q-MIDDLE' }], { totalElements: 25000, totalPages: 1000 });
    var table = renderTable();
    expect(table.querySelectorAll('nav button').length).toBe(11);
    expect(table.querySelector('[aria-current="page"]').textContent).toBe('501');
    expect(table.querySelector('button[aria-label="Last page"]').textContent).toBe('Last');
    var component = componentController('quoteTable', { $element: element }, {
      currentPage: 500, totalPages: 1000, onPage: jasmine.createSpy('onPage')
    });
    expect(component.pages()).toEqual([497, 498, 499, 500, 501, 502, 503]);
    component.goToPage(999);
    expect(component.onPage).toHaveBeenCalledWith({ page: 999 });
    component.goToPage(-1);
    expect(component.onPage.calls.count()).toBe(1);
  });

  it('keeps shared loading, error, and successful-empty states mutually exclusive', function() {
    start();
    var table = renderTable();
    expect(table.querySelectorAll('.qm-skeleton-line').length).toBe(6);
    expect(table.textContent).not.toContain('No records found');
    requests[0].deferred.reject({ status: 403, data: { trackingId: 'DENIED-1' } });
    root.$digest();
    expect(table.querySelector('[role="alert"]').textContent).toContain('Access denied');
    expect(table.textContent).toContain('DENIED-1');
    expect(table.textContent).not.toContain('No records found');
    expect(table.querySelector('table')).toBeNull();
    scope.refresh();
    resolve(1, []);
    expect(table.querySelector('[role="alert"]')).toBeNull();
    expect(table.textContent).toContain('No records found — Quotes');
  });

  it('uses the same results component and labeled controls in both page templates', function() {
    [templates[templatePaths[1]], templates[templatePaths[2]]].forEach(function(template) {
      var host = document.createElement('div');
      host.innerHTML = template;
      expect(host.querySelectorAll('quote-table').length).toBe(1);
      expect(host.querySelectorAll('table').length).toBe(0);
      expect(host.querySelectorAll('.qm-mix, .qm-quick-pill, #quote-auto-refresh').length).toBe(0);
      Array.prototype.forEach.call(host.querySelectorAll('input, select'), function(input) {
        expect(host.querySelector('label[for="' + input.id + '"]')).not.toBeNull();
      });
    });
  });
});
