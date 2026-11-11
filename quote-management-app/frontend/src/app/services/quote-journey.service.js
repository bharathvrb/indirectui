'use strict';

// Turns raw step executions into one ordered sequence of steps with progress,
// and the current step. Steps keep their actual OMW names.
angular.module('quoteManagement')
  .factory('QuoteJourney', [function() {
    // Known OMW steps in flow order. Unknown steps are still shown, after the known ones.
    var FLOW = [
      'ADDRESS_VALIDATION', 'DYNAMICS_ACCOUNT_OPPORTUNITY', 'CREATE_CONTACT', 'CREATE_CUSTOMER', 'CREATE_SITE',
      'CREATE_PROPOSAL', 'CREATE_AMENDMENT_PROPOSAL', 'SEARCH_PRODUCT_OFFERING_AGREEMENT_ITEMS', 'REMOVE_PRODUCT_OFFERING',
      'ADD_SITE', 'ASSIGN_OFFERS', 'MODIFY_PRODUCT_CONFIGURATION', 'MODIFY_TERM', 'QUALIFY_APPLY_PROMOTION',
      'ADD_TRANSACTIONAL_INFORMATION', 'QUOTE_ALIGNMENT', 'QUOTE_AGGREGATOR', 'FINALIZE', 'PREPARE_FOR_VALIDATION',
      'PROPOSAL_VALIDATION', 'RETRIEVE_VALIDATION_REQUEST', 'RETRIEVE_VALIDATION_RESULTS', 'RETRIEVE_APPROVAL_RULES',
      'INITIATE_INTERNAL_APPROVAL', 'INTERNAL_APPROVAL', 'GENERATE_CONTRACT', 'CONTRACT_GENERATION',
      'RETRIEVE_DESIGN_STATUS', 'RETRIEVE_SURVEY_RESULTS'
    ];
    var INDEX = Object.create(null);
    FLOW.forEach(function(name, index) { INDEX[name] = index; });

    var TONES = {
      SUCCESS: { tone: 'success', label: 'Success', icon: 'bi-check-lg' },
      FAILURE: { tone: 'failure', label: 'Failed', icon: 'bi-x-lg' },
      IN_PROGRESS: { tone: 'progress', label: 'In progress', icon: 'bi-arrow-repeat' },
      PENDING: { tone: 'pending', label: 'Pending', icon: 'bi-circle' },
      SKIPPED: { tone: 'skipped', label: 'Skipped', icon: 'bi-skip-forward' },
      // A step that does not apply to this quote. It is shown, but progress and completion ignore it (see build).
      NOT_REQUIRED: { tone: 'notrequired', label: 'Not required', icon: 'bi-dash-circle' }
    };

    function normalizeStatus(value) {
      var status = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
      if (status === 'FAILED' || status === 'ERROR') return 'FAILURE';
      if (status === 'COMPLETED' || status === 'COMPLETE' || status === 'DONE') return 'SUCCESS';
      if (status === 'INPROGRESS' || status === 'RUNNING' || status === 'POLLING') return 'IN_PROGRESS';
      if (status === 'NEW' || status === 'NOT_STARTED' || status === '') return 'PENDING';
      if (status === 'NOTREQUIRED') return 'NOT_REQUIRED';
      return status;
    }

    function humanize(value) {
      var text = String(value === null || value === undefined ? '' : value).trim();
      if (!text) return 'Unnamed step';
      return text.replace(/_/g, ' ').toLowerCase().replace(/^\S/, function(c) { return c.toUpperCase(); });
    }

    // label is the step's actual name; index is its place in the standard flow (Infinity if unknown).
    function stepInfo(name) {
      var raw = String(name === null || name === undefined ? '' : name).trim();
      var known = INDEX[raw.toUpperCase()];
      return {
        key: raw.toUpperCase(),
        label: raw || 'Unnamed step',
        index: known === undefined ? Infinity : known
      };
    }

    function statusInfo(status) {
      var normalized = normalizeStatus(status);
      return TONES[normalized] || { tone: 'pending', label: humanize(normalized), icon: 'bi-circle' };
    }

    function number(value) {
      var parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    }

    function compare(useOrder) {
      return function(a, b) {
        if (useOrder) {
          var ao = number(a.stepOrder), bo = number(b.stepOrder);
          if (ao !== bo) return ao === null ? 1 : bo === null ? -1 : ao - bo;
        }
        if (a.info.index !== b.info.index) return a.info.index === Infinity ? 1 : b.info.index === Infinity ? -1 : a.info.index - b.info.index;
        var ad = number(a.stepDefinitionId), bd = number(b.stepDefinitionId);
        if (ad !== bd) return ad === null ? 1 : bd === null ? -1 : ad - bd;
        return a.position - b.position;
      };
    }

    // steps: normalized processing steps ({ id, stepName, stepStatus, stepOrder, attemptCount, maxRetries, startedAt, completedAt, scope, ... }).
    // Not required steps are shown like any other step, but progress ignores them: percent and completion are worked out
    // from the steps that apply, so a quote whose other steps are all Success is a completed journey.
    function build(steps) {
      var all = angular.isArray(steps) ? steps : [];
      var list = all.map(function(step, position) {
        var info = stepInfo(step.stepName);
        var status = statusInfo(step.stepStatus);
        return angular.extend({}, step, {
          info: info, label: info.label,
          // Name split after each underscore so long names wrap between words, never inside one.
          parts: info.label.match(/[^_]+_*|_+/g) || [info.label],
          status: normalizeStatus(step.stepStatus), tone: status.tone, statusLabel: status.label, icon: status.icon,
          position: position
        });
      });
      var useOrder = list.some(function(step) { return number(step.stepOrder) !== null; });
      list.sort(compare(useOrder));
      // number is the place in the list; order is the backend's own stepOrder when it sent one.
      list.forEach(function(step, index) {
        step.number = index + 1;
        step.order = number(step.stepOrder) !== null ? number(step.stepOrder) : step.number;
      });
      var count = function(tone) { return list.filter(function(step) { return step.tone === tone; }).length; };
      var notRequired = count('notrequired');
      var applicable = list.length - notRequired;
      var done = count('success') + count('skipped');
      var current = list.filter(function(step) { return step.tone === 'failure'; })[0] ||
        list.filter(function(step) { return step.tone === 'progress'; })[0] ||
        list.filter(function(step) { return step.tone === 'pending'; })[0] || null;
      return {
        steps: list, total: list.length, applicable: applicable, notRequired: notRequired, done: done, succeeded: count('success'), skipped: count('skipped'),
        failed: count('failure'), active: count('progress'), pending: count('pending'),
        percent: applicable ? Math.round(done * 100 / applicable) : 0,
        current: current,
        status: !list.length ? 'empty' : !applicable ? 'notrequired' : count('failure') ? 'failure' : done === applicable ? 'success' :
          count('progress') || done ? 'progress' : 'pending'
      };
    }

    return {
      build: build, stepInfo: stepInfo, statusInfo: statusInfo,
      normalizeStatus: normalizeStatus, humanize: humanize
    };
  }]);
