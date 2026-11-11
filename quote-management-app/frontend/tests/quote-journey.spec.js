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
    expect(journey.statusInfo('SUCCESS')).toEqual({ tone: 'success', label: 'Success', icon: 'bi-check-lg' });
    expect(journey.statusInfo('FAILED').tone).toBe('failure');
    expect(journey.statusInfo('IN_PROGRESS').tone).toBe('progress');
    expect(journey.statusInfo('SKIPPED').tone).toBe('skipped');
    expect(journey.statusInfo('ON_HOLD')).toEqual({ tone: 'pending', label: 'On hold', icon: 'bi-circle' });
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

  it('does not add durations or attempt counts to steps, and keeps the input unchanged', function() {
    var input = [step('ADDRESS_VALIDATION', 'SUCCESS', { startedAt: '2026-09-28T13:59:00Z', completedAt: '2026-09-28T13:59:03Z', attemptCount: 2 })];
    var copy = angular.copy(input);
    var result = journey.build(input);
    expect(result.steps[0].duration).toBeUndefined();
    expect(result.steps[0].label).toBe('ADDRESS_VALIDATION');
    expect(result.steps[0].statusLabel).toBe('Success');
    expect(journey.formatDuration).toBeUndefined();
    expect(input).toEqual(copy);
  });
});

describe('Quote journey model: numbers and counts come from the backend', function() {
  'use strict';
  var journey;
  function step(name, status) { return { id: name, stepName: name, stepStatus: status }; }
  beforeEach(function() {
    angular.mock.module('quoteManagement');
    angular.mock.inject(function(QuoteJourney) { journey = QuoteJourney; });
  });

  it('numbers steps by the backend stepOrder when it sent one, and by position otherwise', function() {
    var withOrder = journey.build([
      { stepName: 'A', stepStatus: 'SUCCESS', stepOrder: 2 }, { stepName: 'B', stepStatus: 'FAILURE', stepOrder: 7 }
    ]);
    expect(withOrder.steps.map(function(step) { return step.order; })).toEqual([2, 7]);
    var without = journey.build([{ stepName: 'A', stepStatus: 'SUCCESS' }, { stepName: 'B', stepStatus: 'PENDING' }]);
    expect(without.steps.map(function(step) { return step.order; })).toEqual([1, 2]);
  });

  it('keeps Not required steps in the list but ignores them for progress: Success plus Not required is completed', function() {
    var result = journey.build([
      step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'NOT_REQUIRED'), step('CREATE_CUSTOMER', 'COMPLETED'),
      step('CREATE_SITE', 'Not Required'), step('CREATE_PROPOSAL', 'NOTREQUIRED')
    ]);
    expect(result.status).toBe('success');
    expect(result.percent).toBe(100);
    expect(result.total).toBe(5);
    expect(result.applicable).toBe(2);
    expect(result.done).toBe(2);
    expect(result.notRequired).toBe(3);
    expect(result.current).toBeNull();
    expect(result.steps.map(function(s) { return s.statusLabel; })).toEqual(['Success', 'Not required', 'Success', 'Not required', 'Not required']);
  });

  it('works out the percentage from the steps that apply, and Not required steps never hide a failure, a running step or a pending step', function() {
    var half = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'NOT_REQUIRED'), step('CREATE_CUSTOMER', 'PENDING'), step('CREATE_SITE', 'NOT_REQUIRED')]);
    expect(half.percent).toBe(50);
    expect(half.status).toBe('progress');
    expect(half.current.stepName).toBe('CREATE_CUSTOMER');
    var failed = journey.build([step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'NOT_REQUIRED'), step('CREATE_CUSTOMER', 'FAILURE')]);
    expect(failed.status).toBe('failure');
    expect(failed.percent).toBe(50);
    expect(journey.build([step('A', 'NOT_REQUIRED'), step('B', 'PENDING')]).status).toBe('pending');
  });

  it('words a journey whose every step is Not required without a percentage', function() {
    var result = journey.build([step('A', 'NOT_REQUIRED'), step('B', 'NOT_REQUIRED')]);
    expect(result.total).toBe(2);
    expect(result.applicable).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.status).toBe('notrequired');
    expect(journey.statusInfo('NOT_REQUIRED').label).toBe('Not required');
    expect(journey.statusInfo('Not required').label).toBe('Not required');
  });

  it('counts success and skipped separately and uses the backend status words', function() {
    var result = journey.build([
      { stepName: 'A', stepStatus: 'SUCCESS' }, { stepName: 'B', stepStatus: 'SKIPPED' },
      { stepName: 'C', stepStatus: 'PENDING' }, { stepName: 'D', stepStatus: 'IN_PROGRESS' }
    ]);
    expect([result.succeeded, result.skipped, result.pending, result.active]).toEqual([1, 1, 1, 1]);
    var labels = result.steps.map(function(step) { return step.statusLabel; }).sort();
    expect(labels).toEqual(['In progress', 'Pending', 'Skipped', 'Success']);
  });
});
