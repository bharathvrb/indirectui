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

  describe('auto-refresh', function() {
    var interval;
    beforeEach(angular.mock.inject(function($interval) { interval = $interval; }));

    it('is off by default and reloads the current page every interval once switched on', function() {
      start();
      resolve(0, [{ quoteRequestId: 'Q-1' }]);
      expect(scope.autoRefresh).toEqual({ enabled: false, seconds: 60 });
      interval.flush(120000);
      expect(requests.length).toBe(1);
      scope.autoRefresh.enabled = true;
      scope.toggleAutoRefresh();
      interval.flush(60000);
      expect(requests.length).toBe(2);
      interval.flush(60000);
      expect(requests.length).toBe(2); // the previous refresh is still loading
      resolve(1, [{ quoteRequestId: 'Q-1' }]);
      interval.flush(60000);
      expect(requests.length).toBe(3);
      expect(scope.lastLoadedAt instanceof Date).toBe(true);
    });

    it('stops when switched off or when the page is left', function() {
      start();
      resolve(0, []);
      scope.autoRefresh.enabled = true;
      scope.toggleAutoRefresh();
      scope.autoRefresh.enabled = false;
      scope.toggleAutoRefresh();
      interval.flush(180000);
      expect(requests.length).toBe(1);
      scope.autoRefresh.enabled = true;
      scope.toggleAutoRefresh();
      scope.$destroy();
      interval.flush(180000);
      expect(requests.length).toBe(1);
    });

    it('uses a configured interval', function() {
      window.APP_CONFIG.autoRefreshSeconds = 30;
      start();
      expect(scope.autoRefresh.seconds).toBe(30);
    });

    it('ignores intervals shorter than 15 seconds', function() {
      window.APP_CONFIG.autoRefreshSeconds = 5;
      start();
      expect(scope.autoRefresh.seconds).toBe(60);
    });
  });

  describe('state mix and quick state filters', function() {
    var rows = [
      { quoteRequestId: 'A', state: 'FAILED' }, { quoteRequestId: 'B', state: 'FAILED' }, { quoteRequestId: 'C', state: 'IN_PROGRESS' },
      { quoteRequestId: 'D', state: 'COMPLETED' }, { quoteRequestId: 'E', state: 'PENDING_APPROVAL' }, { quoteRequestId: 'F', state: 'RECEIVED' }
    ];

    it('summarizes the share of each state on the page and keeps the same array until counts change', function() {
      start();
      expect(scope.stateMix()).toEqual([]);
      resolve(0, rows);
      var mix = scope.stateMix();
      expect(mix.map(function(part) { return [part.key, part.count, part.percent]; })).toEqual([
        ['failed', 2, 33.3], ['inProgress', 1, 16.7], ['pendingApproval', 1, 16.7], ['completed', 1, 16.7], ['other', 1, 16.7]
      ]);
      expect(mix[0].label).toBe('Failed');
      expect(scope.stateMix()).toBe(mix);
    });

    it('omits states with no quotes and clears when there are no results', function() {
      start();
      resolve(0, [{ quoteRequestId: 'A', state: 'FAILED' }, { quoteRequestId: 'B', state: 'FAILED' }]);
      expect(scope.stateMix().map(function(part) { return part.key; })).toEqual(['failed']);
      scope.refresh();
      resolve(1, []);
      expect(scope.stateMix()).toEqual([]);
    });

    it('lists the quick states in life-cycle order and filters by the chosen state', function() {
      start();
      resolve(0, rows);
      expect(scope.quickStates).toEqual(['RECEIVED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED']);
      scope.quickState('FAILED');
      expect(requests.length).toBe(2);
      expect(requests[1].params.state).toBe('FAILED');
      expect(scope.filters.state).toBe('FAILED');
      scope.quickState('');
      expect(requests.length).toBe(3);
      expect(requests[2].params.state).toBeUndefined();
    });

    it('renders the pills, highlights the active one and sends one request when a pill is clicked', function() {
      start();
      resolve(0, rows);
      element = compile('<div>' + templates[templatePaths[1]] + '</div>')(scope);
      root.$digest();
      var pills = element[0].querySelectorAll('.qm-quick-pill');
      expect(Array.prototype.map.call(pills, function(pill) { return pill.textContent.trim(); }))
        .toEqual(['All', 'Received', 'In progress', 'Pending approval', 'Completed', 'Failed']);
      expect(pills[0].classList.contains('active')).toBe(true);
      angular.element(pills[5]).triggerHandler('click');
      root.$digest();
      expect(requests.length).toBe(2);
      expect(requests[1].params.state).toBe('FAILED');
      expect(pills[5].classList.contains('active')).toBe(true);
      expect(pills[5].getAttribute('aria-pressed')).toBe('true');
      expect(pills[0].getAttribute('aria-pressed')).toBe('false');
      expect(element[0].querySelector('#quote-state').selectedOptions[0].textContent).toBe('Failed');
    });

    it('shows the mix bar only for several quotes in list mode', function() {
      start();
      resolve(0, rows);
      element = compile('<div>' + templates[templatePaths[1]] + '</div>')(scope);
      root.$digest();
      expect(element[0].querySelectorAll('.qm-mix-bar span').length).toBe(5);
      expect(element[0].querySelector('.qm-mix-legend').textContent.replace(/\s+/g, ' ')).toContain('Failed 2');
      scope.refresh();
      resolve(1, [{ quoteRequestId: 'A', state: 'FAILED' }]);
      expect(element[0].querySelector('.qm-mix')).toBeNull();
    });

    it('disables the pills during an exact lookup', function() {
      start('QuoteListCtrl', '/quotes?search=EXAMPLE-ID&searchBy=quoteRequestId');
      requests[0].deferred.resolve({ data: { quoteRequestId: 'EXAMPLE-ID', state: 'FAILED' } });
      root.$digest();
      element = compile('<div>' + templates[templatePaths[1]] + '</div>')(scope);
      root.$digest();
      Array.prototype.forEach.call(element[0].querySelectorAll('.qm-quick-pill'), function(pill) { expect(pill.disabled).toBe(true); });
    });
  });

  it('tones each table row by quote state', function() {
    start();
    resolve(0, [{ quoteRequestId: 'A', state: 'FAILED' }, { quoteRequestId: 'B', state: 'IN_PROGRESS' },
      { quoteRequestId: 'C', state: 'PENDING_APPROVAL' }, { quoteRequestId: 'D', state: 'COMPLETED' },
      { quoteRequestId: 'E', state: 'RECEIVED' }, { quoteRequestId: 'F', state: null }]);
    var rowsOut = renderTable().querySelectorAll('tbody tr.qm-row-hover');
    expect(Array.prototype.map.call(rowsOut, function(row) {
      return Array.prototype.filter.call(row.classList, function(name) { return /^is-/.test(name); })[0];
    })).toEqual(['is-failed', 'is-progress', 'is-approval', 'is-done', 'is-received', 'is-none']);
    var component = componentController('quoteTable', { $element: element }, {});
    expect(['inProgress', 'Pending Approval', 'unknown'].map(component.rowTone)).toEqual(['progress', 'approval', 'none']);
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

  it('recognizes quote request IDs with any prefix before the UUID', function() {
    var uuid = 'df5d85a2-3f08-4876-8848-826f2d3c1551';
    ['PARTNER-QUOTE-1509260632-' + uuid, 'EXT-20261709-1340-' + uuid, '708649176-' + uuid, 'EXT_2026.01-' + uuid, uuid.toUpperCase()]
      .forEach(function(value) { expect(view.exactQuoteId(value, 'auto')).toBe(value); });
    ['EXT-20261709-1340', 'has space-' + uuid, uuid + '-suffix', '-' + uuid, 'A--' + uuid, uuid.slice(1)]
      .forEach(function(value) { expect(view.exactQuoteId(value, 'auto')).toBe(''); });
    expect(view.lookupCriteria('PARTNER-QUOTE-1509260632-' + uuid, 'auto', true)).toEqual({ quoteRequestId: 'PARTNER-QUOTE-1509260632-' + uuid });
    expect(view.lookupCriteria('EXT-1', 'auto', true)).toEqual({ externalId: 'EXT-1', fallbackToQuoteRequestId: true });
    expect(view.lookupCriteria('EXT-1', 'externalId', true)).toEqual({ externalId: 'EXT-1' });
    expect(view.lookupCriteria('EXT-1', 'auto', false)).toBeNull();
  });

  it('retries a smart search as a quote request ID when no quote has that external ID', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=PARTNER-QUOTE-7');
    expect(service.findQuote).toHaveBeenCalledOnceWith({ externalId: 'PARTNER-QUOTE-7' });
    requests[0].deferred.reject({ status: 404, data: { code: 'QUOTE_NOT_FOUND', message: 'The requested quote was not found.' } });
    root.$digest();
    expect(service.getQuote).toHaveBeenCalledOnceWith('PARTNER-QUOTE-7');
    expect(scope.loading).toBe(true);
    requests[1].deferred.resolve({ data: { quoteRequestId: 'PARTNER-QUOTE-7', externalId: 'EXT-OTHER', state: 'FAILED' } });
    root.$digest();
    expect(scope.error).toBeNull();
    expect(scope.quotes[0].quoteRequestId).toBe('PARTNER-QUOTE-7');
  });

  it('reports a clear message when neither the external ID nor the quote request ID exists', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=NOPE-1');
    requests[0].deferred.reject({ status: 404, data: { code: 'QUOTE_NOT_FOUND', message: 'x' } });
    root.$digest();
    requests[1].deferred.reject({ status: 404, data: { code: 'QUOTE_NOT_FOUND', message: 'x', trackingId: 'TRACE-404' } });
    root.$digest();
    expect(scope.error).toBe('No quote has this external ID or quote request ID.');
    expect(scope.trackingId).toBe('TRACE-404');
  });

  it('does not fall back for other errors or for an explicit external ID search', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=EXT-500');
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

  it('ignores a fallback result that arrives after the user started another search', function() {
    window.APP_CONFIG.quoteDataLookupOnly = true;
    start('QuoteListCtrl', '/quotes?search=FIRST-1');
    requests[0].deferred.reject({ status: 404 });
    root.$digest();
    scope.searchTerm = 'SECOND-2';
    scope.applyFilters();
    root.$digest();
    requests[1].deferred.resolve({ data: { quoteRequestId: 'FIRST-1' } });
    root.$digest();
    expect(scope.loading).toBe(true);
    expect(scope.quotes).toEqual([]);
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

  describe('home page', function() {
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

    it('greets the signed-in user by first name', function() {
      start();
      expect(scope.firstName()).toBe('Test');
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(scope.greeting);
      expect(mount().querySelector('.qm-greeting').textContent).toContain(scope.greeting + ', Test');
      root.currentUser = { name: 'bharath.kumar@example.com' };
      expect(scope.firstName()).toBe('bharath');
      root.currentUser = null;
      expect(scope.firstName()).toBe('');
    });

    it('shows the lookup cards before the first search and hides the empty results card', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start();
      var host = mount();
      expect(host.querySelectorAll('.qm-start-card').length).toBe(4);
      expect(host.querySelector('a.qm-start-card').getAttribute('href')).toBe('#!/support-tickets');
      expect(host.querySelector('.qm-idle-hidden quote-table')).not.toBeNull();
      expect(host.querySelector('.qm-tips')).not.toBeNull();
    });

    it('does not show the lookup cards in list mode or once a quote has loaded', function() {
      start();
      expect(mount().querySelector('.qm-start')).toBeNull();
      expect(element[0].querySelector('.qm-idle-hidden')).toBeNull();
      scope.$destroy();
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start();
      scope.searchTerm = 'PARTNER-EXAMPLE-001';
      scope.onSearchChange();
      timeout.flush(300);
      found(0, 'PARTNER-EXAMPLE-001');
      expect(mount().querySelector('.qm-start')).toBeNull();
      expect(element[0].querySelector('.qm-idle-hidden')).toBeNull();
    });

    it('picks a lookup type from a card, clears the error and focuses the search box', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start();
      var host = mount();
      document.body.appendChild(host);
      scope.searchError = 'Enter a quote request ID.';
      angular.element(host.querySelectorAll('.qm-start-card')[1]).triggerHandler('click');
      expect(scope.searchBy).toBe('externalId');
      expect(scope.searchError).toBeNull();
      timeout.flush();
      expect(document.activeElement).toBe(host.querySelector('#quote-search'));
      expect(host.querySelectorAll('.qm-start-card')[1].classList.contains('is-selected')).toBe(true);
      document.body.removeChild(host);
    });

    it('remembers only successful exact lookups, newest first, five at most, and replays them', function() {
      window.APP_CONFIG.quoteDataLookupOnly = true;
      start();
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
      scope.useRecent({ term: 'A-4', by: 'auto' });
      expect(scope.searchTerm).toBe('A-4');
      expect(requests.length).toBe(count + 1);
    });

    it('ignores corrupted or unavailable recent-search storage', function() {
      localStorage.setItem('omw-recent-searches', '{not json');
      start();
      expect(scope.recentSearches).toEqual([]);
      localStorage.setItem('omw-recent-searches', JSON.stringify([{ term: 'ok', by: 'auto' }, { term: 5, by: 'auto' }, { term: 'bad', by: 'hack' }, null]));
      scope.$destroy();
      start();
      expect(scope.recentSearches).toEqual([{ term: 'ok', by: 'auto' }]);
      spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
      window.APP_CONFIG.quoteDataLookupOnly = true;
      scope.$destroy();
      start();
      scope.searchTerm = 'B-1';
      scope.applyFilters();
      expect(function() { found(requests.length - 1, 'B-1'); }).not.toThrow();
      expect(scope.recentSearches[0].term).toBe('B-1');
    });
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
    expect(element[0].querySelector('button[type="submit"]').textContent).toBe('Search');
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
