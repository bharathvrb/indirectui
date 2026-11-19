'use strict';

// The page Dynamics frames (BXTFOMW-26562). Framed: run the handshake and move on to the quote. Opened on its own:
// say where to open the quote from.
angular.module('quoteManagement')
  .controller('EmbedCtrl', ['$scope', 'EmbedService', function($scope, EmbedService) {
    var run = null;
    $scope.framed = EmbedService.isFramed() && EmbedService.isEnabled();

    function apply(state) {
      $scope.phase = state.phase;
      $scope.message = state.message || '';
      $scope.trackingId = state.trackingId || null;
      $scope.title = state.phase === 'failed' ? 'This quote could not be opened'
        : state.phase === 'done' ? 'Opening your quote' : 'Opening your quote';
    }

    $scope.begin = function() {
      if (run) run.cancel();
      run = EmbedService.start(apply);
    };

    if ($scope.framed) {
      $scope.begin();
    } else {
      $scope.phase = 'open-from-dynamics';
      $scope.title = 'Open this quote from Dynamics';
      $scope.message = 'Quotes open from their case in Dynamics. Go to the case and open the quote from there.';
    }
    $scope.$on('$destroy', function() { if (run) run.cancel(); });
  }]);
