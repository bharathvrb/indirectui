describe('Unified quote detail workspace', function() {
  'use strict';
  var root, scope, q, timeout, compile, controller, service, requests, completion, element, template;

  beforeAll(function(done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/base/src/app/components/quote-detail/quote-detail.html');
    xhr.onload = function() {
      if (xhr.status !== 200) { done.fail('Cannot load quote detail template'); return; }
      template = xhr.responseText;
      done();
    };
    xhr.onerror = function() { done.fail('Cannot load quote detail template'); };
    xhr.send();
  });

  beforeEach(function() {
    requests = [];
    service = {
      getQuote: jasmine.createSpy('getQuote').and.callFake(function() {
        var deferred = q.defer();
        requests.push(deferred);
        return deferred.promise;
      }),
      completeQuote: jasmine.createSpy('completeQuote').and.callFake(function() {
        completion = q.defer();
        return completion.promise;
      }),
      canDownloadContract: jasmine.createSpy('canDownloadContract').and.returnValue(false),
      downloadContractByDmaasId: jasmine.createSpy('downloadContractByDmaasId')
    };
    angular.mock.module('quoteManagement', function($provide) {
      $provide.value('QuoteService', service);
      $provide.value('AuthService', {
        getUser: function() { return { name: 'Synthetic operator' }; },
        isAuthenticated: function() { return true; },
        getReturnUrl: function() { return '/quotes'; }
      });
    });
    angular.mock.inject(function($rootScope, $q, $timeout, $compile, $controller, $templateCache) {
      root = $rootScope; q = $q; timeout = $timeout; compile = $compile; controller = $controller;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      scope = root.$new();
      scope.canUpdateQuotes = true;
      controller('QuoteDetailCtrl', { $scope: scope, $routeParams: { id: 'Q-SYNTHETIC' } });
    });
  });

  afterEach(function() {
    scope.$destroy();
    if (element) element.remove();
    element = null;
  });

  function fixture() {
    return {
      quoteRequestId: 'Q-SYNTHETIC', status: 'OK', state: 'FAILED', externalId: 'EX-SYNTHETIC',
      customerName: 'Synthetic customer', custDivisionId: 'DIV-1', custRegionId: 'REG-1',
      existingCustomerId: 'CUST-1', existingAgreementId: 'AGR-1', amdocsCustomerId: 'AMD-1',
      quotePayload: '{"request":"synthetic"}', supportTicketNumber: 'TICKET-1',
      sites: [
        {
          id: 11, siteId: 'SITE-A', siteItemId: 'SITE-ITEM-A', siteName: 'Synthetic site A', action: 'DELETE',
          contacts: [{ id: 31, partyRefId: 'SITE-CONTACT', role: 'Technical', givenName: 'Synthetic' }],
          items: [
            { id: 21, itemId: 'ROOT', itemLevel: 0, productName: 'Synthetic root', isBundle: true },
            { id: 22, itemId: 'CHILD', parentItemId: 'ROOT', itemLevel: 1, productName: 'Synthetic child' },
            {
              id: 23, itemId: 'LEAF', parentItemId: 'CHILD', itemLevel: 2, productName: 'Synthetic leaf',
              action: 'DELETE', status: 'PENDING', sqoRootOfferInstanceId: 'ROOT-OFFER',
              prices: [{ priceType: 'Recurring', priceName: 'Synthetic fee', amount: 12, currency: 'USD' }],
              characteristics: [{ name: 'speed', displayName: 'Synthetic speed', value: '100', valueType: 'string' }],
              terms: [{ termName: 'Synthetic term', termDuration: 12, termUnits: 'months', isRequestedTerm: false }],
              promotions: [{ promotionId: 'PROMO-1', promotionName: 'Synthetic promotion', qualified: 1, applied: 0, status: 'PENDING' }]
            }
          ]
        },
        { id: 12, siteId: 'SITE-B', siteName: 'Synthetic site B', items: [{ itemId: 'OTHER', productName: 'Other synthetic item' }] }
      ],
      contacts: [{ id: 30, partyRefId: 'CUSTOMER-CONTACT', givenName: 'Synthetic contact', isSigner: false, referredType: 'Individual' }],
      stepDefinitions: [{ id: 10, stepOrder: 2, stepName: 'Provision product', maxRetries: 3 }],
      stepExecutions: [
        { id: 42, stepDefinitionId: 10, itemId: 'LEAF', stepStatus: 'FAILED', attemptCount: 1, createdAt: '2026-01-03T12:00:00Z' },
        { id: 41, stepName: 'Validate site', itemId: 'SITE-ITEM-A', stepStatus: 'SUCCESS', createdAt: '2026-01-02T12:00:00Z' },
        { id: 40, stepName: 'Old failure', itemId: 'OTHER', stepStatus: 'FAILED', createdAt: '2026-01-01T12:00:00Z' }
      ],
      errorDetails: [
        { id: 50, stepExecutionId: 40, errorCode: 'OLD', createdAt: '2026-01-01T12:01:00Z' },
        { id: 51, stepExecutionId: 42, errorSource: 'SYNTHETIC', errorCode: 'LATEST', errorMessage: 'Synthetic failure', httpStatusCode: 500, createdAt: '2026-01-03T12:01:00Z' },
        { id: 52, stepExecutionId: 42, errorCode: 'PREVIOUS', createdAt: '2026-01-03T12:00:00Z' }
      ],
      events: []
    };
  }
  function load(data, index) {
    requests[index || 0].resolve({ data: data || fixture() });
    root.$digest();
  }
  function render() {
    element = compile('<div>' + template + '</div>')(scope);
    angular.element(document.body).append(element);
    root.$digest();
    return element[0];
  }
  function flushFocus() { timeout.flush(0); }
  function key(keyName, shift) {
    return { key: keyName, shiftKey: !!shift, preventDefault: jasmine.createSpy('preventDefault') };
  }

  it('maps the direct documented response and nested products without losing contact/customer identifiers', function() {
    load();
    expect(service.getQuote).toHaveBeenCalledWith('Q-SYNTHETIC');
    expect(scope.quote.quoteRequestId).toBe('Q-SYNTHETIC');
    expect(scope.detailStats.productCount).toBe(4);
    expect(scope.sites[0].productItems[0].productOfferingName).toBe('Synthetic root');
    expect(scope.customer.custDivisionId).toBe('DIV-1');
    expect(scope.customer.existingAgreementId).toBe('AGR-1');
    expect(scope.customerContacts[0].id).toBe(30);
    expect(scope.customerContacts[0].partyRefId).toBe('CUSTOMER-CONTACT');
    expect(scope.sites[0].contacts[0].id).toBe(31);
    expect(scope.idRows.some(function(row) { return row.value === 'AMD-1'; })).toBe(true);
    expect(scope.displayValue(scope.quote.updatedAt)).toBe('—');
    expect(scope.monitoring).toBeNull();
  });

  it('keeps cyclic, self-parent, orphan, duplicate-ID and ID-less product nodes reachable', function() {
    var data = fixture();
    data.sites[0].items = [
      { itemId: 'A', parentItemId: 'B', itemLevel: 1 },
      { itemId: 'B', parentItemId: 'A', itemLevel: 1 },
      { itemId: 'SELF', parentItemId: 'SELF', itemLevel: 1 },
      { itemId: 'ORPHAN', parentItemId: 'MISSING', itemLevel: 1 },
      { itemId: 'A', productName: 'Duplicate identifier' },
      { productName: 'No identifier' }
    ];
    load(data);
    var visited = [];
    function walk(node) { expect(visited.indexOf(node)).toBe(-1); visited.push(node); node.children.forEach(walk); }
    scope.sites[0].productItems.forEach(walk);
    expect(visited.length).toBe(6);
    expect(scope.detailStats.productCount).toBe(7);
    scope.setTab('products');
    expect(function() { render(); }).not.toThrow();
  });

  it('accepts flat products with site aliases and preserves unscoped products', function() {
    var data = fixture();
    data.items = [
      { itemId: 'FLAT', siteItemId: 'SITE-ITEM-A', productName: 'Flat synthetic item' },
      { itemId: 'UNSCOPED', productName: 'Unscoped synthetic item' }
    ];
    load(data);
    expect(scope.detailStats.productCount).toBe(6);
    expect(scope.sites[0].productItems.some(function(item) { return item.itemId === 'FLAT'; })).toBe(true);
    expect(scope.sites[2].productItems[0].itemId).toBe('UNSCOPED');
    expect(scope.detailStats.siteCount).toBe(2);
  });

  it('defaults to collapsed level-one branches and focuses the exact deep item after expanding ancestors', function() {
    load();
    expect(scope.sites[0].visibleItems.map(function(item) { return item.itemId; })).toEqual(['ROOT', 'CHILD']);
    render();
    scope.setSiteFilter('SITE-B');
    scope.jumpToItem('LEAF', 'SITE-A');
    root.$digest();
    flushFocus();
    expect(scope.selectedSiteId).toBe('SITE-A');
    expect(scope.sites[0].visibleItems.map(function(item) { return item.itemId; })).toEqual(['ROOT', 'CHILD', 'LEAF']);
    expect(document.activeElement.id).toBe(scope.sites[0].visibleItems[2]._key);
    expect(document.activeElement.textContent).toContain('Synthetic leaf');
  });

  it('joins definitions, marks products with failed steps and derives site scope through execution IDs', function() {
    load();
    var latest = scope.processingSteps.filter(function(step) { return step.id === 42; })[0];
    expect(latest.stepName).toBe('Provision product');
    expect(latest.stepOrder).toBe(2);
    expect(latest.maxRetries).toBe(3);
    expect(scope.processingSteps[0].stepStatus).toBe('FAILURE');
    expect(scope.errorRows[0].siteId).toBe('SITE-A');
    expect(scope.errorRows[0].itemId).toBe('LEAF');
    expect(scope.sites[0].productItems[0].children[0].children[0]._hasFailedStep).toBe(true);
    scope.setSiteFilter('SITE-A');
    expect(scope.filteredProcessingSteps().length).toBe(2);
    expect(scope.filteredErrors().length).toBe(2);
    expect(scope.filteredSites().length).toBe(1);
    expect(scope.promotionGroups().length).toBe(1);
    scope.clearSiteFilter();
    expect(scope.filteredProcessingSteps().length).toBe(3);
    expect(scope.filteredErrors().length).toBe(3);
  });

  it('uses the latest failure and only its associated latest error in the diagnostic summary', function() {
    load();
    expect(scope.failureSummary.failingStepName).toBe('Provision product');
    expect(scope.failureSummary.errorCode).toBe('LATEST');
    expect(scope.failureSummary.errorMessage).toBe('Synthetic failure');
  });

  it('does not pair an unrelated error with a failed step without an associated error', function() {
    var data = fixture();
    data.errorDetails = data.errorDetails.slice(0, 1);
    load(data);
    expect(scope.failureSummary.errorCode).toBeNull();
    expect(scope.failureSummary.errorMessage).toBeNull();
  });

  it('focuses exact site and both top-level and nested contact references', function() {
    load();
    render();
    scope.jumpToSite('SITE-ITEM-A');
    root.$digest(); flushFocus();
    expect(document.activeElement.id).toBe('site-0');
    scope.jumpToContact(31);
    root.$digest(); flushFocus();
    expect(document.activeElement.id).toBe('site-0-contact-0');
    scope.jumpToContact('CUSTOMER-CONTACT');
    root.$digest(); flushFocus();
    expect(scope.activeTab).toBe('customer');
    expect(document.activeElement.id).toBe('customer-contact-0');
    scope.jumpToItem('MISSING');
    expect(scope.navigationNotice).toContain('not present');
  });

  it('renders every tab and keeps retry disabled when it was not enabled at load', function() {
    var config = window.APP_CONFIG, originalFeatures = config.features;
    config.features = { retryEnabled: true };
    load();
    render();
    scope.tabs.forEach(function(tab) {
      scope.setTab(tab.id);
      root.$digest();
      expect(element[0].querySelector('[role="tabpanel"]')).not.toBeNull();
      expect(element[0].querySelector('[role="tab"][aria-selected="true"]').textContent).toContain(tab.label);
    });
    scope.setTab('processing'); root.$digest();
    var retries = element[0].querySelectorAll('#detail-panel-processing button[title="Coming soon"]');
    expect(retries.length).toBe(2);
    Array.prototype.forEach.call(retries, function(button) { expect(button.disabled).toBe(true); });
    expect(element[0].textContent).toContain('Not available');
    config.features = originalFeatures;
  });

  it('shows customer, sites, products, errors and events as cards and keeps every field reachable', function() {
    load(); render();
    var panel = function(id) { scope.setTab(id); root.$digest(); return element[0].querySelector('#detail-panel-' + id); };
    var customer = panel('customer');
    expect(customer.querySelector('.qm-profile-name').textContent).toBe(scope.customer.customerName);
    expect(customer.querySelectorAll('.qm-kv').length).toBe(scope.customerDetailFields.length);
    expect(customer.querySelector('.qm-address')).not.toBeNull();
    expect(customer.querySelectorAll('qm-contact-card').length).toBe(scope.customerContacts.length);
    expect(panel('sites').querySelectorAll('.qm-site').length).toBe(scope.sites.length);
    var siteCard = element[0].querySelector('.qm-site');
    expect(siteCard.querySelector('.qm-kv-grid')).toBeNull();
    angular.element(siteCard.querySelector('.qm-more')).triggerHandler('click');
    expect(siteCard.querySelectorAll('.qm-kv-grid .qm-kv').length).toBeGreaterThan(8);
    expect(panel('products').querySelectorAll('.qm-product').length).toBe(
      scope.filteredSites().reduce(function(total, site) { return total + site.visibleItems.length; }, 0));
    expect(panel('errors').querySelectorAll('.qm-error').length).toBe(scope.filteredErrors().length);
    expect(panel('events').querySelectorAll('.qm-timeline-item').length).toBe(scope.events.length);
  });

  it('keeps customer profile fields out of the details grid and caches the one-line price', function() {
    load(); render();
    var shown = scope.customerDetailFields.map(function(field) { return field[0]; });
    ['customerName', 'tradingName', 'organizationType', 'channelType', 'customerType', 'customerSubType', 'industry', 'subIndustry']
      .forEach(function(key) { expect(shown).not.toContain(key); });
    expect(shown.length + 8).toBe(scope.customerFields.length);
    scope.customer.customerName = 'acme';
    expect(scope.customerInitial()).toBe('A');
    scope.customer.customerName = '';
    expect(scope.customerInitial()).toBe('•');
    var item = { prices: [{ amount: 12, currency: 'USD', recurringPeriod: 'month' }] };
    var first = scope.primaryPrice(item);
    expect(first).toEqual({ amount: 12, currency: 'USD', period: 'month' });
    expect(scope.primaryPrice(item)).toBe(first);
    expect(scope.primaryPrice({ prices: [] })).toBeNull();
    expect(scope.primaryPrice({ prices: [{ amount: null }] })).toBeNull();
    expect(scope.primaryPrice(null)).toBeNull();
  });

  it('supports arrow, Home and End tab navigation', function() {
    load(); render();
    scope.tabKeydown(key('ArrowRight'), 0); root.$digest(); flushFocus();
    expect(scope.activeTab).toBe('sites');
    expect(document.activeElement.id).toBe('detail-tab-sites');
    scope.tabKeydown(key('End'), 1); root.$digest(); flushFocus();
    expect(scope.activeTab).toBe('contract');
    scope.tabKeydown(key('Home'), 8); root.$digest(); flushFocus();
    expect(scope.activeTab).toBe('customer');
  });

  it('shows removed labels, promotion booleans and all expanded product detail fields', function() {
    load(); render();
    scope.jumpToItem('LEAF', 'SITE-A'); root.$digest();
    scope.sites[0].visibleItems[2]._detailsExpanded = true;
    root.$digest();
    expect(element[0].textContent).toContain('Removed');
    expect(element[0].textContent).toContain('12.00');
    expect(element[0].textContent).toContain('USD');
    expect(element[0].textContent).toContain('Requested: No');
    scope.setTab('promotions'); root.$digest();
    expect(element[0].textContent).toContain('Yes');
    expect(element[0].textContent).toContain('No');
    expect(element[0].textContent).toContain('PENDING');
  });

  it('renders invalid payload as inert raw text with the required warning', function() {
    var data = fixture();
    data.quotePayload = '<img src=x onerror="window.syntheticPayloadExecuted=true">';
    load(data); scope.setTab('payload'); render();
    expect(scope.payloadInvalid).toBe(true);
    expect(element[0].textContent).toContain('Payload is not valid JSON');
    expect(element[0].querySelector('#quote-payload').textContent).toBe(data.quotePayload);
    expect(element[0].querySelector('#quote-payload img')).toBeNull();
  });

  ['null', 'false', '0', '""', '{"value":1}'].forEach(function(payload) {
    it('accepts valid JSON payload ' + payload, function() {
      var data = fixture(); data.quotePayload = payload; load(data);
      expect(scope.payloadInvalid).toBe(false);
      expect(scope.payloadFormatted).toBe(JSON.stringify(JSON.parse(payload), null, 2));
    });
  });

  it('collapses payloads above one MiB measured in UTF-8 bytes, not character count', function() {
    var data = fixture();
    data.quotePayload = JSON.stringify({ text: new Array(400001).join('\u754c') });
    load(data);
    expect(scope.payloadFormatted.length).toBeLessThan(1024 * 1024);
    expect(scope.payloadBytes).toBeGreaterThan(1024 * 1024);
    expect(scope.showFullPayload).toBe(false);
    expect(scope.payloadTextToDisplay().length).toBeLessThan(5100);
    scope.showFullPayloadContent();
    expect(scope.payloadTextToDisplay()).toBe(scope.payloadFormatted);
  });

  it('finds and selects successive literal payload matches from the actual search input', function() {
    var data = fixture(); data.quotePayload = '{"value":"Alpha alpha ALPHA"}';
    load(data); scope.setTab('payload'); render();
    var input = element[0].querySelector('#payload-search');
    input.value = 'alpha';
    angular.element(input).triggerHandler('input');
    root.$digest();
    expect(scope.payloadSearchCount).toBe(3);
    scope.findPayloadMatch(false); root.$digest(); flushFocus();
    expect(window.getSelection().toString()).toBe('Alpha');
    scope.findPayloadMatch(true); root.$digest(); flushFocus();
    expect(window.getSelection().toString()).toBe('alpha');
  });

  it('reports clipboard success and failure instead of silently ignoring either', function() {
    load();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      var copy = spyOn(navigator.clipboard, 'writeText').and.returnValue(q.resolve());
      scope.copyPayload(); root.$digest();
      expect(copy).toHaveBeenCalledWith(scope.payloadFormatted);
      expect(scope.copyFeedback).toContain('Copied');
      copy.and.returnValue(q.reject(new Error('Synthetic denied')));
      scope.copyValue('synthetic'); root.$digest();
      expect(scope.copyFeedback).toContain('Copy unavailable');
    } else {
      spyOn(document, 'execCommand').and.returnValue(true);
      scope.copyPayload();
      expect(scope.copyFeedback).toContain('Copied');
    }
    expect(scope.canCopy(0)).toBe(true);
    expect(scope.canCopy('—')).toBe(false);
  });

  it('exports every displayed customer/address/contact field and neutralizes CSV formulas', function() {
    var data = fixture();
    data.customerName = '=HYPERLINK("synthetic")';
    data.custLatitude = 0;
    data.contacts[0].phoneNumber = '+10000000000';
    data.contacts[0].givenName = 'Synthetic, "quoted"\nname';
    load(data);
    var csv = scope.customerCsv();
    scope.customerFields.concat(scope.addressFields, scope.contactFields).forEach(function(field) {
      expect(csv).toContain('"' + field[1] + '"');
    });
    expect(csv).toContain('"\'=HYPERLINK(""synthetic"")"');
    expect(csv).toContain('"\'+' + '10000000000"');
    expect(csv).toContain('"Synthetic, ""quoted""\nname"');
    expect(csv).toContain('"Latitude","0"');
    expect(csv).toContain('"Is Signer","No"');
  });

  it('enables export for address-only data and disables it only for fully empty customer data', function() {
    load({ quoteRequestId: 'Q-SYNTHETIC', custLatitude: 0 });
    expect(scope.canExportCustomer()).toBe(true);
    scope.loadQuote();
    load({ quoteRequestId: 'Q-SYNTHETIC' }, 1);
    expect(scope.canExportCustomer()).toBe(false);
  });

  it('requires a trimmed 1–1000 character note and sends a single completion request', function() {
    load();
    render();
    scope.openCompleteDialog();
    scope.completeForm.note = '  ';
    expect(scope.canSubmitComplete()).toBe(false);
    scope.completeForm.note = new Array(1002).join('x');
    expect(scope.canSubmitComplete()).toBe(false);
    scope.completeForm.note = '  Synthetic resolution  ';
    scope.submitComplete(); scope.submitComplete();
    expect(service.completeQuote.calls.count()).toBe(1);
    expect(service.completeQuote).toHaveBeenCalledWith('Q-SYNTHETIC', 'Synthetic resolution');
    scope.closeCompleteDialog();
    expect(scope.completeDialogOpen).toBe(true);
    completion.resolve({ data: {} }); root.$digest();
    expect(service.getQuote.calls.count()).toBe(2);
    load(angular.extend(fixture(), { state: 'COMPLETED' }), 1);
    expect(scope.completeDialogOpen).toBe(false);
    expect(scope.isFailed()).toBe(false);
    expect(scope.quote.state).toBe('COMPLETED');
    flushFocus();
    expect(document.activeElement.id).toBe('quote-detail-heading');
  });

  it('keeps the typed dialog note in controller state and traps focus, Escape and return focus', function() {
    load(); render();
    var trigger = element[0].querySelector('#mark-completed');
    trigger.focus();
    angular.element(trigger).triggerHandler('click');
    root.$digest(); flushFocus();
    var note = document.getElementById('resolution-note');
    expect(document.activeElement).toBe(note);
    note.value = 'Synthetic input resolution';
    angular.element(note).triggerHandler('input');
    root.$digest();
    expect(scope.completeForm.note).toBe('Synthetic input resolution');
    scope.completeDialogKeydown(key('Tab', true));
    var buttons = document.getElementById('complete-dialog').querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[1]);
    scope.completeDialogKeydown(key('Tab'));
    expect(document.activeElement).toBe(note);
    scope.completeDialogKeydown(key('Escape')); root.$digest(); flushFocus();
    expect(scope.completeDialogOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('shows completion 403 with request tracking fallback and does not refresh', function() {
    load(); scope.openCompleteDialog(); scope.completeForm.note = 'Synthetic resolution'; scope.submitComplete();
    completion.reject({ status: 403, config: { headers: { trackingId: 'TRACE-COMPLETE' } }, headers: function() { return null; } });
    root.$digest();
    expect(scope.completeError).toContain('You are not allowed to complete this quote');
    expect(scope.completeTrackingId).toBe('TRACE-COMPLETE');
    expect(service.getQuote.calls.count()).toBe(1);
  });

  it('retains the 409 conflict explanation while refreshing state and hiding the complete action', function() {
    load(); render(); scope.openCompleteDialog(); scope.completeForm.note = 'Synthetic resolution'; scope.submitComplete();
    completion.reject({ status: 409, data: { trackingId: 'TRACE-CONFLICT' } }); root.$digest();
    expect(scope.completeError).toContain('already completed or not in a failed state');
    expect(element[0].textContent).toContain('already completed or not in a failed state');
    expect(scope.completeContext.ticketNumber).toBe('TICKET-1');
    load(angular.extend(fixture(), { state: 'COMPLETED' }), 1);
    expect(scope.canSubmitComplete()).toBe(false);
    expect(element[0].querySelector('#mark-completed')).toBeNull();
  });

  it('never invokes an unconfigured contract endpoint and leaves IDs visible and copyable', function() {
    load(angular.extend(fixture(), { dmaasIdSoa: 'SOA-SYNTHETIC', dmaasIdMsa: 'MSA-SYNTHETIC' }));
    scope.setTab('contract'); render();
    expect(element[0].textContent).toContain('SOA-SYNTHETIC');
    expect(element[0].textContent).toContain('no download endpoint is configured');
    expect(element[0].querySelector('[aria-label="Copy SOA document ID"]').disabled).toBe(false);
    scope.downloadContract('SOA');
    expect(service.downloadContractByDmaasId).not.toHaveBeenCalled();
  });

  [
    { status: 403, text: 'Access denied' }, { status: 404, text: 'Quote not found' },
    { status: 410, text: 'Quote archived' }, { status: 500, text: 'Unable to load quote details.' }
  ].forEach(function(error) {
    it('clears stale quote data and exposes tracking on HTTP ' + error.status, function() {
      load(); scope.loadQuote();
      requests[1].reject({ status: error.status, config: { headers: { trackingId: 'TRACE-REQUEST' } }, headers: function() { return null; } });
      root.$digest(); render();
      expect(scope.quote).toBeNull();
      expect(scope.customerContacts.length).toBe(0);
      expect(scope.payloadFormatted).toBe('');
      expect(scope.error).toBe(error.text);
      expect(scope.trackingId).toBe('TRACE-REQUEST');
      expect(element[0].textContent).not.toContain('Synthetic customer');
    });
  });

  it('ignores obsolete detail responses', function() {
    scope.loadQuote();
    load(angular.extend(fixture(), { externalId: 'LATEST' }), 1);
    load(angular.extend(fixture(), { externalId: 'STALE' }), 0);
    expect(scope.quote.externalId).toBe('LATEST');
  });

  it('rejects malformed success bodies instead of presenting a fabricated empty quote', function() {
    requests[0].resolve({ data: { content: [] }, config: { headers: { trackingId: 'TRACE-MALFORMED' } } });
    root.$digest();
    expect(scope.quote).toBeNull();
    expect(scope.loading).toBe(false);
    expect(scope.error).toContain('unrecognized response');
    expect(scope.trackingId).toBe('TRACE-MALFORMED');
  });
});

describe('QuoteService configured contracts and tracing', function() {
  'use strict';
  var http, service, root, config, originalConfig;
  beforeEach(function() {
    config = { contractDownloadUrl: '' };
    originalConfig = window.APP_CONFIG;
    window.APP_CONFIG = config;
    angular.mock.module('quoteManagement', function($provide) {
      $provide.constant('API_BASE_URL', 'https://synthetic.invalid');
      $provide.value('AuthService', {
        getUser: function() { return null; }, isAuthenticated: function() { return false; }, requireLogin: angular.noop
      });
      $provide.factory('AuthInterceptor', function() { return {}; });
    });
    angular.mock.inject(function($httpBackend, QuoteService, $rootScope, $templateCache) {
      http = $httpBackend; service = QuoteService; root = $rootScope;
      $templateCache.put('app/components/login/login.html', '');
    });
  });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    http.verifyNoOutstandingExpectation();
    http.verifyNoOutstandingRequest();
  });

  it('preserves the query detail endpoint and adds a tracking request header', function() {
    http.expectGET('https://synthetic.invalid/quotedata/v1/quote?quoteRequestId=Q-SYNTHETIC', function(headers) {
      return /^qm-ui-/.test(headers.trackingId);
    }).respond(200, {});
    service.getQuote('Q-SYNTHETIC');
    http.flush();
  });

  it('uses the supported external and proposal identifier query parameters', function() {
    http.expectGET('https://synthetic.invalid/quotedata/v1/quote?externalId=EXAMPLE').respond(200, {});
    http.expectGET('https://synthetic.invalid/quotedata/v1/quote?proposalId=PROPOSAL').respond(200, {});
    service.findQuote({ externalId: '  EXAMPLE  ' });
    service.findQuote({ proposalId: 'PROPOSAL' });
    http.flush();
  });

  it('rejects absent or ambiguous lookup identifiers without making a request', function() {
    var failures = [];
    service.findQuote({ search: 'untyped' }).catch(function(error) { failures.push(error); });
    service.findQuote({ externalId: 'EXAMPLE', proposalId: 'PROPOSAL' }).catch(function(error) { failures.push(error); });
    root.$digest();
    expect(failures.length).toBe(2);
    expect(failures[0].data.message).toContain('Exactly one');
  });

  it('rejects missing capability without making an HTTP request', function() {
    var failure;
    expect(service.canDownloadContract()).toBe(false);
    service.downloadContractByDmaasId('SOA', 'DOC-1').catch(function(error) { failure = error; });
    root.$digest();
    expect(failure.data.message).toContain('not configured');
  });

  it('uses only the explicitly configured download endpoint and propagates errors', function() {
    config.contractDownloadUrl = 'https://synthetic.invalid/contracts';
    expect(service.canDownloadContract()).toBe(true);
    http.expectGET('https://synthetic.invalid/contracts?dmaasId=DOC-1&documentType=SOA').respond(503, 'Synthetic unavailable');
    var failure;
    service.downloadContractByDmaasId('SOA', 'DOC-1').catch(function(error) { failure = error; });
    http.flush();
    expect(failure.status).toBe(503);
    expect(failure.config.headers.trackingId).toMatch(/^qm-ui-/);
  });
});
