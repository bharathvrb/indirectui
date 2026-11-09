describe('Quote journey and step retry', function() {
  'use strict';
  var root, scope, q, timeout, compile, service, loads, retries, element, template, originalConfig;

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

  // Synthetic quote following the real OMW step names.
  function fixture(state) {
    return {
      quoteRequestId: 'PARTNER-QUOTE-1-SYNTHETIC', externalId: 'EXT-SYNTHETIC', state: state || 'FAILED',
      dynamicsAccountId: 'ACC-SYNTHETIC',
      supportTicketNumber: 'SUP-SYNTHETIC', sites: [], contacts: [],
      stepExecutions: [
        { id: 1, stepName: 'ADDRESS_VALIDATION', stepStatus: 'SUCCESS', attemptCount: 1, maxRetries: 3,
          startedAt: '2026-09-28T13:59:00Z', completedAt: '2026-09-28T13:59:04Z' },
        { id: 2, stepName: 'CREATE_CONTACT', stepStatus: 'SUCCESS', attemptCount: 1, maxRetries: 3 },
        { id: 5, stepName: 'CREATE_PROPOSAL', stepStatus: 'FAILURE', attemptCount: 3, maxRetries: 3,
          startedAt: '2026-09-28T14:00:00Z', createdAt: '2026-09-28T14:00:50Z' },
        { id: 6, stepName: 'ADD_SITE', stepStatus: 'PENDING', attemptCount: 0, maxRetries: 3, itemId: 'SITE-1' },
        { id: 9, stepName: 'CONTRACT_GENERATION', stepStatus: 'PENDING', attemptCount: 0, maxRetries: 3 }
      ],
      errorDetails: [
        { id: 70, stepExecutionId: 5, errorSource: 'CREATE_PROPOSAL', errorCode: 'CREATE_PROPOSAL_POLLING_ERROR',
          errorMessage: 'Polling API timed out', createdAt: '2026-09-28T14:00:52Z' },
        { id: 71, stepExecutionId: null, errorSource: 'GATEWAY', errorCode: 'UNLINKED', createdAt: '2026-09-28T13:00:00Z' }
      ],
      events: []
    };
  }

  function start(options) {
    options = options || {};
    window.APP_CONFIG = angular.extend({}, originalConfig, { features: { retryEnabled: !!options.retryEnabled } });
    loads = []; retries = [];
    service = {
      getQuote: jasmine.createSpy('getQuote').and.callFake(function() { var d = q.defer(); loads.push(d); return d.promise; }),
      retryStep: jasmine.createSpy('retryStep').and.callFake(function() { var d = q.defer(); retries.push(d); return d.promise; }),
      completeQuote: jasmine.createSpy('completeQuote'),
      canDownloadContract: function() { return false; }
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
      root = $rootScope; q = $q; timeout = $timeout; compile = $compile;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      scope = root.$new();
      scope.canUpdateQuotes = options.canUpdate !== false;
      $controller('QuoteDetailCtrl', { $scope: scope, $routeParams: { id: 'PARTNER-QUOTE-1-SYNTHETIC' } });
    });
    loads[0].resolve({ data: options.data || fixture() });
    root.$digest();
    element = compile('<div>' + template + '</div>')(scope);
    angular.element(document.body).append(element);
    root.$digest();
    return element[0];
  }
  function flushFocus() { timeout.flush(0); }
  function failedStep() { return scope.processingSteps.filter(function(s) { return s.id === 5; })[0]; }
  function key(name, shift) { return { key: name, shiftKey: !!shift, preventDefault: jasmine.createSpy('preventDefault') }; }

  describe('journey card', function() {
    it('shows progress and every step in order under its actual name, with no phase groups', function() {
      var page = start();
      var ring = page.querySelector('.qm-ring');
      expect(ring.getAttribute('aria-label')).toBe('2 of 5 steps completed');
      expect(ring.textContent).toContain('40%');
      // The failure panel below already names the step, so the status line stays empty then.
      expect(page.querySelector('.qm-spotlight h3').textContent).toContain('CREATE_PROPOSAL failed');
      expect(page.querySelector('.qm-journey-status').textContent.trim()).toBe('');
      expect(page.querySelectorAll('.qm-phase, .qm-phases').length).toBe(0);
      var names = Array.prototype.map.call(page.querySelectorAll('.qm-step-name'), function(n) { return n.textContent.trim(); });
      expect(names).toEqual(['ADDRESS_VALIDATION', 'CREATE_CONTACT', 'CREATE_PROPOSAL', 'ADD_SITE', 'CONTRACT_GENERATION']);
      var numbers = Array.prototype.map.call(page.querySelectorAll('.qm-step-no'), function(n) { return n.textContent.trim(); });
      expect(numbers).toEqual(['01', '02', '03', '04', '05']);
      expect(page.querySelector('.qm-step.is-failure .qm-step-meta').textContent.trim()).toBe('Failed');
      expect(page.querySelectorAll('.qm-step-desc, .qm-spotlight-desc').length).toBe(0);
      expect(page.querySelector('.qm-step.is-success .qm-step-meta').textContent.trim()).toBe('Completed');
      expect(page.querySelector('.qm-steps').textContent).not.toMatch(/attempt|\d+ ?(s|min)\b/i);
      expect(page.querySelectorAll('.qm-step.is-current').length).toBe(1);
      expect(page.querySelector('.qm-journey-counts').textContent.replace(/\s+/g, ' ')).toContain('2 done 1 failed 2 waiting');
    });

    it('shows the failure summary (UI-03) with stage, step, error code and message only when the quote failed', function() {
      var page = start();
      var summary = page.querySelector('#failure-summary');
      expect(summary.textContent).toContain('CREATE_PROPOSAL failed');
      expect(summary.textContent).toContain('Step 3 of 5');
      expect(summary.textContent).toContain('CREATE_PROPOSAL_POLLING_ERROR');
      expect(summary.textContent).toContain('Polling API timed out');
      expect(summary.textContent).not.toMatch(/attempt/i);
    });

    it('omits the failure summary while the quote is not in a failed state', function() {
      var page = start({ data: fixture('IN_PROGRESS') });
      expect(page.querySelector('#failure-summary')).toBeNull();
      expect(page.querySelector('.qm-journey')).not.toBeNull();
    });

    it('hides the journey when QuoteData returns no steps', function() {
      var data = fixture(); data.stepExecutions = []; data.errorDetails = [];
      var page = start({ data: data });
      expect(page.querySelector('.qm-journey')).toBeNull();
      expect(scope.journey.status).toBe('empty');
    });

    it('jumps to the errors tab from the failure summary', function() {
      var page = start();
      angular.element(page.querySelector('#spotlight-errors')).triggerHandler('click');
      root.$digest();
      expect(scope.activeTab).toBe('errors');
    });
  });

  describe('quote header', function() {
    it('shows the name, state, IDs, facts and counts in a light header with the actions beside the title', function() {
      var page = start();
      var head = page.querySelector('.qm-quote-head');
      expect(head).not.toBeNull();
      expect(page.querySelector('.qm-detail-hero')).toBeNull();
      expect(head.querySelector('#quote-detail-heading')).not.toBeNull();
      expect(head.querySelector('.badge').textContent.trim()).toBe('Failed');
      expect(head.querySelector('.qm-id-chip code').textContent).toBe('PARTNER-QUOTE-1-SYNTHETIC');
      var facts = Array.prototype.map.call(head.querySelectorAll('.qm-quote-fact dt'), function(dt) { return dt.textContent; });
      expect(facts).toEqual(['External ID', 'Support ticket', 'Created by', 'Design status', 'Created at', 'Updated at', 'Completed at', 'Retries']);
      expect(head.querySelector('.qm-quote-head-actions #mark-completed')).not.toBeNull();
      expect(head.querySelector('.qm-quote-head-actions .btn-primary').textContent).toContain('Mark completed');
    });

    it('keeps the "Stopped at" line when a step failed but the quote itself is not failed', function() {
      var page = start({ data: fixture('IN_PROGRESS') });
      expect(page.querySelector('.qm-spotlight')).toBeNull();
      expect(page.querySelector('.qm-journey-status').textContent).toContain('Stopped at CREATE_PROPOSAL');
    });

    it('does not repeat the tab counts as a row of chips under the header', function() {
      expect(start({ data: fixture() }).querySelector('.qm-quote-counts')).toBeNull();
    });

    it('hides Mark completed when the quote is not failed', function() {
      var page = start({ data: fixture('COMPLETED') });
      expect(page.querySelector('#mark-completed')).toBeNull();
      expect(page.querySelector('.qm-quote-head .badge').textContent.trim()).toBe('Completed');
    });
  });

  describe('copy confirmation and context chip', function() {
    it('confirms a copied ID with a check mark for a moment', function() {
      var page = start();
      if (!(navigator.clipboard && navigator.clipboard.writeText)) { pending('Clipboard API unavailable in this browser.'); }
      spyOn(navigator.clipboard, 'writeText').and.returnValue(q.resolve());
      var cell = page.querySelector('.qm-id-cell:not(.is-empty)');
      var value = cell.querySelector('code').textContent;
      angular.element(cell.querySelector('.qm-copy-btn')).triggerHandler('click');
      root.$digest();
      expect(scope.isCopied(value)).toBe(true);
      expect(cell.classList.contains('is-copied')).toBe(true);
      expect(cell.querySelector('.bi-check2')).not.toBeNull();
      timeout.flush(1800);
      expect(scope.isCopied(value)).toBe(false);
      expect(cell.classList.contains('is-copied')).toBe(false);
      expect(scope.isCopied('')).toBe(false);
    });

    it('shows the quote identity in the tab bar only once the header has scrolled away', function() {
      var page = start();
      expect(page.querySelector('.qm-tab-context')).toBeNull();
      scope.ui.compact = true;
      root.$digest();
      var chip = page.querySelector('.qm-tab-context');
      expect(chip.textContent).toContain('EXT-SYNTHETIC');
      expect(chip.textContent).toContain('Failed');
      scope.ui.compact = false;
      root.$digest();
      expect(page.querySelector('.qm-tab-context')).toBeNull();
    });
  });

  describe('when retry is not enabled (default)', function() {
    it('shows disabled "Coming soon" retry controls on failed steps and never calls the API', function() {
      var page = start();
      expect(scope.retryEnabled).toBe(false);
      var spotlight = page.querySelector('#spotlight-retry');
      expect(spotlight.disabled).toBe(true);
      expect(spotlight.getAttribute('title')).toBe('Coming soon');
      expect(page.querySelector('.qm-soon').textContent).toContain('Retry coming soon');
      scope.setTab('processing'); root.$digest();
      var processing = page.querySelectorAll('#detail-panel-processing button[title="Coming soon"]');
      expect(processing.length).toBe(1);
      expect(processing[0].disabled).toBe(true);
      scope.openRetryDialog(failedStep()); root.$digest();
      expect(scope.retry.open).toBe(false);
      expect(service.retryStep).not.toHaveBeenCalled();
    });

    it('shows a retry control on every error row, all disabled', function() {
      var page = start();
      scope.setTab('errors'); root.$digest();
      var buttons = page.querySelectorAll('#detail-panel-errors td button[title]');
      var retry = Array.prototype.filter.call(buttons, function(b) { return /Retry/.test(b.textContent); });
      expect(retry.length).toBe(2);
      retry.forEach(function(button) { expect(button.disabled).toBe(true); });
    });
  });

  describe('when retry is enabled', function() {
    it('enables retry only for failed steps the user can update', function() {
      var page = start({ retryEnabled: true });
      expect(page.querySelector('#spotlight-retry').disabled).toBe(false);
      expect(scope.retryTitle(failedStep())).toBe('Retry this step');
      expect(scope.canRetry(scope.processingSteps.filter(function(s) { return s.id === 1; })[0])).toBe(false);
      expect(scope.retryTitle(scope.processingSteps.filter(function(s) { return s.id === 1; })[0])).toBe('Only failed steps can be retried');
      expect(scope.canRetry(null)).toBe(false);
      scope.setTab('processing'); root.$digest();
      var buttons = page.querySelectorAll('#detail-panel-processing button[title="Retry this step"]');
      expect(buttons.length).toBe(1);
      expect(buttons[0].disabled).toBe(false);
      scope.setTab('errors'); root.$digest();
      var linked = page.querySelectorAll('#detail-panel-errors button[title="Retry this step"]');
      var unlinked = page.querySelectorAll('#detail-panel-errors button[title="Only failed steps can be retried"]');
      expect(linked.length).toBe(1);
      expect(unlinked.length).toBe(1);
      expect(unlinked[0].disabled).toBe(true);
    });

    it('disables retry without update permission or after the quote was completed', function() {
      start({ retryEnabled: true, canUpdate: false });
      expect(scope.canRetry(failedStep())).toBe(false);
      scope.canUpdateQuotes = true;
      expect(scope.canRetry(failedStep())).toBe(true);
      scope.completionSucceeded = true;
      expect(scope.canRetry(failedStep())).toBe(false);
    });

    it('confirms in a dialog that names the step, attempts and exhausted retries, with focus management', function() {
      var page = start({ retryEnabled: true });
      var trigger = page.querySelector('#spotlight-retry');
      trigger.focus();
      angular.element(trigger).triggerHandler('click');
      root.$digest(); flushFocus();
      var dialog = document.getElementById('retry-dialog');
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.textContent).toContain('Retry CREATE_PROPOSAL?');
      expect(dialog.textContent).toContain('3 of 3');
      expect(dialog.textContent).toContain('Automatic retries are used up');
      expect(document.activeElement.id).toBe('retry-confirm');
      scope.retryDialogKeydown(key('Tab')); // confirm is last: wraps to first
      expect(document.activeElement.textContent.trim()).toBe('Cancel');
      scope.retryDialogKeydown(key('Tab', true)); // first: wraps to last
      expect(document.activeElement.id).toBe('retry-confirm');
      var escape = key('Escape');
      scope.retryDialogKeydown(escape); root.$digest(); flushFocus();
      expect(escape.preventDefault).toHaveBeenCalled();
      expect(scope.retry.open).toBe(false);
      expect(document.getElementById('retry-dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(service.retryStep).not.toHaveBeenCalled();
    });

    it('omits the exhausted-retries warning when attempts remain', function() {
      var data = fixture(); data.stepExecutions[2].attemptCount = 1;
      start({ retryEnabled: true, data: data });
      scope.openRetryDialog(failedStep()); root.$digest();
      expect(document.getElementById('retry-dialog').textContent).not.toContain('Automatic retries are used up');
    });

    it('sends one retry request even on double submit, then confirms and reloads the quote', function() {
      start({ retryEnabled: true });
      var step = failedStep();
      scope.openRetryDialog(step); root.$digest();
      scope.submitRetry(); scope.submitRetry(); root.$digest();
      expect(service.retryStep).toHaveBeenCalledTimes(1);
      expect(service.retryStep).toHaveBeenCalledWith('PARTNER-QUOTE-1-SYNTHETIC', 5);
      expect(document.getElementById('retry-confirm').disabled).toBe(true);
      expect(document.getElementById('retry-confirm').textContent).toContain('Requesting');
      retries[0].resolve({ status: 202 }); root.$digest();
      expect(scope.retry.open).toBe(false);
      expect(scope.copyFeedback).toBe('Retry requested for CREATE_PROPOSAL.');
      expect(service.getQuote).toHaveBeenCalledTimes(2);
      expect(scope.retryRequested['5']).toBe(true);
      expect(scope.canRetry(step)).toBe(false);
      expect(scope.retryTitle(step)).toBe('Retry requested');
      loads[1].resolve({ data: fixture() }); root.$digest();
      expect(scope.canRetry(failedStep())).toBe(false); // still marked as requested after the reload
      timeout.flush(3500);
      expect(scope.copyFeedback).toBe('');
    });

    it('cannot be cancelled while the request is in flight', function() {
      start({ retryEnabled: true });
      scope.openRetryDialog(failedStep()); root.$digest();
      scope.submitRetry(); root.$digest();
      scope.closeRetryDialog(); root.$digest();
      expect(scope.retry.open).toBe(true);
    });

    [
      [403, null, 'You are not allowed to retry this step.', false],
      [404, null, 'This step was not found. Reload the quote and try again.', false],
      [409, null, 'This step is no longer failed or is already being retried.', true],
      [501, { code: 'RETRY_NOT_AVAILABLE', message: 'Step retry is not available yet.' }, 'Retry is not available yet.', false],
      [0, null, 'Cannot reach the Quote Management server. Check your connection and try again.', false],
      [502, { code: 'UPSTREAM_FAILED', message: 'QuoteData is unavailable.', trackingId: 'TRACE-RETRY' }, 'QuoteData is unavailable.', false],
      [500, null, 'Unable to retry this step.', false]
    ].forEach(function(entry) {
      it('explains a ' + entry[0] + ' retry failure and allows another attempt', function() {
        start({ retryEnabled: true });
        scope.openRetryDialog(failedStep()); root.$digest();
        scope.submitRetry(); root.$digest();
        retries[0].reject({ status: entry[0], data: entry[1], headers: function() { return null; }, config: { headers: { trackingId: 'TRACE-CLIENT' } } });
        root.$digest();
        expect(scope.retry.error).toBe(entry[2]);
        expect(scope.retry.open).toBe(true);
        expect(scope.retry.submitting).toBe(false);
        expect(scope.retry.trackingId).toBe(entry[1] && entry[1].trackingId || 'TRACE-CLIENT');
        expect(document.getElementById('retry-dialog').textContent).toContain(entry[2]);
        expect(service.getQuote).toHaveBeenCalledTimes(entry[3] ? 2 : 1);
        expect(scope.retryRequested['5']).toBeUndefined();
        if (!entry[3]) {
          scope.submitRetry(); root.$digest();
          expect(service.retryStep).toHaveBeenCalledTimes(2);
        }
      });
    });

    it('retries the failed step linked to an error row', function() {
      start({ retryEnabled: true });
      var row = scope.errorRows.filter(function(r) { return r.stepExecutionId === 5; })[0];
      expect(scope.stepForError(row).id).toBe(5);
      expect(scope.stepForError(scope.errorRows.filter(function(r) { return r.stepExecutionId === null; })[0])).toBeNull();
      expect(scope.stepForError(null)).toBeNull();
      scope.openRetryDialog(scope.stepForError(row)); root.$digest();
      scope.submitRetry(); root.$digest();
      expect(service.retryStep).toHaveBeenCalledWith('PARTNER-QUOTE-1-SYNTHETIC', 5);
    });
  });
});
