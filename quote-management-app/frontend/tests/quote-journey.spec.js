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

  it('gives known steps plain-English names, descriptions and phases', function() {
    expect(journey.stepInfo('ADDRESS_VALIDATION')).toEqual(jasmine.objectContaining({
      label: 'Address validation', description: 'Validate the customer and service addresses', phase: 'setup'
    }));
    expect(journey.stepInfo(' create_contact ').label).toBe('Create contacts');
    expect(journey.stepInfo('CREATE_PROPOSAL').phase).toBe('proposal');
    expect(journey.stepInfo('INTERNAL_APPROVAL').phase).toBe('approval');
    expect(journey.stepInfo('CONTRACT_GENERATION').phase).toBe('contract');
  });

  it('keeps unknown steps visible under Other steps with a readable name', function() {
    var info = journey.stepInfo('SYNC_BILLING_ACCOUNT');
    expect(info.label).toBe('Sync billing account');
    expect(info.description).toBeNull();
    expect(info.phase).toBe('other');
    expect(journey.stepInfo(null).label).toBe('Unnamed step');
    expect(journey.humanize('')).toBe('Unnamed step');
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
      expect(result.phases).toEqual([]);
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

  it('groups steps into phases in flow order, omitting empty phases, with per-phase progress and status', function() {
    var result = journey.build([
      step('ADDRESS_VALIDATION', 'SUCCESS'), step('CREATE_CONTACT', 'SUCCESS'),
      step('CREATE_PROPOSAL', 'FAILED'), step('ADD_SITE', 'PENDING'),
      step('CONTRACT_GENERATION', 'PENDING'), step('SYNC_BILLING', 'IN_PROGRESS')
    ]);
    expect(result.phases.map(function(p) { return p.id; })).toEqual(['setup', 'proposal', 'contract', 'other']);
    expect(result.phases.map(function(p) { return p.status; })).toEqual(['success', 'failure', 'pending', 'progress']);
    expect(result.phases[0].done).toBe(2);
    expect(result.phases[0].total).toBe(2);
    expect(result.phases[1].done).toBe(0);
    expect(result.phases[1].label).toBe('Proposal');
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
    expect(finished.phases[0].status).toBe('success');
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
    expect(result.steps[0].label).toBe('Address validation');
    expect(result.steps[0].statusLabel).toBe('Completed');
    expect(input).toEqual(copy);
  });
});
