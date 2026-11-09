describe('Quote detail scenarios', function() {
  'use strict';
  var root, scope, q, timeout, location, service, loads, downloads, completion, originalConfig;

  beforeEach(function() { originalConfig = window.APP_CONFIG; });
  afterEach(function() {
    window.APP_CONFIG = originalConfig;
    if (scope) scope.$destroy();
  });

  function start(data) {
    loads = []; downloads = [];
    service = {
      getQuote: jasmine.createSpy('getQuote').and.callFake(function() { var d = q.defer(); loads.push(d); return d.promise; }),
      completeQuote: jasmine.createSpy('completeQuote').and.callFake(function() { completion = q.defer(); return completion.promise; }),
      retryStep: jasmine.createSpy('retryStep'),
      canDownloadContract: jasmine.createSpy('canDownloadContract').and.returnValue(true),
      downloadContractByDmaasId: jasmine.createSpy('download').and.callFake(function() { var d = q.defer(); downloads.push(d); return d.promise; })
    };
    angular.mock.module('quoteManagement', function($provide) {
      $provide.value('QuoteService', service);
      $provide.value('AuthService', {
        getUser: function() { return { name: 'Synthetic operator' }; },
        isAuthenticated: function() { return true; },
        getReturnUrl: function() { return '/quotes'; }
      });
    });
    angular.mock.inject(function($rootScope, $q, $timeout, $controller, $location, $templateCache) {
      root = $rootScope; q = $q; timeout = $timeout; location = $location;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      scope = root.$new();
      scope.canUpdateQuotes = true;
      $controller('QuoteDetailCtrl', { $scope: scope, $routeParams: { id: 'Q-ROUTE' } });
    });
    if (data !== undefined) {
      loads[0].resolve({ data: data });
      root.$digest();
    }
  }

  function base(extra) {
    return angular.extend({ quoteRequestId: 'Q-1', state: 'FAILED', sites: [], contacts: [], stepExecutions: [], errorDetails: [], events: [] }, extra || {});
  }

  describe('payload fallbacks when QuoteData tables are empty', function() {
    var payload = {
      relatedParty: [
        { id: 'C1', role: 'Customer', name: 'Payload customer', characteristic: [{ name: 'industry', value: 'Retail' }] },
        { id: 'P1', role: 'Contact', name: 'Payload person' }
      ],
      contactMedium: [
        { mediumType: 'PostalAddress', characteristic: { street1: '1 Payload St', city: 'Philadelphia', postCode: '19103' } },
        { mediumType: 'EmailAddress', characteristic: { contactType: 'P1:primary', emailAddress: 'person@example.com' } },
        { mediumType: 'TelephoneNumber', characteristic: { contactType: 'P1:primary', phoneNumber: '215-555-0100', extension: '9' } },
        { mediumType: 'EmailAddress', characteristic: { contactType: 'OTHER:x', emailAddress: 'other@example.com' } }
      ],
      quoteItem: [{
        id: '1', action: 'add', quantity: 2, state: 'inProgress',
        product: {
          name: 'Payload internet', isBundle: true, id: 'SPEC-1',
          productCharacteristic: [{ name: 'speed', value: '1G', valueType: 'string', displayName: 'Speed' }],
          productTerm: [{ name: '36 months', duration: { amount: 36, units: 'month' }, isRequested: true }]
        },
        productOffering: { id: 'PO-1', name: 'Payload offering', '@referredType': 'ProductOffering' },
        quoteItemPrice: [{ priceType: 'recurring', name: 'MRC', recurringChargePeriod: 'month', price: { dutyFreeAmount: { value: 99, unit: 'USD' } } },
          { priceType: 'oneTime', name: 'Install' }],
        promotion: [{ id: 'PR-1', name: 'Payload promo', qualified: 'yes', applied: 'no' }],
        quoteItem: [{ id: '1.1', product: { name: 'Payload child' } }]
      }]
    };

    it('builds customer, address, contacts and the product tree from the request payload', function() {
      start(base({ quotePayload: JSON.stringify(payload) }));
      expect(scope.customer.customerName).toBe('Payload customer');
      expect(scope.customer.industry).toBe('Retail');
      expect(scope.customerAddress.street1).toBe('1 Payload St');
      expect(scope.customerAddress.city).toBe('Philadelphia');
      expect(scope.customerContacts.length).toBe(1);
      expect(scope.customerContacts[0]).toEqual(jasmine.objectContaining({
        givenName: 'Payload person', emailAddress: 'person@example.com', phoneNumber: '215-555-0100', phoneExtension: '9', partyRefId: 'P1'
      }));
      expect(scope.sites.length).toBe(1);
      expect(scope.sites[0].siteName).toBe('Quote Level');
      var root = scope.sites[0].productItems[0];
      expect(root.productOfferingName).toBe('Payload offering');
      expect(root.isBundle).toBe(true);
      expect(root.prices[0]).toEqual(jasmine.objectContaining({ priceName: 'MRC', amount: 99, currency: 'USD' }));
      expect(root.prices[1].amount).toBeNull();
      expect(root.terms[0]).toEqual(jasmine.objectContaining({ termName: '36 months', termDuration: 36, termUnits: 'month', isRequestedTerm: true }));
      expect(root.characteristics[0].displayName).toBe('Speed');
      expect(root.children[0].productOfferingName).toBe('Payload child');
      expect(scope.promotions[0]).toEqual(jasmine.objectContaining({ promotionName: 'Payload promo', qualified: true, applied: false }));
      expect(scope.detailStats.siteCount).toBe(0);
      expect(scope.detailStats.productCount).toBe(2);
    });

    it('ignores an unreadable payload for fallbacks but still shows it as text', function() {
      start(base({ quotePayload: '{not json' }));
      expect(scope.customerContacts).toEqual([]);
      expect(scope.payloadInvalid).toBe(true);
      expect(scope.payloadTextToDisplay()).toBe('{not json');
    });

    it('collapses payloads above 1 MB until the user asks for the full text', function() {
      start(base({ quotePayload: JSON.stringify({ blob: 'x'.repeat(1100000) }) }));
      expect(scope.payloadCollapsed).toBe(true);
      expect(scope.payloadTextToDisplay()).toContain('payload preview truncated');
      scope.showFullPayloadContent();
      expect(scope.payloadTextToDisplay().length).toBeGreaterThan(1000000);
    });
  });

  describe('processing monitoring panel', function() {
    it('reads the first monitoring row from an array', function() {
      start(base({ processMonitoringExecutions: [{ pollingStatus: 'POLLING', sqoStatus: 'InProgress', isCompleted: 0, isFailed: 'false' }] }));
      expect(scope.monitoring.pollingStatus).toBe('POLLING');
      expect(scope.booleanLabel(scope.monitoring.isCompleted)).toBe('No');
      expect(scope.booleanLabel(scope.monitoring.isFailed)).toBe('No');
    });
    it('reads a single monitoring object', function() {
      start(base({ monitoring: { sqoStatus: 'Done', isCompleted: true } }));
      expect(scope.monitoring.sqoStatus).toBe('Done');
    });
    it('shows nothing for an empty array', function() {
      start(base({ processMonitoringExecutions: [] }));
      expect(scope.monitoring).toBeNull();
    });
    it('shows nothing for an empty object', function() {
      start(base({ monitoring: {} }));
      expect(scope.monitoring).toBeNull();
    });
  });

  describe('labels', function() {
    beforeEach(function() { start(base()); });
    it('labels and colors every quote state', function() {
      [['RECEIVED', 'Received', 'bg-primary'], ['inProgress', 'In Progress', 'bg-warning text-dark'],
        ['PendingApproval', 'Pending Approval', 'bg-info text-dark'], ['COMPLETED', 'Completed', 'bg-success'],
        ['FAILED', 'Failed', 'bg-danger'], ['ARCHIVED', 'ARCHIVED', 'bg-secondary'], [null, '—', 'bg-secondary']]
        .forEach(function(entry) {
          expect(scope.getStateLabel(entry[0])).toBe(entry[1]);
          expect(scope.getStateBadgeClass(entry[0])).toBe(entry[2]);
        });
    });
    it('labels and colors every step status', function() {
      [['FAILED', 'Failed', 'bg-danger'], ['INPROGRESS', 'In progress', 'bg-warning text-dark'], ['COMPLETED', 'Completed', 'bg-success'],
        ['PENDING', 'Waiting', 'bg-secondary'], ['SKIPPED', 'Skipped', 'bg-secondary'], ['', '—', 'bg-secondary']]
        .forEach(function(entry) {
          expect(scope.getStepStatusLabel(entry[0])).toBe(entry[1]);
          expect(scope.getStepStatusClass(entry[0])).toBe(entry[2]);
        });
    });
    it('formats booleans, humanizes names and maps step labels', function() {
      expect([true, 'Y', 1, 'no', 0, null, '', 'maybe'].map(scope.booleanLabel)).toEqual(['Yes', 'Yes', 'Yes', 'No', 'No', '—', '—', 'Yes']);
      expect(scope.humanize('QUOTE_ITEM')).toBe('Quote item');
      expect(scope.humanize(null)).toBe('—');
      expect(scope.stepLabel('ASSIGN_OFFERS')).toBe('ASSIGN_OFFERS');
    });
  });

  describe('navigation inside the quote', function() {
    var data = base({
      contacts: [{ id: 30, partyRefId: 'CUST-CONTACT', givenName: 'Customer contact' }],
      sites: [{ id: 11, siteId: 'SITE-A', siteName: 'A', contacts: [{ id: 31, partyRefId: 'SITE-CONTACT' }],
        items: [{ id: 21, itemId: 'ROOT', itemLevel: 0, productName: 'Root' }, { id: 22, itemId: 'CHILD', parentItemId: 'ROOT', itemLevel: 1, productName: 'Child' }] }],
      stepExecutions: [{ id: 5, stepName: 'ASSIGN_OFFERS', stepStatus: 'FAILURE', itemId: 'ROOT' }],
      errorDetails: [
        { id: 1, stepExecutionId: 5, errorSource: 'SQO', errorCode: 'A', siteId: 'SITE-A', createdAt: '2026-01-02' },
        { id: 2, errorSource: 'OMW', errorCode: 'B', contactId: 30, createdAt: '2026-01-01' }
      ]
    });

    it('moves between tabs with arrow keys and ignores other keys', function() {
      start(angular.copy(data));
      var event = { key: 'ArrowLeft', preventDefault: jasmine.createSpy('preventDefault') };
      scope.tabKeydown(event, 0);
      expect(scope.activeTab).toBe('contract');
      var other = { key: 'a', preventDefault: jasmine.createSpy('preventDefault') };
      scope.tabKeydown(other, 2);
      expect(scope.activeTab).toBe('contract');
      expect(other.preventDefault).not.toHaveBeenCalled();
    });

    it('filters errors by source, code, site and item, and clears every filter', function() {
      start(angular.copy(data));
      expect(scope.filteredErrors().length).toBe(2);
      expect(scope.errorSourceOptions).toEqual(['OMW', 'SQO']);
      scope.errorFilters.source = 'SQO';
      expect(scope.filteredErrors().map(function(r) { return r.errorCode; })).toEqual(['A']);
      scope.errorFilters = { source: '', code: 'B' };
      expect(scope.filteredErrors().map(function(r) { return r.errorCode; })).toEqual(['B']);
      scope.clearErrorFilters();
      scope.setSiteFilter('SITE-A');
      expect(scope.filteredErrors().length).toBe(1);
      expect(scope.filteredProcessingSteps().length).toBe(1);
      expect(scope.filteredSites().length).toBe(1);
      scope.errorItemId = 'OTHER';
      expect(scope.filteredErrors().length).toBe(0);
      scope.clearErrorItemFilter();
      expect(scope.errorItemId).toBe('');
      scope.clearSiteFilter();
      expect(scope.selectedSiteId).toBe('');
      expect(scope.filteredSites().length).toBe(1);
    });

    it('expands and collapses product rows with children only', function() {
      start(angular.copy(data));
      var site = scope.sites[0];
      var rootRow = site.visibleItems[0];
      expect(site.visibleItems.length).toBe(2);
      scope.toggleItem(site, rootRow);
      expect(site.visibleItems.length).toBe(1);
      scope.toggleItem(site, rootRow);
      expect(site.visibleItems.length).toBe(2);
      scope.toggleItem(site, site.visibleItems[1]);
      scope.toggleItem(site, null);
      expect(site.visibleItems.length).toBe(2);
    });

    it('jumps to sites, items, contacts and item errors, and explains missing targets', function() {
      start(angular.copy(data));
      scope.jumpToSite('SITE-A');
      expect([scope.activeTab, scope.selectedSiteId, scope.navigationNotice]).toEqual(['sites', 'SITE-A', '']);
      scope.jumpToSite('MISSING');
      expect(scope.navigationNotice).toContain('site is not present');
      scope.jumpToItem('MISSING');
      expect(scope.navigationNotice).toContain('product item is not present');
      scope.jumpToContact(30);
      expect([scope.activeTab, scope.navigationNotice]).toEqual(['customer', '']);
      scope.jumpToContact('SITE-CONTACT');
      expect([scope.activeTab, scope.selectedSiteId]).toEqual(['sites', 'SITE-A']);
      scope.jumpToContact('MISSING');
      expect(scope.navigationNotice).toContain('contact is not present');
      scope.showItemErrors(scope.sites[0].productItems[0]);
      expect([scope.activeTab, scope.errorItemId]).toEqual(['errors', 'ROOT']);
      expect(scope.sites[0].productItems[0]._hasFailedStep).toBe(true);
      timeout.flush();
    });

    it('goes back to the quote list', function() {
      start(angular.copy(data));
      scope.goBack();
      expect(location.path()).toBe('/quotes');
    });
  });

  describe('copy fallback without the clipboard API', function() {
    var clipboard;
    beforeEach(function() {
      clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      start(base());
    });
    afterEach(function() { delete navigator.clipboard; if (clipboard) Object.defineProperty(Navigator.prototype, 'clipboard', clipboard); });

    it('uses a hidden text area, restores focus and reports success or failure', function() {
      spyOn(document, 'execCommand').and.returnValues(true, false);
      scope.copyValue('VALUE-1');
      expect(scope.copyFeedback).toBe('Copied to clipboard.');
      scope.copyValue('VALUE-2');
      expect(scope.copyFeedback).toContain('Copy unavailable');
      expect(document.querySelector('.qm-copy-buffer')).toBeNull();
    });
    it('reports a failure when the browser throws, and ignores empty values', function() {
      spyOn(document, 'execCommand').and.throwError('blocked');
      scope.copyValue('VALUE');
      expect(scope.copyFeedback).toContain('Copy unavailable');
      scope.copyFeedback = '';
      scope.copyValue('—'); scope.copyValue(''); scope.copyValue(null);
      expect(scope.copyFeedback).toBe('');
      scope.payloadFormatted = '';
      scope.copyPayload();
      expect(document.execCommand).toHaveBeenCalledTimes(1);
    });
  });

  it('reports a clipboard API that throws synchronously', function() {
    start(base());
    if (!(navigator.clipboard && navigator.clipboard.writeText)) { pending('Clipboard API unavailable in this browser.'); }
    spyOn(navigator.clipboard, 'writeText').and.throwError('denied');
    scope.copyValue('VALUE');
    expect(scope.copyFeedback).toContain('Copy unavailable');
  });

  describe('downloads', function() {
    beforeEach(function() {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:synthetic');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
    });

    it('exports the customer CSV with a safe file name only when there is data', function() {
      start(base({ quoteRequestId: 'Q/1:x', customerName: 'Acme' }));
      scope.exportCustomerCsv();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(HTMLAnchorElement.prototype.click.calls.mostRecent().object.download).toBe('Q_1_x-customer.csv');
      timeout.flush(1000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
    });

    it('does not export an empty customer tab', function() {
      start(base());
      expect(scope.canExportCustomer()).toBe(false);
      scope.exportCustomerCsv();
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    });

    it('downloads SOA and MSA documents, guards repeats and reports failures with a tracking ID', function() {
      start(base({ dmaasIdSoa: 'SOA-1', dmaasIdMsa: 'MSA-1' }));
      scope.downloadContract('SOA');
      scope.downloadContract('SOA');
      expect(service.downloadContractByDmaasId).toHaveBeenCalledTimes(1);
      expect(service.downloadContractByDmaasId).toHaveBeenCalledWith('SOA', 'SOA-1');
      downloads[0].resolve({ data: 'pdf', headers: function() { return 'application/pdf'; } });
      root.$digest();
      expect(HTMLAnchorElement.prototype.click.calls.mostRecent().object.download).toBe('soa-SOA-1');
      scope.downloadContract('MSA');
      downloads[1].reject({ status: 500, data: { trackingId: 'TRACE-DOC' } });
      root.$digest();
      expect(scope.contractDownloadError).toBe('Contract download is not available for this record.');
      expect(scope.contractTrackingId).toBe('TRACE-DOC');
      expect(scope.contractDownloading).toBe(false);
    });

    it('explains that downloads are not configured, and skips missing document IDs', function() {
      start(base({ dmaasIdSoa: 'SOA-1' }));
      scope.downloadContract('MSA');
      expect(service.downloadContractByDmaasId).not.toHaveBeenCalled();
      service.canDownloadContract.and.returnValue(false);
      scope.downloadContract('SOA');
      expect(scope.contractDownloadError).toContain('no download endpoint is configured');
    });
  });

  describe('Mark completed errors', function() {
    it('shows the server message or a default message for other failures', function() {
      start(base());
      scope.openCompleteDialog();
      scope.completeForm.note = 'Fixed';
      scope.submitComplete();
      completion.reject({ status: 500, data: { message: 'Synthetic server message' } });
      root.$digest();
      expect(scope.completeError).toBe('Synthetic server message');
      scope.submitComplete();
      completion.reject({ status: 500 });
      root.$digest();
      expect(scope.completeError).toBe('Unable to complete this quote.');
    });
    it('does not open for quotes that are not failed or for users who cannot update', function() {
      start(base({ state: 'IN_PROGRESS' }));
      scope.openCompleteDialog();
      expect(scope.completeDialogOpen).toBe(false);
    });
  });

  describe('loading errors', function() {
    [
      [410, null, 'Quote archived'],
      [502, { code: 'UPSTREAM_FAILED', message: 'QuoteData is unavailable.' }, 'Unable to load quote details. QuoteData is unavailable.'],
      [500, null, 'Unable to load quote details.']
    ].forEach(function(entry) {
      it('shows "' + entry[2] + '" for a ' + entry[0] + ' response', function() {
        start();
        loads[0].reject({ status: entry[0], data: entry[1] });
        root.$digest();
        expect(scope.error).toBe(entry[2]);
        expect(scope.loading).toBe(false);
      });
    });

    it('rejects an unrecognized response instead of showing an empty quote', function() {
      start();
      loads[0].resolve({ data: [{ quoteRequestId: 'Q-1' }], headers: function() { return 'TRACE-ARRAY'; } });
      root.$digest();
      expect(scope.error).toContain('unrecognized response');
      expect(scope.trackingId).toBe('TRACE-ARRAY');
    });

    it('ignores a slow earlier response after a reload', function() {
      start();
      scope.loadQuote();
      loads[1].resolve({ data: base({ quoteRequestId: 'NEW' }) });
      root.$digest();
      loads[0].resolve({ data: base({ quoteRequestId: 'OLD' }) });
      loads[0].promise.then(angular.noop);
      root.$digest();
      expect(scope.quote.quoteRequestId).toBe('NEW');
    });
  });
});
