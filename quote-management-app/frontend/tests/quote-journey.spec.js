describe('Quote journey model', function() {
  'use strict';
  var journey;

  beforeEach(function() {
    angular.mock.module('quoteManagement');
    angular.mock.inject(function(QuoteJourney) { journey = QuoteJourney; });
  });

  function step(name, status, extra) {
    return angular.extend({ id: name, stepName: name, stepStatus: status }, extra || {});
  }

  it('keeps the actual step name, trimmed and unchanged, with no description added', function() {
    expect(journey.stepInfo('ADDRESS_VALIDATION')).toEqual({ key: 'ADDRESS_VALIDATION', label: 'ADDRESS_VALIDATION', index: 0 });
    expect(journey.stepInfo(' create_contact ').label).toBe('create_contact');
    expect(journey.stepInfo(' create_contact ').index).toBe(2);
    expect(journey.stepInfo('GENERATE_CONTRACT').index).toBeLessThan(journey.stepInfo('RETRIEVE_DESIGN_STATUS').index);
    expect(journey.stepInfo('CONTRACT_GENERATION').index).not.toBe(Infinity);
    expect(journey.stepInfo('FINALIZE').description).toBeUndefined();
  });

  it('knows every step of the standard quote flow', function() {
    ['ADDRESS_VALIDATION', 'DYNAMICS_ACCOUNT_OPPORTUNITY', 'CREATE_CONTACT', 'CREATE_CUSTOMER', 'CREATE_SITE', 'CREATE_PROPOSAL', 'ADD_SITE',
      'ASSIGN_OFFERS', 'MODIFY_PRODUCT_CONFIGURATION', 'MODIFY_TERM', 'QUALIFY_APPLY_PROMOTION', 'FINALIZE', 'PROPOSAL_VALIDATION',
      'RETRIEVE_APPROVAL_RULES', 'INTERNAL_APPROVAL', 'GENERATE_CONTRACT'].forEach(function(name) {
      expect(journey.stepInfo(name).index).not.toBe(Infinity);
    });
  });

  it('keeps unknown steps visible under their own name', function() {
    var info = journey.stepInfo('SYNC_BILLING_ACCOUNT');
    expect(info.label).toBe('SYNC_BILLING_ACCOUNT');
    expect(info.index).toBe(Infinity);
    expect(journey.stepInfo(null).label).toBe('Unnamed step');
    expect(journey.stepInfo('  ').label).toBe('Unnamed step');
    expect(journey.humanize('')).toBe('Unnamed step');
    expect(journey.humanize('QUOTE_ITEM')).toBe('Quote item');
  });

  it('normalizes step status spellings', function() {
    expect(['FAILED', 'failure', 'Error'].map(journey.normalizeStatus)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    expect(['COMPLETED', 'success', 'done', 'Complete'].map(journey.normalizeStatus)).toEqual(['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS']);
    expect(['INPROGRESS', 'in progress', 'in-progress', 'RUNNING', 'polling'].map(journey.normalizeStatus))
      .toEqual(['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS']);
    expect(['', null, undefined, 'NEW', 'not started'].map(journey.normalizeStatus)).toEqual(['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']);
    expect(journey.normalizeStatus('ON_HOLD')).toBe('ON_HOLD');
  });

  it('maps statuses to tone, label and icon, with a safe default for unknown statuses', function() {
    expect(journey.statusInfo('SUCCESS')).toEqual({ tone: 'success', label: 'Completed', icon: 'bi-check-lg' });
    expect(journey.statusInfo('FAILED').tone).toBe('failure');
    expect(journey.statusInfo('IN_PROGRESS').tone).toBe('progress');
    expect(journey.statusInfo('SKIPPED').tone).toBe('skipped');
    expect(journey.statusInfo('ON_HOLD')).toEqual({ tone: 'pending', label: 'On hold', icon: 'bi-circle' });
  });

  it('formats durations for seconds, minutes and hours and rejects invalid values', function() {
    expect(journey.formatDuration(250)).toBe('<1 s');
    expect(journey.formatDuration(45000)).toBe('45 s');
    expect(journey.formatDuration(60000)).toBe('1 min');
    expect(journey.formatDuration(65000)).toBe('1 min 5 s');
    expect(journey.formatDuration(7200000)).toBe('2 h');
    expect(journey.formatDuration(7380000)).toBe('2 h 3 min');
    [-1, NaN, Infinity, '5', null, undefined].forEach(function(value) { expect(journey.formatDuration(value)).toBeNull(); });
  });

  it('returns an empty journey for missing or empty input', function() {
    [undefined, null, [], 'steps'].forEach(function(input) {
      var result = journey.build(input);
      expect(result.status).toBe('empty');
      expect(result.total).toBe(0);
      expect(result.steps).toEqual([]);
      expect(result.percent).toBe(0);
      expect(result.current).toBeNull();
    });
  });

  it('orders steps by the OMW flow when no step order is given, and by step order when it is', function() {
    var unordered = journey.build([step('FINALIZE', 'PENDING'), step('ADDRESS_VALIDATION', 'SUCCESS'),
      step('CUSTOM_B', 'PENDING', { stepDefinitionId: 9 }), step('CUSTOM_A', 'PENDING', { stepDefinitionId: 3 }), step('CREATE_CONTACT', 'SUCCESS')]);
    expect(unordered.steps.map(function(s) { return s.stepName; }))
      .toEqual(['ADDRESS_VALIDATION', 'CREATE_CONTACT', 'FINALIZE', 'CUSTOM_A', 'CUSTOM_B']);
    var ordered = journey.build([step('CREATE_CONTACT', 'SUCCESS', { stepOrder: 2 }), step('ADDRESS_VALIDATION', 'SUCCESS', { stepOrder: 3 }),
      step('FINALIZE', 'PENDING'), step('CREATE_CUSTOMER', 'SUCCESS', { stepOrder: '1' })]);
    expect(ordered.steps.map(function(s) { return s.stepName; }))
      .toEqual(['CREATE_CUSTOMER', 'CREATE_CONTACT', 'ADDRESS_VALIDATION', 'FINALIZE']);
  });

  it('lists the standard flow in order as one numbered sequence, with unknown steps last', function() {
    var names = ['GENERATE_CONTRACT', 'INTERNAL_APPROVAL', 'RETRIEVE_APPROVAL_RULES', 'PROPOSAL_VALIDATION', 'FINALIZE', 'QUALIFY_APPLY_PROMOTION',
      'MODIFY_TERM', 'MODIFY_PRODUCT_CONFIGURATION', 'ASSIGN_OFFERS', 'ADD_SITE', 'CREATE_PROPOSAL', 'CREATE_SITE', 'CREATE_CUSTOMER',
      'CREATE_CONTACT', 'DYNAMICS_ACCOUNT_OPPORTUNITY', 'ADDRESS_VALIDATION'];
    var result = journey.build(names.concat(['SYNC_BILLING']).map(function(name) { return step(name, 'PENDING'); }));
    expect(result.steps.map(function(s) { return s.stepName; })).toEqual(names.slice().reverse().concat(['SYNC_BILLING']));
    expect(result.steps.map(function(s) { return s.number; })).toEqual(Array.apply(null, Array(17)).map(function(_, i) { return i + 1; }));
    expect(result.total).toBe(17);
    expect(result.phases).toBeUndefined();
  });

  it('summarizes counts, percent, overall status and the current step', function() {
    var failed = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'IN_PROGRESS'),
      step('CREATE_CUSTOMER', 'FAILURE'), step('CREATE_SITE', 'PENDING')]);
    expect([failed.done, failed.failed, failed.active, failed.pending, failed.total]).toEqual([1, 1, 1, 1, 4]);
    expect(failed.percent).toBe(25);
    expect(failed.status).toBe('failure');
    expect(failed.current.stepName).toBe('CREATE_CUSTOMER');

    var running = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'IN_PROGRESS'), step('CREATE_SITE', 'PENDING')]);
    expect(running.status).toBe('progress');
    expect(running.current.stepName).toBe('CREATE_CONTACT');
    expect(running.percent).toBe(33);

    var waiting = journey.build([step('ADDRESS_VALIDATION', 'PENDING'), step('CREATE_CONTACT', 'PENDING')]);
    expect(waiting.status).toBe('pending');
    expect(waiting.current.stepName).toBe('ADDRESS_VALIDATION');

    var partial = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'PENDING')]);
    expect(partial.status).toBe('progress');
    expect(partial.current.stepName).toBe('CREATE_CONTACT');

    var finished = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'SKIPPED')]);
    expect(finished.status).toBe('success');
    expect(finished.percent).toBe(100);
    expect(finished.current).toBeNull();
  });

  it('computes step durations only from valid start and end times and keeps the input unchanged', function() {
    var input = [
      step('ADDRESS_VALIDATION', 'SUCCESS', { startedAt: '2026-09-28T13:59:00Z', completedAt: '2026-09-28T13:59:03Z' }),
      step('CREATE_CONTACT', 'SUCCESS', { startedAt: '2026-09-28T13:59:00Z' }),
      step('CREATE_CUSTOMER', 'SUCCESS', { startedAt: 'not a date', completedAt: '2026-09-28T13:59:03Z' })
    ];
    var copy = angular.copy(input);
    var result = journey.build(input);
    expect(result.steps.map(function(s) { return s.duration; })).toEqual(['3 s', null, null]);
    expect(result.steps[0].label).toBe('ADDRESS_VALIDATION');
    expect(result.steps[0].statusLabel).toBe('Completed');
    expect(input).toEqual(copy);
  });
});
