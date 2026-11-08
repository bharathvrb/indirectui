describe('Sign-in page', function() {
  'use strict';
  var scope, auth, q, root;

  function start(options) {
    options = options || {};
    auth = {
      getInitializationError: function() { return null; },
      isSsoConfigured: function() { return true; },
      isLocalLoginSupported: function() { return true; },
      isLocalLoginEnabled: function() { return options.localEnabled !== false; },
      getLocalInitializationError: function() { return null; },
      getReturnUrl: function() { return options.returnUrl || '/quotes'; },
      getUser: function() { return null; },
      isAuthenticated: function() { return false; },
      requireLogin: angular.noop,
      login: jasmine.createSpy('login'),
      loginLocal: jasmine.createSpy('loginLocal')
    };
    angular.mock.module('quoteManagement', function($provide) { $provide.value('AuthService', auth); });
    angular.mock.inject(function($rootScope, $controller, $q, $location, $templateCache) {
      root = $rootScope; q = $q;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
      if (options.reason) $location.search('reason', options.reason);
      scope = $rootScope.$new();
      $controller('LoginCtrl', { $scope: scope });
    });
  }

  it('explains when SSO cannot start and lets the user try again', function() {
    start();
    auth.login.and.returnValue(q.reject(new Error('popup blocked')));
    scope.signIn();
    scope.signIn(); // ignored while redirecting
    expect(auth.login).toHaveBeenCalledTimes(1);
    root.$digest();
    expect(scope.signingIn).toBe(false);
    expect(scope.authError).toContain('could not start your sign-in');
  });

  it('shows and hides the password, and notes expired sessions and quote return links', function() {
    start({ reason: 'session-expired', returnUrl: '/quotes/Q-1' });
    expect(scope.sessionExpired).toBe(true);
    expect(scope.returningToQuote).toBe(true);
    scope.togglePassword();
    expect(scope.passwordVisible).toBe(true);
    scope.togglePassword();
    expect(scope.passwordVisible).toBe(false);
  });

  it('refuses local sign-in when the server has it turned off', function() {
    start({ localEnabled: false });
    scope.signInLocal();
    expect(scope.localError).toContain('not enabled');
    expect(auth.loginLocal).not.toHaveBeenCalled();
  });
});
