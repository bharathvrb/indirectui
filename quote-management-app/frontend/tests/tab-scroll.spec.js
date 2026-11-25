describe('Tab bar scrolling (a bar wider than its space)', function() {
  'use strict';
  var root, compile, timeout, scope, element, host;

  beforeEach(function() {
    angular.mock.module('quoteManagement');
    angular.mock.inject(function($rootScope, $compile, $timeout, $templateCache) {
      root = $rootScope; compile = $compile; timeout = $timeout;
      ['login/login', 'quote-list/quote-list', 'quote-detail/quote-detail', 'support-tickets/support-tickets', 'access/access', 'embed/embed'].forEach(function(path) {
        $templateCache.put('app/components/' + path + '.html', '<div></div>');
      });
    });
  });
  afterEach(function() { if (scope) scope.$destroy(); if (host) host.remove(); scope = host = null; });

  // Eight 100px tabs in a 300px bar, with an arrow at each end like the quote page.
  function build(activeTab) {
    scope = root.$new();
    scope.activeTab = activeTab || 't0';
    scope.ui = { compact: false };
    host = document.createElement('div');
    host.innerHTML = '<div id="bar" qm-tab-scroll style="display:flex;flex-wrap:nowrap;overflow-x:auto;width:300px;scrollbar-width:none">' +
      '<button class="qm-tab-arrow is-left" tabindex="-1" aria-hidden="true" style="flex:none;width:28px"></button>' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function(i) {
        return '<button role="tab" id="t' + i + '" aria-selected="{{activeTab === \'t' + i + '\'}}" style="flex:none;width:100px;height:30px">Tab ' + i + '</button>';
      }).join('') +
      '<button class="qm-tab-arrow is-right" tabindex="-1" aria-hidden="true" style="flex:none;width:28px"></button></div>';
    document.body.appendChild(host);
    compile(host)(scope);
    root.$digest();
    timeout.flush(0);
    return host.querySelector('#bar');
  }

  it('shows the right arrow, and not the left one, when there is more to the right', function() {
    var bar = build();
    expect(bar.classList.contains('can-scroll-right')).toBe(true);
    expect(bar.classList.contains('can-scroll-left')).toBe(false);
  });

  it('shows the left arrow too in the middle, and only the left one at the end', function() {
    var bar = build();
    bar.scrollLeft = 150; bar.dispatchEvent(new Event('scroll'));
    expect(bar.classList.contains('can-scroll-left')).toBe(true);
    expect(bar.classList.contains('can-scroll-right')).toBe(true);
    bar.scrollLeft = bar.scrollWidth; bar.dispatchEvent(new Event('scroll'));
    expect(bar.classList.contains('can-scroll-left')).toBe(true);
    expect(bar.classList.contains('can-scroll-right')).toBe(false);
  });

  it('shows no arrows when every tab fits', function() {
    var bar = build();
    bar.style.width = '1200px';
    bar.dispatchEvent(new Event('scroll'));
    expect(bar.classList.contains('can-scroll-left')).toBe(false);
    expect(bar.classList.contains('can-scroll-right')).toBe(false);
  });

  it('scrolls toward the hidden tabs when an arrow is clicked', function() {
    var bar = build();
    var before = bar.scrollLeft;
    bar.querySelector('.is-right').click();
    // The scroll is instant under reduced motion and smooth otherwise; either way it has started or finished moving right.
    return new Promise(function(resolve) { setTimeout(resolve, 600); }).then(function() {
      expect(bar.scrollLeft).toBeGreaterThan(before);
      bar.querySelector('.is-left').click();
      return new Promise(function(resolve) { setTimeout(resolve, 600); });
    }).then(function() {
      expect(bar.scrollLeft).toBeLessThan(bar.scrollWidth - bar.clientWidth);
    });
  });

  it('brings the selected tab into view when it changes', function() {
    var bar = build('t0');
    scope.activeTab = 't7'; root.$digest(); timeout.flush(0);
    var tab = bar.querySelector('#t7');
    var right = tab.offsetLeft + tab.offsetWidth;
    expect(bar.scrollLeft + bar.clientWidth).toBeGreaterThanOrEqual(right);
    scope.activeTab = 't0'; root.$digest(); timeout.flush(0);
    expect(bar.scrollLeft).toBeLessThanOrEqual(bar.querySelector('#t0').offsetLeft);
  });

  it('stops listening when its scope is destroyed', function() {
    var bar = build();
    scope.$destroy();
    bar.scrollLeft = 150; bar.dispatchEvent(new Event('scroll'));
    expect(bar.classList.contains('can-scroll-left')).toBe(false);
    scope = null;
  });
});
