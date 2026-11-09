describe('Application shell', function() {
  'use strict';
  var root, location, q, timeout, auth, user;

  beforeEach(function() {
    try { localStorage.removeItem('omw-sidebar'); } catch (error) { /* storage unavailable */ }
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

  it('skip link moves focus to the main content without changing the route', function() {
    var main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.appendChild(main);
    var event = { preventDefault: jasmine.createSpy('preventDefault') };
    location.url('/quotes');
    root.$digest();
    root.skipToContent(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(main);
    expect(location.url()).toBe('/quotes');
    main.remove();
    expect(function() { root.skipToContent(event); }).not.toThrow();
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

  it('saves the chosen text size', function() {
    spyOn(window.QuoteTheme, 'setTextSize');
    root.textSizePreference = 'large';
    root.setTextSize();
    expect(window.QuoteTheme.setTextSize).toHaveBeenCalledWith('large');
  });

  it('treats a missing user as signed out', function() {
    user = null;
    location.url('/quotes');
    root.$digest();
    expect(auth.requireLogin).toHaveBeenCalled();
    expect(root.currentUser).toBeNull();
    expect(root.isLoginRoute).toBe(true);
  });

  it('collapses and expands the desktop sidebar and remembers the choice', function() {
    expect(root.sidebarCollapsed).toBe(false);
    root.toggleSidebar();
    expect(root.sidebarCollapsed).toBe(true);
    expect(localStorage.getItem('omw-sidebar')).toBe('collapsed');
    root.toggleSidebar();
    expect(root.sidebarCollapsed).toBe(false);
    expect(localStorage.getItem('omw-sidebar')).toBe('expanded');
  });

  it('still toggles when browser storage is unavailable', function() {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    root.toggleSidebar();
    expect(root.sidebarCollapsed).toBe(true);
  });
});

describe('Application shell sidebar memory', function() {
  'use strict';
  afterEach(function() { try { localStorage.removeItem('omw-sidebar'); } catch (error) { /* storage unavailable */ } });

  function boot() {
    angular.mock.module('quoteManagement', function($provide) {
      $provide.value('AuthService', {
        getUser: function() { return null; }, isAuthenticated: function() { return false; },
        getReturnUrl: function() { return '/quotes'; }, requireLogin: angular.noop
      });
    });
    var root;
    angular.mock.inject(function($rootScope, $templateCache) {
      root = $rootScope;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
    return root;
  }

  it('starts collapsed when the saved choice was collapsed', function() {
    localStorage.setItem('omw-sidebar', 'collapsed');
    expect(boot().sidebarCollapsed).toBe(true);
  });

  it('starts expanded for an unknown saved value or when reading storage fails', function() {
    localStorage.setItem('omw-sidebar', 'sideways');
    expect(boot().sidebarCollapsed).toBe(false);
  });

  it('starts expanded when reading storage throws', function() {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    expect(boot().sidebarCollapsed).toBe(false);
  });
});
