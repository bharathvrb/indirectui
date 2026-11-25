'use strict';

// A tab bar that is wider than its space scrolls sideways with no scrollbar, so the tabs past the edge cannot be seen.
// This adds two arrows (only when there is more to reach in that direction, for pointer users; keyboard users already
// move between tabs with the arrow keys) and keeps the selected tab in view.
angular.module('quoteManagement')
  .directive('qmTabScroll', ['$window', '$timeout', function($window, $timeout) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var bar = element[0];
        var reduceMotion = $window.matchMedia && $window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function update() {
          var most = bar.scrollWidth - bar.clientWidth;
          element.toggleClass('can-scroll-left', bar.scrollLeft > 2);
          element.toggleClass('can-scroll-right', bar.scrollLeft < most - 2);
        }
        function reveal() {
          var tab = bar.querySelector('[role="tab"][aria-selected="true"]');
          if (!tab) return;
          // Leave room for the arrows on either side.
          var left = tab.offsetLeft - 44, right = tab.offsetLeft + tab.offsetWidth + 44;
          if (left < bar.scrollLeft) bar.scrollLeft = Math.max(0, left);
          else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
          update();
        }
        function onClick(event) {
          var arrow = event.target.closest && event.target.closest('.qm-tab-arrow');
          if (!arrow || !bar.contains(arrow)) return;
          var step = Math.max(160, Math.round(bar.clientWidth * 0.6)) * (arrow.classList.contains('is-left') ? -1 : 1);
          if (bar.scrollBy) bar.scrollBy({ left: step, behavior: reduceMotion ? 'auto' : 'smooth' });
          else bar.scrollLeft += step;
        }

        bar.addEventListener('scroll', update, { passive: true });
        bar.addEventListener('click', onClick);
        $window.addEventListener('resize', update);
        var observer = $window.ResizeObserver ? new $window.ResizeObserver(update) : null;
        if (observer) observer.observe(bar);
        // The tabs are drawn after this link runs, and the sticky bar adds a chip when the page scrolls.
        $timeout(update, 0, false);
        scope.$watch(function() { return scope.activeTab; }, function() { $timeout(reveal, 0, false); });
        scope.$watch('ui.compact', function() { $timeout(update, 0, false); });
        scope.$on('$destroy', function() {
          bar.removeEventListener('scroll', update);
          bar.removeEventListener('click', onClick);
          $window.removeEventListener('resize', update);
          if (observer) observer.disconnect();
        });
      }
    };
  }]);
