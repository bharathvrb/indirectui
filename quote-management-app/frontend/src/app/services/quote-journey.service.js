'use strict';

// Turns raw step executions into one ordered sequence of steps with progress,
// the current step and durations. Steps keep their actual OMW names.
angular.module('quoteManagement')
  .factory('QuoteJourney', [function() {
    // Known OMW steps in flow order, each with a one-line description. Unknown steps
    // are still shown, after the known ones.
    var CATALOG = [
      ['ADDRESS_VALIDATION', 'Validate the customer and service addresses'],
      ['DYNAMICS_ACCOUNT_OPPORTUNITY', 'Create the Dynamics account and opportunity'],
      ['CREATE_CONTACT', 'Create the customer contacts in Dynamics'],
      ['CREATE_CUSTOMER', 'Create the customer in Amdocs'],
      ['CREATE_SITE', 'Create the service sites and addresses'],
      ['CREATE_PROPOSAL', 'Create the SQO proposal'],
      ['CREATE_AMENDMENT_PROPOSAL', 'Create the SQO amendment proposal'],
      ['SEARCH_PRODUCT_OFFERING_AGREEMENT_ITEMS', 'Find the existing product offering agreement items'],
      ['REMOVE_PRODUCT_OFFERING', 'Remove the products being disconnected'],
      ['ADD_SITE', 'Add the sites to the proposal'],
      ['ASSIGN_OFFERS', 'Assign product offers to each site'],
      ['MODIFY_PRODUCT_CONFIGURATION', 'Apply product configuration and characteristics'],
      ['MODIFY_TERM', 'Apply the requested contract terms'],
      ['QUALIFY_APPLY_PROMOTION', 'Qualify and apply promotions'],
      ['ADD_TRANSACTIONAL_INFORMATION', 'Add transactional information to the proposal'],
      ['QUOTE_ALIGNMENT', 'Align the quote with the proposal'],
      ['QUOTE_AGGREGATOR', 'Aggregate the quote results'],
      ['FINALIZE', 'Finalize the proposal'],
      ['PREPARE_FOR_VALIDATION', 'Prepare the proposal for validation'],
      ['PROPOSAL_VALIDATION', 'Run proposal validation'],
      ['RETRIEVE_VALIDATION_REQUEST', 'Retrieve the validation request'],
      ['RETRIEVE_VALIDATION_RESULTS', 'Retrieve the validation results'],
      ['RETRIEVE_APPROVAL_RULES', 'Retrieve the approval rules'],
      ['INITIATE_INTERNAL_APPROVAL', 'Start the internal approval'],
      ['INTERNAL_APPROVAL', 'Wait for internal approval'],
      ['GENERATE_CONTRACT', 'Generate the SOA and MSA documents'],
      ['CONTRACT_GENERATION', 'Generate the SOA and MSA documents'],
      ['RETRIEVE_DESIGN_STATUS', 'Retrieve the design status'],
      ['RETRIEVE_SURVEY_RESULTS', 'Retrieve the site survey results']
    ];
    var INDEX = Object.create(null);
    CATALOG.forEach(function(entry, index) {
      INDEX[entry[0]] = { index: index, description: entry[1] };
    });

    var TONES = {
      SUCCESS: { tone: 'success', label: 'Completed', icon: 'bi-check-lg' },
      FAILURE: { tone: 'failure', label: 'Failed', icon: 'bi-x-lg' },
      IN_PROGRESS: { tone: 'progress', label: 'In progress', icon: 'bi-arrow-repeat' },
      PENDING: { tone: 'pending', label: 'Waiting', icon: 'bi-circle' },
      SKIPPED: { tone: 'skipped', label: 'Skipped', icon: 'bi-skip-forward' }
    };

    function normalizeStatus(value) {
      var status = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
      if (status === 'FAILED' || status === 'ERROR') return 'FAILURE';
      if (status === 'COMPLETED' || status === 'COMPLETE' || status === 'DONE') return 'SUCCESS';
      if (status === 'INPROGRESS' || status === 'RUNNING' || status === 'POLLING') return 'IN_PROGRESS';
      if (status === 'NEW' || status === 'NOT_STARTED' || status === '') return 'PENDING';
      return status;
    }

    function humanize(value) {
      var text = String(value === null || value === undefined ? '' : value).trim();
      if (!text) return 'Unnamed step';
      return text.replace(/_/g, ' ').toLowerCase().replace(/^\S/, function(c) { return c.toUpperCase(); });
    }

    // label is the step's actual name; description is a short plain-English hint (null for unknown steps).
    function stepInfo(name) {
      var raw = String(name === null || name === undefined ? '' : name).trim();
      var known = INDEX[raw.toUpperCase()];
      return {
        key: raw.toUpperCase(),
        label: raw || 'Unnamed step',
        description: known ? known.description : null,
        index: known ? known.index : Infinity
      };
    }

    function statusInfo(status) {
      var normalized = normalizeStatus(status);
      return TONES[normalized] || { tone: 'pending', label: humanize(normalized), icon: 'bi-circle' };
    }

    function time(value) {
      if (!value) return null;
      var parsed = new Date(value).getTime();
      return isNaN(parsed) ? null : parsed;
    }

    function formatDuration(ms) {
      if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return null;
      if (ms < 1000) return '<1 s';
      var seconds = Math.round(ms / 1000);
      if (seconds < 60) return seconds + ' s';
      var minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + ' min' + (seconds % 60 ? ' ' + (seconds % 60) + ' s' : '');
      var hours = Math.floor(minutes / 60);
      return hours + ' h' + (minutes % 60 ? ' ' + (minutes % 60) + ' min' : '');
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
    function build(steps) {
      var list = (angular.isArray(steps) ? steps : []).map(function(step, position) {
        var info = stepInfo(step.stepName);
        var status = statusInfo(step.stepStatus);
        var started = time(step.startedAt), completed = time(step.completedAt);
        return angular.extend({}, step, {
          info: info, label: info.label, description: info.description,
          // Name split after each underscore so long names wrap between words, never inside one.
          parts: info.label.match(/[^_]+_*|_+/g) || [info.label],
          status: normalizeStatus(step.stepStatus), tone: status.tone, statusLabel: status.label, icon: status.icon,
          duration: started !== null && completed !== null ? formatDuration(completed - started) : null,
          position: position
        });
      });
      var useOrder = list.some(function(step) { return number(step.stepOrder) !== null; });
      list.sort(compare(useOrder));
      list.forEach(function(step, index) { step.number = index + 1; });
      var count = function(tone) { return list.filter(function(step) { return step.tone === tone; }).length; };
      var done = count('success') + count('skipped');
      var current = list.filter(function(step) { return step.tone === 'failure'; })[0] ||
        list.filter(function(step) { return step.tone === 'progress'; })[0] ||
        list.filter(function(step) { return step.tone === 'pending'; })[0] || null;
      return {
        steps: list, total: list.length, done: done,
        failed: count('failure'), active: count('progress'), pending: count('pending'),
        percent: list.length ? Math.round(done * 100 / list.length) : 0,
        current: current,
        status: !list.length ? 'empty' : count('failure') ? 'failure' : done === list.length ? 'success' :
          count('progress') || done ? 'progress' : 'pending'
      };
    }

    return {
      build: build, stepInfo: stepInfo, statusInfo: statusInfo,
      normalizeStatus: normalizeStatus, formatDuration: formatDuration, humanize: humanize
    };
  }]);
