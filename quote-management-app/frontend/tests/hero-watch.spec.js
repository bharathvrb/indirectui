describe('qmHeroWatch directive', function() {
  'use strict';
  var original, observers, scope, compile, root;

  beforeEach(function() {
    original = window.IntersectionObserver;
    observers = [];
    window.IntersectionObserver = function(callback, options) {
      this.callback = callback; this.options = options; this.observed = []; this.disconnected = false;
      observers.push(this);
    };
    window.IntersectionObserver.prototype.observe = function(node) { this.observed.push(node); };
    window.IntersectionObserver.prototype.disconnect = function() { this.disconnected = true; };
    angular.mock.module('quoteManagement');
    angular.mock.inject(function($rootScope, $compile, $templateCache) {
      root = $rootScope; compile = $compile;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
    scope = root.$new();
    scope.ui = { compact: false };
  });
  afterEach(function() { window.IntersectionObserver = original; });

  it('sets the flag while the element is out of view and clears it when it returns', function() {
    var element = compile('<div qm-hero-watch="ui.compact"></div>')(scope);
    root.$digest();
    expect(observers.length).toBe(1);
    expect(observers[0].observed[0]).toBe(element[0]);
    expect(observers[0].options.rootMargin).toBe('-72px 0px 0px 0px');
    observers[0].callback([{ isIntersecting: false }]);
    root.$digest();
    expect(scope.ui.compact).toBe(true);
    observers[0].callback([{ isIntersecting: false }, { isIntersecting: true }]);
    root.$digest();
    expect(scope.ui.compact).toBe(false);
  });

  it('stops observing when its scope is destroyed', function() {
    compile('<div qm-hero-watch="ui.compact"></div>')(scope);
    scope.$destroy();
    expect(observers[0].disconnected).toBe(true);
  });

  it('does nothing without IntersectionObserver or with a non-assignable expression', function() {
    window.IntersectionObserver = undefined;
    expect(function() { compile('<div qm-hero-watch="ui.compact"></div>')(scope); }).not.toThrow();
    window.IntersectionObserver = original;
    var before = observers.length;
    compile('<div qm-hero-watch="1 + 1"></div>')(scope);
    expect(observers.length).toBe(before);
    expect(scope.ui.compact).toBe(false);
  });
});
