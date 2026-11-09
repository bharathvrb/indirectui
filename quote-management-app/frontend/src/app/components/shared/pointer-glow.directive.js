'use strict';

// Lets cards, tiles and steps glow softly under the mouse pointer: it publishes the pointer position
// to the hovered element as --mx / --my, and the stylesheet draws the light. One listener on the
// container covers every card, including ones that appear later. Off for touch screens and for
// people who ask their system for reduced motion.
angular.module('quoteManagement')
  .directive('qmPointerGlow', ['$window', function($window) {
    var TARGETS = '.qm-start-card, .qm-kpi-card, .qm-step, .qm-id-cell, .qm-contract-card, .qm-contact, .qm-site, .qm-promo, .qm-error';
    return {
      restrict: 'A',
      link: function(scope, element) {
        var query = $window.matchMedia;
        if (!query || query('(prefers-reduced-motion: reduce)').matches || query('(hover: none)').matches) return;
        var host = element[0];
        var frame = 0;
        var pending = null;
        function paint() {
          frame = 0;
          if (!pending) return;
          var box = pending.target.getBoundingClientRect();
          pending.target.style.setProperty('--mx', (pending.x - box.left) + 'px');
          pending.target.style.setProperty('--my', (pending.y - box.top) + 'px');
          pending = null;
        }
        function onMove(event) {
          var target = event.target && event.target.closest ? event.target.closest(TARGETS) : null;
          if (!target) return;
          pending = { target: target, x: event.clientX, y: event.clientY };
          if (!frame) frame = $window.requestAnimationFrame(paint);
        }
        host.addEventListener('mousemove', onMove, { passive: true });
        scope.$on('$destroy', function() {
          host.removeEventListener('mousemove', onMove);
          if (frame) $window.cancelAnimationFrame(frame);
        });
      }
    };
  }]);
