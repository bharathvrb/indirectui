describe('Application shell', function() {
  'use strict';
  var root, location, q, timeout, auth, user;

  beforeEach(function() {
    user = { name: 'Synthetic operator', username: 'synthetic', authType: 'local' };
    angular.mock.module('quoteManagement', function($provide) {
      $provide.factory('AuthService', ['$q', function($q) {
        auth = {
          getUser: function() { return user; },
          isAuthenticated: function() { return !!user; },
          getReturnUrl: function() { return '/quotes/Q-RETURN'; },
          requireLogin: jasmine.createSpy('requireLogin'),
          logout: jasmine.createSpy('logout').and.callFake(function() { return $q.when(); })
        };
        return auth;
      }]);
    });
    angular.mock.inject(function($rootScope, $location, $q, $timeout, $templateCache) {
      root = $rootScope; location = $location; q = $q; timeout = $timeout;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
  });

  it('shows the signed-in user, page title and active menu item after navigation', function() {
    location.url('/quotes/Q-1');
    root.$digest();
    expect(root.currentUser).toEqual({ name: 'Synthetic operator', email: 'synthetic', authType: 'local' });
    expect(root.pageTitle).toBe('Quote details');
    expect(document.title).toBe('Quote details | Quote Management');
    expect(root.isActive('/quotes')).toBe(true);
    expect(root.isActive('/support-tickets')).toBe(false);
    expect(root.isLoginRoute).toBe(false);
    expect(root.canUpdateQuotes).toBe(true);
    timeout.flush();
  });

  it('sends a signed-in user on /login back to their return URL', function() {
    location.url('/login');
    root.$digest();
    expect(location.url()).toBe('/quotes/Q-RETURN');
  });

  it('closes the mobile menu when the route changes', function() {
    root.toggleNavigation();
    expect(root.mobileMenuOpen).toBe(true);
    location.url('/support-tickets');
    root.$digest();
    expect(root.mobileMenuOpen).toBe(false);
    expect(root.pageTitle).toBe('Sales Support Tickets');
  });

  it('reports a page that fails to load', function() {
    root.$broadcast('$routeChangeError');
    expect(root.shellError).toContain('could not load');
  });

  it('signs out once even when clicked twice, and reports a failed sign-out', function() {
    var pending = q.defer();
    auth.logout.and.returnValue(pending.promise);
    root.logout();
    root.logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(root.signingOut).toBe(true);
    pending.reject(new Error('network'));
    root.$digest();
    expect(root.signingOut).toBe(false);
    expect(root.shellError).toContain('Sign-out could not complete');
  });

  it('saves the chosen theme', function() {
    spyOn(window.QuoteTheme, 'setPreference');
    root.themePreference = 'dark';
    root.setTheme();
    expect(window.QuoteTheme.setPreference).toHaveBeenCalledWith('dark');
  });

  it('treats a missing user as signed out', function() {
    user = null;
    location.url('/quotes');
    root.$digest();
    expect(auth.requireLogin).toHaveBeenCalled();
    expect(root.currentUser).toBeNull();
    expect(root.isLoginRoute).toBe(true);
  });
});
