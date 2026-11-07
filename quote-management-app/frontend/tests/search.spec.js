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

  function start(name, url) {
    location.url(url || '/quotes');
    root.$digest();
    scope = root.$new();
    controller(name || 'QuoteListCtrl', { $scope: scope });
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
    expect(scope.kpis).toBeNull();
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

  it('uses externalId for non-UUID smart searches when the deployment requires identifiers', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start();
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

  it('keeps request-ID smart lookup working in lookup-only mode', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    var id = '123456789-11111111-2222-4333-8444-555555555555';
    start('QuoteListCtrl', '/quotes?search=' + id);
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
    expect(scope.searchBy).toBe('auto');
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
    start('QuoteListCtrl', '/quotes?search=' + id);
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
    expect(scope.kpis.failed).toBe(1);
    expect(scope.error).toBeNull();
  });

  it('recognizes complete UUIDs but keeps partial IDs and other text as general search', function() {
    var uuid = '11111111-2222-4333-8444-555555555555';
    expect(view.exactQuoteId('  ' + uuid + '  ', 'auto')).toBe(uuid);
    expect(view.exactQuoteId('123456789-' + uuid.slice(0, -1), 'auto')).toBe('');
    expect(view.exactQuoteId('Example customer', 'auto')).toBe('');
    expect(view.exactQuoteId(uuid, 'text')).toBe('');
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
    start('QuoteListCtrl', '/quotes?search=EXAMPLE-ID&searchBy=quoteRequestId&state=COMPLETED');
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    expect(service.getQuote).toHaveBeenCalledOnceWith('EXAMPLE-ID');
    expect(element[0].querySelector('#quote-state').disabled).toBe(true);
    expect(element[0].querySelector('#quote-from').disabled).toBe(true);
    expect(element[0].textContent).toContain('List filters are paused');
    expect(scope.filters.state).toBe('COMPLETED');
    scope.searchBy = 'text';
    scope.applyFilters();
    root.$digest();
    expect(requests[1].params.state).toBe('COMPLETED');
    expect(requests[1].params.search).toBe('EXAMPLE-ID');
    expect(element[0].querySelector('#quote-state').disabled).toBe(false);
  });

  it('does not send an empty explicit quote ID request', function() {
    start('QuoteListCtrl', '/quotes?searchBy=quoteRequestId');
    expect(requests.length).toBe(0);
    expect(scope.searchError).toBe('Enter a quote request ID.');
    scope.clearFilters();
    root.$digest();
    expect(scope.searchError).toBeNull();
    expect(requests.length).toBe(1);
    expect(requests[0].params.searchBy).toBeUndefined();
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
    expect(scope.kpis.failed).toBe(1);
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
    expect(scope.kpis.completed).toBe(1);
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

  it('uses the visible form submit to flush the debounce exactly once', function() {
    start();
    element = compile(templates[templatePaths[1]])(scope);
    root.$digest();
    var input = angular.element(element[0].querySelector('#quote-search'));
    input.val('submitted');
    input.triggerHandler('input');
    angular.element(element[0].querySelector('form')).triggerHandler('submit');
    timeout.flush(300);
    expect(requests.length).toBe(2);
    expect(requests[1].params.search).toBe('submitted');
    expect(element[0].querySelector('button[type="submit"]').textContent).toBe('Search quotes');
  });

  it('restores Back/Forward URL filters and pages with exactly one request per navigation', function() {
    start('QuoteListCtrl', '/quotes?search=first&state=FAILED&page=2');
    var firstUrl = location.url();
    scope.searchTerm = 'second';
    scope.filters.state = 'COMPLETED';
    scope.applyFilters();
    root.$digest();
    var secondUrl = location.url();
    expect(requests.length).toBe(2);
    location.url(firstUrl);
    root.$digest();
    expect(requests.length).toBe(3);
    expect(scope.searchTerm).toBe('first');
    expect(scope.filters.state).toBe('FAILED');
    expect(requests[2].params.page).toBe(2);
    location.url(secondUrl);
    root.$digest();
    expect(requests.length).toBe(4);
    expect(scope.searchTerm).toBe('second');
    expect(requests[3].params.state).toBe('COMPLETED');
    expect(requests[3].params.page).toBe(0);
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
    expect(scope.kpis).toBeNull();
    expect(scope.totalElements).toBeNull();
    requests[1].deferred.reject({ status: 503, headers: function(name) { return name === 'x-tracking-id' ? 'TRACK-503' : null; } });
    root.$digest();
    expect(scope.error).toContain('retry');
    expect(scope.trackingId).toBe('TRACK-503');
    expect(scope.dataReady).toBe(false);
    expect(scope.quotes).toEqual([]);
    expect(scope.totalElements).toBeNull();
    expect(scope.kpis).toBeNull();
  });

  it('renders genuine empty results as success with zero matching quotes', function() {
    start();
    resolve(0, []);
    expect(scope.dataReady).toBe(true);
    expect(scope.totalElements).toBe(0);
    expect(scope.kpis.failed).toBe(0);
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
      Array.prototype.forEach.call(host.querySelectorAll('.qm-kpi-card'), function(card) {
        expect(card.closest('.qm-hero-card')).not.toBeNull();
      });
      Array.prototype.forEach.call(host.querySelectorAll('input, select'), function(input) {
        expect(host.querySelector('label[for="' + input.id + '"]')).not.toBeNull();
      });
    });
  });
});
