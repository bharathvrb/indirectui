'use strict';

// Dynamics launch, UI side (BXTFOMW-26562, 26564). The Handoff API (story 26419, "handshake endpoint for dynamics") is
// called by Dynamics' own backend and is NOT called from this UI; the UI only receives its result through the iframe
// message below and calls Initialize (story 26420). The page is framed by Dynamics; this service registers the listener
// first, sends READY to the exact Dynamics origin, accepts one HANDSHAKE, trades its one-time GUID for a one-quote
// session through the Initialize API, and navigates to /quotes/<id>. The GUID and token are held in memory only: never in
// a URL, storage or a log line. Off until APP_CONFIG.embed.enabled is true.
angular.module('quoteManagement')
  // Everything that touches the browser's window, so tests can replace it.
  .factory('FrameBridge', ['$window', function($window) {
    return {
      isFramed: function() {
        try { return $window.self !== $window.top; } catch (error) { return true; }
      },
      parentWindow: function() { return $window.parent; },
      // The origin of the page that framed this one, when the browser says so (ancestorOrigins in Chromium and Safari, else the referrer).
      parentOrigin: function() {
        try {
          var ancestors = $window.location.ancestorOrigins;
          if (ancestors && ancestors.length) return ancestors[0];
        } catch (error) { /* not available */ }
        try {
          if ($window.document.referrer) return new URL($window.document.referrer).origin;
        } catch (error) { /* not a URL */ }
        return null;
      },
      post: function(message, origin) { $window.parent.postMessage(message, origin); },
      listen: function(handler) {
        $window.addEventListener('message', handler);
        return function() { $window.removeEventListener('message', handler); };
      },
      open: function(url) {
        var opened = $window.open(url, '_blank');
        if (opened) { try { opened.opener = null; } catch (error) { /* cross-origin */ } }
        return !!opened;
      }
    };
  }])

  .factory('EmbedService', ['$window', '$http', '$timeout', '$rootScope', '$location', 'FrameBridge', 'AuthService', 'AccessService', 'AccessErrors',
    function($window, $http, $timeout, $rootScope, $location, frame, AuthService, access, AccessErrors) {
      var QUOTE_ID = /^[A-Za-z0-9_-]{1,200}$/;
      var SECRET = /^[A-Za-z0-9._~+\/=-]{8,4096}$/;
      var SOURCE_SYSTEM = 'cbsales_crm';
      var READY_EVERY_MS = 2000;
      var MESSAGES = {
        notConfigured: 'Opening a quote from Dynamics is not set up yet. Contact your administrator.',
        timeout: 'The case did not send its quote. Reopen the case from Dynamics.',
        invalid: 'The quote could not be opened. Reopen the case from Dynamics.'
      };

      function settings() {
        return angular.extend({ enabled: false, dynamicsOrigins: [], sourceSystem: '', initializeUrl: '', handshakeTimeoutMs: 10000 },
          $window.APP_CONFIG && $window.APP_CONFIG.embed || {});
      }
      function allowedOrigins() {
        var list = settings().dynamicsOrigins;
        return (angular.isArray(list) ? list : []).filter(function(origin) {
          try { return typeof origin === 'string' && origin !== 'null' && new URL(origin).origin === origin; } catch (error) { return false; }
        });
      }
      function isEnabled() { return settings().enabled === true; }
      // The handshake token is a bearer credential, so it is only ever sent to this site's own Initialize API.
      function sameOrigin(url) {
        try { return new URL(url.trim(), $window.location.origin).origin === $window.location.origin; } catch (error) { return false; }
      }
      function isConfigured() {
        var s = settings();
        return isEnabled() && allowedOrigins().length > 0 && !!s.sourceSystem &&
          typeof s.initializeUrl === 'string' && !!s.initializeUrl.trim() && sameOrigin(s.initializeUrl);
      }

      // The message Dynamics sends back: { code: 'HANDSHAKE', sourceSystem: 'cbsales_crm', details: { guid, token } }.
      function isHandshake(data) {
        return !!data && typeof data === 'object' && data.code === 'HANDSHAKE' && data.sourceSystem === SOURCE_SYSTEM &&
          !!data.details && typeof data.details === 'object' &&
          typeof data.details.guid === 'string' && SECRET.test(data.details.guid) &&
          typeof data.details.token === 'string' && SECRET.test(data.details.token);
      }

      function failure(kind, message, trackingId) { return { phase: 'failed', kind: kind, message: message, trackingId: trackingId || null }; }

      // Runs the handshake once. report(state) gets { phase: waiting | initializing | failed | done, message, trackingId }.
      // Returns { cancel } so a screen can stop it when it is left.
      function start(report) {
        var s = settings();
        var origins = allowedOrigins();
        var finished = false, accepted = false, readyTimer = null, deadline = null, stopListening = null;

        function finish(state) {
          if (finished) return;
          finished = true;
          if (stopListening) stopListening();
          if (readyTimer) $timeout.cancel(readyTimer);
          if (deadline) $timeout.cancel(deadline);
          report(state);
        }

        if (!isConfigured()) {
          finish(failure('not-configured', MESSAGES.notConfigured));
          return { cancel: angular.noop };
        }

        function sendReady() {
          var parent = frame.parentOrigin();
          var targets = parent && origins.indexOf(parent) !== -1 ? [parent] : origins;
          targets.forEach(function(origin) {
            try { frame.post({ code: 'READY', sourceSystem: s.sourceSystem }, origin); } catch (error) { /* that origin is not the parent */ }
          });
          readyTimer = $timeout(sendReady, READY_EVERY_MS);
        }

        function initialize(guid, token) {
          var tracking = 'qm-ui-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
          return $http.post(s.initializeUrl.trim(), { guid: guid }, {
            headers: { Authorization: 'Bearer ' + token, trackingId: tracking },
            withCredentials: true,
            timeout: 20000
          });
        }

        function onMessage(event) {
          // Anything from another origin, window or shape is ignored (and noted without its content).
          if (finished || accepted) return;
          if (origins.indexOf(event.origin) === -1 || event.source !== frame.parentWindow()) {
            if ($window.console) $window.console.warn('Ignored a message from an origin that is not allowed:', event.origin);
            return;
          }
          if (!isHandshake(event.data)) {
            if ($window.console) $window.console.warn('Ignored an unexpected message from', event.origin);
            return;
          }
          accepted = true;
          var guid = event.data.details.guid, token = event.data.details.token;
          if (readyTimer) $timeout.cancel(readyTimer);
          if (deadline) $timeout.cancel(deadline);
          $rootScope.$evalAsync(function() {
            report({ phase: 'initializing', message: 'Checking your access…' });
            initialize(guid, token).then(function(response) {
              var id = response.data && response.data.quoteRequestId;
              if (typeof id !== 'string' || !QUOTE_ID.test(id)) {
                finish(failure('invalid', MESSAGES.invalid, AccessErrors.trackingId(response)));
                return;
              }
              AuthService.setCaseSession({ quoteRequestId: id });
              access.load(true).then(function() {
                finished = true;
                if (stopListening) stopListening();
                report({ phase: 'done' });
                $location.path('/quotes/' + encodeURIComponent(id)).search({}).replace();
              });
            }, function(response) {
              var info = AccessErrors.describe(response);
              // At this point any 401 means the GUID or token is no good: the person must reopen the case.
              var message = response && response.status === 401 ? AccessErrors.messages.caseSession : info.message || MESSAGES.invalid;
              finish(failure(response && response.status === 401 ? 'case-session' : info.kind || 'invalid', message, info.trackingId));
            });
            guid = null; token = null;
          });
        }

        // The listener comes first, so a quick answer cannot be missed.
        stopListening = frame.listen(function(event) { onMessage(event); });
        report({ phase: 'waiting', message: 'Opening your quote…' });
        sendReady();
        deadline = $timeout(function() { finish(failure('timeout', MESSAGES.timeout)); }, Math.max(1000, Number(s.handshakeTimeoutMs) || 10000));

        return {
          cancel: function() {
            finished = true;
            if (stopListening) stopListening();
            if (readyTimer) $timeout.cancel(readyTimer);
            if (deadline) $timeout.cancel(deadline);
          }
        };
      }

      return {
        isEnabled: isEnabled,
        isConfigured: isConfigured,
        isFramed: function() { return frame.isFramed(); },
        isHandshake: isHandshake,
        messages: MESSAGES,
        start: start
      };
    }]);
