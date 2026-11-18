'use strict';

angular.module('quoteManagement')
  .factory('QuoteService', ['$http', '$q', '$window', 'API_BASE_URL', function($http, $q, $window, API_BASE_URL) {
    var APP_CONFIG = $window.APP_CONFIG || {};
    var QUOTEDATA_BASE = API_BASE_URL.replace(/\/$/, '') + '/quotedata/v1';

    function trackingHeaders() {
      return {
        trackingId: 'qm-ui-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
      };
    }

    return {
      getQuotes: function(params) {
        return $http.get(QUOTEDATA_BASE + '/quote', {
          params: params || {},
          headers: trackingHeaders()
        });
      },

      getQuote: function(quoteRequestId) {
        return $http.get(QUOTEDATA_BASE + '/quote', {
          params: { quoteRequestId: quoteRequestId },
          headers: trackingHeaders()
        });
      },

      findQuote: function(criteria) {
        var fields = ['quoteRequestId', 'externalId', 'proposalId'].filter(function(key) {
          return criteria && typeof criteria[key] === 'string' && criteria[key].trim();
        });
        if (fields.length !== 1) {
          return $q.reject({ status: 400, data: { message: 'Exactly one quote lookup identifier is required.' } });
        }
        var params = {};
        params[fields[0]] = criteria[fields[0]].trim();
        return $http.get(QUOTEDATA_BASE + '/quote', { params: params, headers: trackingHeaders() });
      },

      // Mark completed: one PATCH sets the quote to SUCCESS and every listed step to COMPLETED.
      // QuoteData updates the database by each step's primary id (the "id" of the step in the get-quotes answer).
      completeQuote: function(quoteRequestId, steps) {
        return $http.patch(
          QUOTEDATA_BASE + '/quote/' + encodeURIComponent(quoteRequestId),
          {
            quoteRequestId: quoteRequestId,
            state: 'SUCCESS',
            stepExecutions: (steps || []).map(function(step) {
              return { id: step.id, stepName: step.stepName, stepStatus: 'COMPLETED' };
            })
          },
          { headers: trackingHeaders() }
        );
      },

      // Assumed contract: retry the whole quote. The server forwards it only when QUOTEDATA_RETRY_ENABLED=true.
      retryQuote: function(quoteRequestId) {
        return $http.post(
          QUOTEDATA_BASE + '/quote/' + encodeURIComponent(quoteRequestId) + '/retry',
          undefined,
          { headers: trackingHeaders() }
        );
      },

      canDownloadContract: function() {
        return typeof APP_CONFIG.contractDownloadUrl === 'string' && !!APP_CONFIG.contractDownloadUrl.trim();
      },

      downloadContractByDmaasId: function(documentType, dmaasId) {
        if (typeof APP_CONFIG.contractDownloadUrl !== 'string' || !APP_CONFIG.contractDownloadUrl.trim()) {
          return $q.reject({ status: 0, data: { message: 'Contract download is not configured.' } });
        }
        return $http.get(APP_CONFIG.contractDownloadUrl.trim(), {
          params: {
            documentType: documentType,
            dmaasId: dmaasId
          },
          headers: trackingHeaders(),
          responseType: 'blob'
        });
      }
    };
  }]);
