describe('qmContactCard', function() {
  'use strict';
  var root, compile, scope, host;

  beforeEach(function() {
    angular.mock.module('quoteManagement');
    angular.mock.inject(function($rootScope, $compile, $templateCache) {
      root = $rootScope; compile = $compile;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
    scope = root.$new();
    scope.fields = [['givenName', 'Given Name'], ['isSigner', 'Is Signer'], ['createdAt', 'Created At']];
    scope.lookup = function(contact, key) { return key === 'isSigner' ? (contact.isSigner ? 'Yes' : 'No') : String(contact[key] === undefined ? '—' : contact[key]); };
  });
  afterEach(function() { if (host && host.parentNode) host.parentNode.removeChild(host); });

  function mount(contact) {
    scope.contact = contact;
    host = compile('<qm-contact-card contact="contact" fields="fields" read="lookup(contact, key)"></qm-contact-card>')(scope)[0];
    document.body.appendChild(host);
    root.$digest();
    return host;
  }

  it('shows name, initials, role line, badges and ways to reach the person', function() {
    var card = mount({ _key: 'c-1', givenName: 'Jordan', familyName: 'Lee', title: 'IT Director', roleName: 'Decision maker', role: 'Customer',
      isSigner: true, status: 'ACTIVE', emailAddress: 'jordan.lee@example.com', phoneNumber: '215-555-0100', phoneExtension: '12', mobileNumber: '215-555-0199' });
    expect(card.querySelector('.qm-contact-name').textContent).toBe('Jordan Lee');
    expect(card.querySelector('.qm-contact-avatar').textContent).toBe('JL');
    expect(card.querySelector('.qm-contact-role').textContent).toBe('IT Director · Decision maker');
    expect(card.querySelector('.qm-contact').id).toBe('c-1');
    expect(card.querySelector('.qm-contact').classList.contains('is-signer')).toBe(true);
    var badges = Array.prototype.map.call(card.querySelectorAll('.badge'), function(badge) { return badge.textContent.trim(); });
    expect(badges).toEqual(['Customer', 'Signer', 'ACTIVE']);
    expect(card.querySelector('a[href="mailto:jordan.lee@example.com"]')).not.toBeNull();
    expect(card.querySelector('a[href="tel:215-555-0100"]').textContent).toBe('215-555-0100 ext 12');
    expect(card.querySelector('a[href="tel:215-555-0199"]')).not.toBeNull();
  });

  it('falls back sensibly when a contact has no name, no way to reach them, or a repeated role', function() {
    var card = mount({ _key: 'c-2', role: 'SalesChannel', title: 'Same', roleName: 'Same', status: 'INACTIVE' });
    expect(card.querySelector('.qm-contact-name').textContent).toBe('Same');
    expect(card.querySelector('.qm-contact-avatar').textContent).toBe('S');
    expect(card.querySelector('.qm-contact-role').textContent).toBe('Same');
    expect(card.querySelector('.qm-contact-lines')).toBeNull();
    expect(card.querySelector('.badge.bg-secondary').textContent.trim()).toBe('INACTIVE');
    expect(card.querySelector('.qm-contact').classList.contains('is-signer')).toBe(false);
    card = mount({ _key: 'c-3' });
    expect(card.querySelector('.qm-contact-name').textContent).toBe('Unnamed contact');
    expect(card.querySelector('.qm-contact-role')).toBeNull();
  });

  it('lists every field in the details drawer only when it is opened', function() {
    var card = mount({ _key: 'c-4', givenName: 'Ann', familyName: 'Bee', isSigner: false, createdAt: '2026-10-30' });
    var more = card.querySelector('.qm-more');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(card.querySelector('.qm-contact-all')).toBeNull();
    angular.element(more).triggerHandler('click');
    root.$digest();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    var rows = Array.prototype.map.call(card.querySelectorAll('.qm-contact-all > div'), function(row) {
      return [row.querySelector('dt').textContent, row.querySelector('dd').textContent];
    });
    expect(rows).toEqual([['Given Name', 'Ann'], ['Is Signer', 'No'], ['Created At', '2026-10-30']]);
    angular.element(more).triggerHandler('click');
    root.$digest();
    expect(card.querySelector('.qm-contact-all')).toBeNull();
  });
});
