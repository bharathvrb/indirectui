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

      completeQuote: function(quoteRequestId, resolutionNote) {
        return $http.post(
          QUOTEDATA_BASE + '/quote/' + encodeURIComponent(quoteRequestId) + '/complete',
          { resolutionNote: resolutionNote },
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
  }])

  .factory('SupportTicketService', ['$http', 'API_BASE_URL', function($http, API_BASE_URL) {
    var BASE = API_BASE_URL + '/api/support-tickets';

    return {
      getTickets: function(params) {
        return $http.get(BASE, { params: params });
      },

      getTicket: function(id) {
        return $http.get(BASE + '/' + id);
      },

      createTicketForQuote: function(quoteId, failureReason, failureCode) {
        return $http.post(BASE + '/quote/' + quoteId, null, {
          params: {
            failureReason: failureReason,
            failureCode: failureCode || 'MANUAL'
          }
        });
      },

      updateStatus: function(id, status, resolution) {
        return $http.patch(BASE + '/' + id + '/status', null, {
          params: {
            status: status,
            resolution: resolution
          }
        });
      },

      retryFromTicket: function(id) {
        return $http.post(BASE + '/' + id + '/retry');
      },

      getStats: function() {
        return $http.get(BASE + '/stats');
      }
    };
  }])

  .factory('FileService', ['$http', 'API_BASE_URL', function($http, API_BASE_URL) {
    var BASE = API_BASE_URL + '/api/files';

    return {
      getFilesForQuote: function(quoteId) {
        return $http.get(BASE + '/quote/' + quoteId);
      },

      uploadFile: function(quoteId, file, attachmentType) {
        var fd = new FormData();
        fd.append('file', file);
        fd.append('attachmentType', attachmentType || 'QUOTE_DOCUMENT');
        return $http.post(BASE + '/quote/' + quoteId, fd, {
          headers: { 'Content-Type': undefined },
          transformRequest: angular.identity
        });
      },

      deleteFile: function(attachmentId) {
        return $http.delete(BASE + '/' + attachmentId);
      }
    };
  }])

  .factory('CustomerService', ['$http', 'API_BASE_URL', function($http, API_BASE_URL) {
    var BASE = API_BASE_URL + '/tmf-api/customerManagement/v4';

    return {
      getCustomers: function(params) {
        return $http.get(BASE + '/customer', { params: params });
      },

      getCustomer: function(id) {
        return $http.get(BASE + '/customer/' + id);
      },

      getCustomerByExternalId: function(externalId) {
        return $http.get(BASE + '/customer/ext/' + externalId);
      }
    };
  }]);
