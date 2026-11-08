'use strict';

// Sets the expression in qm-hero-watch to true while the element is scrolled out of view.
// The detail page uses it to show a compact identity chip in the sticky tab bar.
angular.module('quoteManagement')
  .directive('qmHeroWatch', ['$parse', '$window', function($parse, $window) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var assign = $parse(attrs.qmHeroWatch).assign;
        if (!assign || !$window.IntersectionObserver) return;
        var observer = new $window.IntersectionObserver(function(entries) {
          var hidden = !entries[entries.length - 1].isIntersecting;
          scope.$evalAsync(function() { assign(scope, hidden); });
        }, { rootMargin: '-72px 0px 0px 0px' });
        observer.observe(element[0]);
        scope.$on('$destroy', function() { observer.disconnect(); });
      }
    };
  }]);
