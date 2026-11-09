'use strict';

angular.module('quoteManagement')
  .factory('QuoteViewService', ['QuoteService', '$q', function(QuoteService, $q) {
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
      // Quote request IDs end in a UUID, optionally after a prefix such as "708649176-", "EXT-2026-1340-" or "PARTNER-QUOTE-1509260632-".
      return /^(?:[A-Za-z0-9_.]+(?:-[A-Za-z0-9_.]+)*-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(valueText) ? valueText : '';
    }

    // Smart search tidies what people paste from logs or JSON: wrapping quotes/backticks and a trailing comma or semicolon.
    function tidy(value) { return text(value).replace(/^[\s"'`]+|[\s"'`,;]+$/g, ''); }

    function lookupCriteria(value, searchBy, lookupOnly) {
      var valueText = text(value);
      if (!valueText) return null;
      if (searchBy === 'externalId') return { externalId: valueText };
      if (searchBy === 'proposalId') return { proposalId: valueText };
      if (searchBy === 'quoteRequestId') return { quoteRequestId: valueText };
      if (searchBy === 'text') return null;
      var smart = tidy(valueText);
      if (!smart) return null;
      // Smart search: an ID that ends in a UUID is a quote request ID; anything else is tried as an external ID.
      // Either way the other identifier is tried when the first finds nothing (see createLoader).
      var quoteId = exactQuoteId(smart, searchBy);
      if (quoteId) return { quoteRequestId: quoteId, fallbackToExternalId: true };
      if (lookupOnly) return { externalId: smart, fallbackToQuoteRequestId: true };
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
            // The server proxy always returns a safe { code, message, trackingId } body for its own errors.
            var serverMessage = response && response.data && typeof response.data.code === 'string' &&
              typeof response.data.message === 'string' ? response.data.message : null;
            scope.error = malformed
              ? 'QuoteData returned an unrecognized response. Please retry or contact support.'
              : response && response.status === 401
                ? 'Your session has expired. Sign in again to continue.'
              : response && response.status === 404 && (params.quoteRequestId || params.externalId || params.proposalId)
                ? (params.fallbackToQuoteRequestId || params.fallbackToExternalId ? 'No quote has this external ID or quote request ID.' : params.quoteRequestId ? 'Quote not found for this request ID.' : 'Quote not found for this identifier.')
              : response && response.status === 0
                ? 'Cannot reach the Quote Management server. Check that it is running and your network connection, then retry.'
              : serverMessage ? serverMessage
              : response && response.status === 403
                ? 'Access denied. Your session does not have access to QuoteData.'
                : 'Unable to load quotes. Please retry.';
          }
          var resultParams = params;
          var operation = params.quoteRequestId
            ? QuoteService.getQuote(params.quoteRequestId)
            : params.externalId || params.proposalId
              ? QuoteService.findQuote(params.externalId ? { externalId: params.externalId } : { proposalId: params.proposalId })
            : QuoteService.getQuotes(angular.copy(params));
          // Smart search tries the other identifier when the first finds nothing: a 404, a 400/422/500 from QuoteData,
          // or an empty result. Sign-in, permission, rate-limit and connection problems are reported as they are.
          var fallback = params.fallbackToExternalId && params.quoteRequestId
            ? { params: { externalId: params.quoteRequestId, page: params.page, size: params.size },
                run: function() { return QuoteService.findQuote({ externalId: params.quoteRequestId }); } }
            : params.fallbackToQuoteRequestId && params.externalId
              ? { params: { quoteRequestId: params.externalId, page: params.page, size: params.size },
                  run: function() { return QuoteService.getQuote(params.externalId); } }
              : null;
          function noMatch(response) {
            return { status: 404, data: response && response.data, headers: response && response.headers, config: response && response.config };
          }
          // A 200 that holds no quote: nothing, an empty list, or an object without a quote request ID.
          function isEmpty(response) {
            var data = response && response.data;
            if (data === null || data === undefined || data === '') return true;
            if (angular.isArray(data)) return data.length === 0;
            if (typeof data !== 'object') return false;
            var list = angular.isArray(data.content) ? data.content : data.quotes;
            return angular.isArray(list) ? list.length === 0 : !text(field(data, ['quoteRequestId']));
          }
          if (fallback) {
            var tryOther = function(first) {
              if (destroyed || request !== generation) return $q.reject(first);
              resultParams = fallback.params;
              return fallback.run().then(function(response) {
                return isEmpty(response) ? $q.reject(noMatch(response)) : response;
              }, function(response) {
                return $q.reject(response);
              });
            };
            operation = operation.then(function(response) {
              return isEmpty(response) ? tryOther(noMatch(response)) : response;
            }, function(response) {
              if (!response || [400, 404, 422, 500].indexOf(response.status) === -1) return $q.reject(response);
              return tryOther(response);
            });
          }
          operation.then(function(response) {
            if (destroyed || request !== generation) return;
            var page;
            try {
              page = readPage(response.data, resultParams);
            } catch (error) {
              fail(response, true);
              return;
            }
            scope[rowsKey] = page.items;
            scope.totalElements = page.totalElements;
            scope.totalPages = page.totalPages;
            scope.currentPage = page.currentPage;
            scope.pageSize = page.pageSize;
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
