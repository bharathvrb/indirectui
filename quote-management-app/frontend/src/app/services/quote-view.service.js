'use strict';

angular.module('quoteManagement')
  .factory('QuoteViewService', ['QuoteService', function(QuoteService) {
    function text(value) {
      return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    }

    function integer(value, fallback, minimum) {
      var number = Number(value);
      return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
        isFinite(number) && Math.floor(number) === number && number >= (minimum || 0)
        ? number : fallback;
    }

    function field(object, names) {
      var keys = Object.keys(object);
      for (var i = 0; i < names.length; i++) {
        var target = names[i].replace(/[^a-z0-9]/ig, '').toLowerCase();
        for (var j = 0; j < keys.length; j++) {
          var value = object[keys[j]];
          if (keys[j].replace(/[^a-z0-9]/ig, '').toLowerCase() === target &&
              value !== null && value !== undefined && !(typeof value === 'string' && !value.trim())) {
            return value;
          }
        }
      }
      return null;
    }

    function normalizeState(value) {
      var state = text(value).toUpperCase();
      if (state === 'INPROGRESS') return 'IN_PROGRESS';
      if (state === 'PENDINGAPPROVAL') return 'PENDING_APPROVAL';
      return state;
    }

    function exactQuoteId(value, searchBy) {
      var valueText = text(value);
      if (searchBy === 'quoteRequestId') return valueText;
      if (searchBy === 'text') return '';
      return /^(?:\d+-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(valueText) ? valueText : '';
    }

    function lookupCriteria(value, searchBy, lookupOnly) {
      var valueText = text(value);
      if (!valueText) return null;
      if (searchBy === 'externalId') return { externalId: valueText };
      if (searchBy === 'proposalId') return { proposalId: valueText };
      var quoteId = exactQuoteId(valueText, searchBy);
      if (quoteId) return { quoteRequestId: quoteId };
      if (lookupOnly && (!searchBy || searchBy === 'auto')) return { externalId: valueText };
      return null;
    }

    function mapQuote(raw) {
      if (!raw || typeof raw !== 'object' || angular.isArray(raw)) {
        throw new Error('Invalid quote record.');
      }
      return {
        quoteRequestId: field(raw, ['quoteRequestId', 'id']),
        externalId: field(raw, ['externalId']),
        category: field(raw, ['category']),
        state: normalizeState(field(raw, ['state'])),
        designStatus: field(raw, ['designStatus', 'designSubStatus']),
        customerName: field(raw, ['customerName']),
        channelType: field(raw, ['channelType', 'channel']),
        createdAt: field(raw, ['createdAt', 'quoteDate']),
        updatedAt: field(raw, ['updatedAt', 'lastUpdatedAt']),
        supportTicketNumber: field(raw, ['supportTicketNumber', 'ticketNumber', 'skyTicketNumber']),
        dynamicsOpportunityId: field(raw, ['dynamicsOpportunityId'])
      };
    }

    function readPage(data, params) {
      var items, total, pages, page, size;
      if (params.quoteRequestId || params.externalId || params.proposalId) {
        if (!data || typeof data !== 'object' || angular.isArray(data) ||
            !text(field(data, ['quoteRequestId'])) ||
            (params.quoteRequestId && text(field(data, ['quoteRequestId'])) !== params.quoteRequestId) ||
            (params.externalId && text(field(data, ['externalId'])) !== params.externalId)) {
          throw new Error('Invalid quote lookup response.');
        }
        return {
          items: [mapQuote(data)], totalElements: 1, totalPages: 1,
          currentPage: 0, pageSize: params.size
        };
      }
      if (angular.isArray(data)) {
        items = data;
        total = data.length;
        size = params.size;
        page = 0;
        pages = total ? 1 : 0;
        if (params.page !== 0 || total > size) throw new Error('Missing server paging metadata.');
      } else if (data && typeof data === 'object') {
        items = angular.isArray(data.content) ? data.content : data.quotes;
        total = integer(data.totalElements, null);
        size = data.size === undefined ? params.size : integer(data.size, null, 1);
        var returnedPage = data.page !== undefined ? data.page :
          (data.number !== undefined ? data.number : data.currentPage);
        page = returnedPage === undefined ? params.page : integer(returnedPage, null);
        pages = data.totalPages === undefined && total !== null && size
          ? Math.ceil(total / size) : integer(data.totalPages, null);
      }
      if (!angular.isArray(items) || total === null || total === undefined ||
          pages === null || page === null || !size || items.length > size ||
          total < items.length || (total > 0 && pages < 1) ||
          (items.length && (page >= pages || page * size + items.length > total))) {
        throw new Error('Invalid quote list response.');
      }
      return {
        items: items.map(mapQuote),
        totalElements: total,
        totalPages: pages,
        currentPage: page,
        pageSize: size
      };
    }

    function trackingId(response) {
      if (!response) return null;
      if (response.data && response.data.trackingId) return response.data.trackingId;
      var responseId = typeof response.headers === 'function' &&
        (response.headers('trackingId') || response.headers('x-tracking-id'));
      return responseId || field(response.config && response.config.headers || {}, ['trackingId', 'x-tracking-id']);
    }

    function summary(rows) {
      var result = { failed: 0, inProgress: 0, pendingApproval: 0, completed: 0, ticketLinked: 0 };
      rows.forEach(function(row) {
        if (row.state === 'FAILED') result.failed++;
        if (row.state === 'IN_PROGRESS') result.inProgress++;
        if (row.state === 'PENDING_APPROVAL') result.pendingApproval++;
        if (row.state === 'COMPLETED') result.completed++;
        if (text(row.supportTicketNumber)) result.ticketLinked++;
      });
      return result;
    }

    function createLoader(scope, rowsKey, onSuccess) {
      var generation = 0;
      var destroyed = false;
      function reset() {
        generation++;
        scope[rowsKey] = [];
        scope.loading = false;
        scope.dataReady = false;
        scope.error = null;
        scope.trackingId = null;
        scope.totalElements = null;
        scope.totalPages = null;
        scope.kpis = null;
      }
      reset();
      scope.$on('$destroy', function() { destroyed = true; generation++; });
      return {
        reset: reset,
        load: function(params) {
          reset();
          var request = generation;
          scope.loading = true;
          function fail(response, malformed) {
            if (destroyed || request !== generation) return;
            scope.loading = false;
            scope.trackingId = trackingId(response);
            var proxyError = response && response.data &&
              ['SERVICE_AUTH_NOT_CONFIGURED', 'SERVICE_TOKEN_FAILED', 'UPSTREAM_UNAUTHORIZED',
                'UPSTREAM_FORBIDDEN', 'SSO_AUTH_NOT_CONFIGURED', 'UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE']
                .indexOf(response.data.code) !== -1 && typeof response.data.message === 'string';
            scope.error = malformed
              ? 'QuoteData returned an unrecognized response. Please retry or contact support.'
              : proxyError ? response.data.message
              : response && (response.code === 'API_SCOPES_NOT_CONFIGURED' || response.code === 'LOCAL_LOGIN_API_UNAVAILABLE')
                ? response.message
              : response && response.status === 403
                ? 'Access denied. Your session does not have access to QuoteData.'
              : response && response.status === 401
                ? 'QuoteData rejected the request (401). A valid API access token is required.'
              : response && response.status === 404 && (params.quoteRequestId || params.externalId || params.proposalId)
                ? (params.quoteRequestId ? 'Quote not found for this request ID.' : 'Quote not found for this identifier.')
              : response && response.status === 0
                ? 'Cannot reach QuoteData. Check network connectivity, CORS permissions for this app origin, and HTTP/HTTPS settings.'
                : 'Unable to load quotes. Please retry.';
          }
          var operation = params.quoteRequestId
            ? QuoteService.getQuote(params.quoteRequestId)
            : params.externalId || params.proposalId
              ? QuoteService.findQuote(params.externalId ? { externalId: params.externalId } : { proposalId: params.proposalId })
            : QuoteService.getQuotes(angular.copy(params));
          operation.then(function(response) {
            if (destroyed || request !== generation) return;
            var page;
            try {
              page = readPage(response.data, params);
            } catch (error) {
              fail(response, true);
              return;
            }
            scope[rowsKey] = page.items;
            scope.totalElements = page.totalElements;
            scope.totalPages = page.totalPages;
            scope.currentPage = page.currentPage;
            scope.pageSize = page.pageSize;
            scope.kpis = summary(page.items);
            scope.loading = false;
            scope.dataReady = true;
            if (onSuccess) onSuccess(page);
          }, function(response) { fail(response, false); });
        }
      };
    }

    function dateOnly(value) {
      if (!(value instanceof Date) || isNaN(value.getTime())) return null;
      function pad(number) { return number < 10 ? '0' + number : String(number); }
      return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
    }

    function dateInput(value) {
      if (!value) return null;
      var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
      if (!match) return new Date(NaN);
      var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return dateOnly(date) === value ? date : new Date(NaN);
    }

    function stateLabel(value) {
      var labels = {
        RECEIVED: 'Received', IN_PROGRESS: 'In progress', PENDING_APPROVAL: 'Pending approval',
        COMPLETED: 'Completed', FAILED: 'Failed'
      };
      return labels[normalizeState(value)] || text(value) || '—';
    }

    return {
      text: text,
      exactQuoteId: exactQuoteId,
      lookupCriteria: lookupCriteria,
      integer: integer,
      readPage: readPage,
      createLoader: createLoader,
      dateOnly: dateOnly,
      dateInput: dateInput,
      stateLabel: stateLabel,
      displayValue: function(value) { return value === null || value === undefined || value === '' ? '—' : value; },
      stateClass: function(value) {
        var classes = {
          RECEIVED: 'bg-primary', IN_PROGRESS: 'bg-warning text-dark',
          PENDING_APPROVAL: 'bg-info text-dark', COMPLETED: 'bg-success', FAILED: 'bg-danger'
        };
        return classes[normalizeState(value)] || 'bg-secondary';
      }
    };
  }]);
