'use strict';

angular.module('quoteManagement')
  .component('quoteTable', {
    bindings: {
      rows: '<', loading: '<', error: '<', trackingId: '<', ready: '<',
      currentPage: '<', totalPages: '<', totalElements: '<', pageSize: '<',
      emptyMessage: '@', idleMessage: '@', onPage: '&', onRetry: '&'
    },
    templateUrl: 'app/components/shared/quote-table.html',
    controller: ['QuoteViewService', '$element', '$timeout', function(QuoteViewService, $element, $timeout) {
      var ctrl = this;
      var focusAfterPage = false;
      var focusTimer;
      ctrl.value = QuoteViewService.displayValue;
      ctrl.stateLabel = QuoteViewService.stateLabel;
      ctrl.stateClass = QuoteViewService.stateClass;
      ctrl.rowTone = function(state) {
        var value = String(state || '').toUpperCase().replace(/[^A-Z]/g, '');
        return { FAILED: 'failed', INPROGRESS: 'progress', PENDINGAPPROVAL: 'approval', COMPLETED: 'done', RECEIVED: 'received' }[value] || 'none';
      };
      ctrl.quoteHref = function(id) { return '#!/quotes/' + encodeURIComponent(id); };
      ctrl.pages = function() {
        var pages = [];
        var start = Math.max(0, Math.min(ctrl.currentPage - 3, ctrl.totalPages - 7));
        for (var page = start; page < Math.min(ctrl.totalPages, start + 7); page++) pages.push(page);
        return pages;
      };
      ctrl.goToPage = function(page) {
        if (ctrl.loading || page < 0 || page >= ctrl.totalPages || page === ctrl.currentPage) return;
        focusAfterPage = true;
        ctrl.onPage({ page: page });
      };
      ctrl.$onChanges = function() {
        if (focusAfterPage && !ctrl.loading && (ctrl.ready || ctrl.error)) {
          focusAfterPage = false;
          focusTimer = $timeout(function() {
            var heading = $element[0].querySelector('.qm-results-heading');
            if (heading) heading.focus();
          }, 0, false);
        }
      };
      ctrl.$onDestroy = function() { if (focusTimer) $timeout.cancel(focusTimer); };
      ctrl.firstRow = function() { return ctrl.rows && ctrl.rows.length ? ctrl.currentPage * ctrl.pageSize + 1 : 0; };
      ctrl.lastRow = function() { return ctrl.rows && ctrl.rows.length ? ctrl.currentPage * ctrl.pageSize + ctrl.rows.length : 0; };
    }]
  });
