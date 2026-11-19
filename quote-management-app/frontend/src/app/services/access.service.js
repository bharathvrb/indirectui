'use strict';

// Permission-driven screens and the wording of access errors (BXTFOMW-26558, 26563). UI side only: the server decides,
// this only hides what a person may not use and explains a refusal. While access.enabled is false nothing changes:
// allows() is true for everything and no request is made.
angular.module('quoteManagement')
  // Error codes to the wording of story 26563. Unknown codes return kind null, so the caller keeps its own message.
  .factory('AccessErrors', ['$injector', function($injector) {
    var MESSAGES = {
      scope: 'You do not have access to this quote. Contact your Sales Support lead if you believe this is an error.',
      role: 'You do not have an OMW role. Request access in myComcastAccess.',
      action: 'You are not allowed to perform this action.',
      caseSession: 'Session expired. Reopen the case from Dynamics.',
      unavailable: 'The service is temporarily unavailable. Try again shortly.'
    };
    var GUID_CODES = ['GUID_INVALID', 'GUID_USED', 'GUID_EXPIRED'];

    function trackingId(response) {
      if (!response) return null;
      if (response.data && typeof response.data.trackingId === 'string' && response.data.trackingId) return response.data.trackingId;
      var fromHeader = typeof response.headers === 'function' && (response.headers('trackingId') || response.headers('x-tracking-id'));
      if (fromHeader) return fromHeader;
      var sent = response.config && response.config.headers;
      return sent && (sent.trackingId || sent['x-tracking-id']) || null;
    }

    // kind: scope | role | action | case-session | sign-in | unavailable | null.
    // A 401 in a Dynamics case session (or a GUID error) means "reopen the case"; in a direct session it means "sign in again".
    function describe(response) {
      var status = response && typeof response.status === 'number' ? response.status : null;
      var code = response && response.data && typeof response.data.code === 'string' ? response.data.code : null;
      var result = { kind: null, code: code, message: null, trackingId: trackingId(response) };
      if (status === 403 && code === 'QUOTE_SCOPE_DENIED') {
        result.kind = 'scope'; result.message = MESSAGES.scope;
      } else if (status === 403 && code === 'ROLE_MISSING') {
        result.kind = 'role'; result.message = MESSAGES.role;
      } else if (status === 403 && code === 'ACTION_NOT_ALLOWED') {
        result.kind = 'action'; result.message = MESSAGES.action;
      } else if (status === 401) {
        var inCase = GUID_CODES.indexOf(code) !== -1 || $injector.get('AccessService').isCase();
        result.kind = inCase ? 'case-session' : 'sign-in';
        result.message = inCase ? MESSAGES.caseSession : null;
      } else if (status === 503 && (code === null || code === 'SERVICE_UNAVAILABLE')) {
        // A 503 that names its own cause (the proxy's "service authentication is not configured") keeps that explanation.
        result.kind = 'unavailable'; result.message = MESSAGES.unavailable;
      }
      return result;
    }

    return { describe: describe, trackingId: trackingId, messages: MESSAGES };
  }])

  .factory('AccessService', ['$http', '$q', '$window', 'AccessErrors', function($http, $q, $window, AccessErrors) {
    // The capability names the screens use, and the permission strings the server may send for each. Story 26563 names
    // LIST_ALL_QUOTES and "COMPLETE"; the others follow the permission table (story 26558). Matching ignores case.
    var CAPABILITIES = {
      listAll: ['LIST_ALL_QUOTES'],
      viewAny: ['VIEW_ANY_QUOTE'],
      viewAssigned: ['VIEW_ASSIGNED_QUOTE'],
      download: ['DOWNLOAD', 'DOWNLOAD_QUOTE'],
      edit: ['EDIT', 'EDIT_QUOTE'],
      complete: ['COMPLETE', 'COMPLETE_QUOTE']
    };
    var QUOTE_ID = /^[A-Za-z0-9_-]{1,200}$/;

    function settings() { return ($window.APP_CONFIG && $window.APP_CONFIG.access) || {}; }
    function enabled() { return settings().enabled === true; }
    function permissionsUrl() {
      var url = settings().permissionsUrl;
      return typeof url === 'string' && url.trim() ? url.trim() : '/api/quotemgmt/v1/me/permissions';
    }
    function blank() {
      return { status: enabled() ? 'unknown' : 'disabled', sessionType: null, quoteRequestId: null, permissions: [], code: null, trackingId: null };
    }

    var state = blank();
    var pending = null;

    function isCase() { return state.sessionType === 'CASE'; }
    function has(capability) {
      var wanted = CAPABILITIES[capability] || [];
      return state.permissions.some(function(permission) { return wanted.indexOf(permission) !== -1; });
    }

    // Is this screen or button allowed? True for everything while the feature is off. Extra names:
    //   search = open a quote by its ID (view any or view assigned) · view = open a quote · update = complete or edit.
    // A Dynamics case session never lists or searches, whatever the permission strings say (story 26558).
    function allows(capability) {
      if (!enabled()) return true;
      if (state.status !== 'ready') return false;
      if (capability === 'listAll' || capability === 'viewAny') return !isCase() && has(capability);
      if (capability === 'search') return !isCase() && (has('viewAny') || has('viewAssigned'));
      if (capability === 'view') return (!isCase() && has('viewAny')) || has('viewAssigned');
      if (capability === 'update') return has('complete') || has('edit');
      return CAPABILITIES.hasOwnProperty(capability) && has(capability);
    }

    function canOpenQuote(id) {
      if (!enabled()) return true;
      if (state.status !== 'ready') return false;
      if (isCase()) return id === state.quoteRequestId;
      return has('viewAny') || has('viewAssigned');
    }

    // Where a person who may not open the requested page should land instead.
    function landingPath() {
      if (allows('listAll')) return '/quotes';
      if (isCase() && state.quoteRequestId) return '/quotes/' + encodeURIComponent(state.quoteRequestId);
      if (allows('search')) return '/search';
      return '/no-access?reason=denied';
    }

    function apply(data) {
      var permissions = data && Array.isArray(data.permissions) ? data.permissions.filter(function(item) {
        return typeof item === 'string' && item.trim();
      }).map(function(item) { return item.trim().toUpperCase(); }) : null;
      var type = data && (data.sessionType === 'CASE' || data.sessionType === 'DIRECT') ? data.sessionType : null;
      var quote = data && typeof data.quoteRequestId === 'string' && QUOTE_ID.test(data.quoteRequestId) ? data.quoteRequestId : null;
      if (!permissions || !type || (type === 'CASE' && !quote)) {
        angular.extend(state, blank(), { status: 'unavailable', code: 'MALFORMED' });
        return;
      }
      angular.extend(state, { status: 'ready', sessionType: type, quoteRequestId: type === 'CASE' ? quote : null, permissions: permissions, code: null, trackingId: null });
    }

    function fail(response) {
      var status = response && response.status;
      var info = AccessErrors.describe(response);
      var next = status === 401 ? 'expired' : status === 403 ? (info.code === 'ROLE_MISSING' ? 'no-role' : 'denied') : 'unavailable';
      // An expired Dynamics case stays a case, so the person is told to reopen it instead of being sent to a sign-in.
      var kept = status === 401 ? { sessionType: state.sessionType } : {};
      angular.extend(state, blank(), kept, { status: next, code: info.code, trackingId: info.trackingId });
    }

    // Always resolves, with the state; the caller reads status(). Several callers share one request.
    function load(force) {
      if (!enabled()) return $q.when(state);
      if (pending) return pending;
      if (!force && state.status === 'ready') return $q.when(state);
      state.status = 'loading';
      var tracking = 'qm-ui-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      pending = $http.get(permissionsUrl(), { headers: { trackingId: tracking } }).then(function(response) {
        apply(response.data);
      }, function(response) {
        fail(response);
        if (!state.trackingId) state.trackingId = tracking;
      }).finally(function() { pending = null; }).then(function() { return state; });
      return pending;
    }

    function reset() {
      pending = null;
      angular.extend(state, blank());
    }

    return {
      isEnabled: enabled,
      load: load,
      reset: reset,
      allows: allows,
      canOpenQuote: canOpenQuote,
      landingPath: landingPath,
      isCase: isCase,
      status: function() { return state.status; },
      sessionType: function() { return state.sessionType; },
      quoteRequestId: function() { return state.quoteRequestId; },
      trackingId: function() { return state.trackingId; },
      code: function() { return state.code; },
      requestRoleUrl: function() {
        var url = settings().requestRoleUrl;
        return typeof url === 'string' && /^https:\/\//.test(url.trim()) ? url.trim() : '';
      }
    };
  }])

  // Route guard used by the routes' resolve. A refusal is a rejection that app.js turns into a redirect.
  .factory('AccessGuard', ['$q', '$location', 'AccessService', function($q, $location, access) {
    function deny(url) { return $q.reject({ redirectTo: url }); }
    function quoteIdFromPath() {
      var part = $location.path().split('/')[2] || '';
      try { return decodeURIComponent(part); } catch (error) { return part; }
    }
    return {
      // kind: list (Home, Sales Support Tickets) · search · quote
      check: function(kind) {
        if (!access.isEnabled()) return $q.when(true);
        return access.load().then(function() {
          var status = access.status();
          if (status === 'expired') return $q.reject({ expired: true, caseSession: access.isCase() });
          if (status === 'no-role') return deny('/no-access?reason=role');
          if (status === 'denied') return deny('/no-access?reason=denied');
          if (status !== 'ready') return deny('/no-access?reason=unavailable');
          if (kind === 'list' && !access.allows('listAll')) return deny(access.landingPath());
          if (kind === 'search' && !access.allows('search')) return deny(access.landingPath());
          if (kind === 'quote' && !access.canOpenQuote(quoteIdFromPath())) return deny('/no-access?reason=quote');
          return true;
        });
      }
    };
  }]);
