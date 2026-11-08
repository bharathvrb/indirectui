'use strict';

// Turns raw step executions into the "quote journey": steps with plain-English names,
// grouped into phases, with progress, the current step and durations.
angular.module('quoteManagement')
  .factory('QuoteJourney', [function() {
    var PHASES = [
      { id: 'setup', label: 'Customer setup', icon: 'bi-person-vcard' },
      { id: 'proposal', label: 'Proposal', icon: 'bi-file-earmark-ruled' },
      { id: 'approval', label: 'Validation & approval', icon: 'bi-patch-check' },
      { id: 'contract', label: 'Contract & design', icon: 'bi-pen' },
      { id: 'other', label: 'Other steps', icon: 'bi-three-dots' }
    ];

    // Known OMW steps in their natural order. Unknown steps still show, under "Other steps".
    var CATALOG = [
      ['ADDRESS_VALIDATION', 'setup', 'Address validation', 'Validate the customer and service addresses'],
      ['DYNAMICS_ACCOUNT_OPPORTUNITY', 'setup', 'Account & opportunity', 'Create the Dynamics account and opportunity'],
      ['CREATE_CONTACT', 'setup', 'Create contacts', 'Create the customer contacts in Dynamics'],
      ['CREATE_CUSTOMER', 'setup', 'Create customer', 'Create the customer in Amdocs'],
      ['CREATE_SITE', 'setup', 'Create sites', 'Create the service sites and addresses'],
      ['CREATE_PROPOSAL', 'proposal', 'Create proposal', 'Create the SQO proposal'],
      ['CREATE_AMENDMENT_PROPOSAL', 'proposal', 'Create amendment proposal', 'Create the SQO amendment proposal'],
      ['SEARCH_PRODUCT_OFFERING_AGREEMENT_ITEMS', 'proposal', 'Find agreement items', 'Find the existing product offering agreement items'],
      ['REMOVE_PRODUCT_OFFERING', 'proposal', 'Remove product offerings', 'Remove the products being disconnected'],
      ['ADD_SITE', 'proposal', 'Add sites', 'Add the sites to the proposal'],
      ['ASSIGN_OFFERS', 'proposal', 'Assign offers', 'Assign product offers to each site'],
      ['MODIFY_PRODUCT_CONFIGURATION', 'proposal', 'Configure products', 'Apply product configuration and characteristics'],
      ['MODIFY_TERM', 'proposal', 'Set terms', 'Apply the requested contract terms'],
      ['QUALIFY_APPLY_PROMOTION', 'proposal', 'Apply promotions', 'Qualify and apply promotions'],
      ['ADD_TRANSACTIONAL_INFORMATION', 'proposal', 'Add transaction details', 'Add transactional information to the proposal'],
      ['QUOTE_ALIGNMENT', 'proposal', 'Align quote', 'Align the quote with the proposal'],
      ['QUOTE_AGGREGATOR', 'proposal', 'Aggregate quote', 'Aggregate the quote results'],
      ['FINALIZE', 'proposal', 'Finalize proposal', 'Finalize the proposal'],
      ['PREPARE_FOR_VALIDATION', 'approval', 'Prepare validation', 'Prepare the proposal for validation'],
      ['PROPOSAL_VALIDATION', 'approval', 'Validate proposal', 'Run proposal validation'],
      ['RETRIEVE_VALIDATION_REQUEST', 'approval', 'Validation request', 'Retrieve the validation request'],
      ['RETRIEVE_VALIDATION_RESULTS', 'approval', 'Validation results', 'Retrieve the validation results'],
      ['RETRIEVE_APPROVAL_RULES', 'approval', 'Approval rules', 'Retrieve the approval rules'],
      ['INITIATE_INTERNAL_APPROVAL', 'approval', 'Request approval', 'Start the internal approval'],
      ['INTERNAL_APPROVAL', 'approval', 'Internal approval', 'Wait for internal approval'],
      ['CONTRACT_GENERATION', 'contract', 'Generate contract', 'Generate the SOA and MSA documents'],
      ['RETRIEVE_DESIGN_STATUS', 'contract', 'Design status', 'Retrieve the design status'],
      ['RETRIEVE_SURVEY_RESULTS', 'contract', 'Site survey results', 'Retrieve the site survey results']
    ];
    var INDEX = Object.create(null);
    CATALOG.forEach(function(entry, index) {
      INDEX[entry[0]] = { index: index, phase: entry[1], label: entry[2], description: entry[3] };
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

    function stepInfo(name) {
      var key = String(name || '').trim().toUpperCase();
      var known = INDEX[key];
      return known
        ? { key: key, label: known.label, description: known.description, phase: known.phase, index: known.index }
        : { key: key, label: humanize(name), description: null, phase: 'other', index: Infinity };
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

    function phaseStatus(steps) {
      if (steps.some(function(step) { return step.tone === 'failure'; })) return 'failure';
      if (steps.every(function(step) { return step.tone === 'success' || step.tone === 'skipped'; })) return 'success';
      if (steps.some(function(step) { return step.tone !== 'pending'; })) return 'progress';
      return 'pending';
    }

    // steps: normalized processing steps ({ id, stepName, stepStatus, stepOrder, attemptCount, maxRetries, startedAt, completedAt, scope, ... }).
    function build(steps) {
      var list = (angular.isArray(steps) ? steps : []).map(function(step, position) {
        var info = stepInfo(step.stepName);
        var status = statusInfo(step.stepStatus);
        var started = time(step.startedAt), completed = time(step.completedAt);
        return angular.extend({}, step, {
          info: info, label: info.label, description: info.description, phase: info.phase,
          status: normalizeStatus(step.stepStatus), tone: status.tone, statusLabel: status.label, icon: status.icon,
          duration: started !== null && completed !== null ? formatDuration(completed - started) : null,
          position: position
        });
      });
      var useOrder = list.some(function(step) { return number(step.stepOrder) !== null; });
      list.sort(compare(useOrder));
      var phases = PHASES.map(function(phase) {
        var phaseSteps = list.filter(function(step) { return step.phase === phase.id; });
        return {
          id: phase.id, label: phase.label, icon: phase.icon, steps: phaseSteps,
          done: phaseSteps.filter(function(step) { return step.tone === 'success' || step.tone === 'skipped'; }).length,
          total: phaseSteps.length, status: phaseStatus(phaseSteps)
        };
      }).filter(function(phase) { return phase.total > 0; });
      var count = function(tone) { return list.filter(function(step) { return step.tone === tone; }).length; };
      var done = count('success') + count('skipped');
      var current = list.filter(function(step) { return step.tone === 'failure'; })[0] ||
        list.filter(function(step) { return step.tone === 'progress'; })[0] ||
        list.filter(function(step) { return step.tone === 'pending'; })[0] || null;
      return {
        steps: list, phases: phases, total: list.length, done: done,
        failed: count('failure'), active: count('progress'), pending: count('pending'),
        percent: list.length ? Math.round(done * 100 / list.length) : 0,
        current: current,
        status: !list.length ? 'empty' : count('failure') ? 'failure' : done === list.length ? 'success' :
          count('progress') || done ? 'progress' : 'pending'
      };
    }

    return {
      PHASES: PHASES, build: build, stepInfo: stepInfo, statusInfo: statusInfo,
      normalizeStatus: normalizeStatus, formatDuration: formatDuration, humanize: humanize
    };
  }]);
