'use strict';

// "No access" screens (BXTFOMW-26559, 26563): no OMW role, a quote outside the person's scope, an expired Dynamics case,
// or the service being down. The wording is the epic's; every screen shows the tracking id when there is one.
angular.module('quoteManagement')
  .controller('AccessCtrl', ['$scope', '$location', 'AccessService', 'AccessErrors', 'AuthService',
    function($scope, $location, AccessService, AccessErrors, AuthService) {
      var VIEWS = {
        // Story 26559: what a signed-in user without a role sees.
        role: { icon: 'bi-person-lock', title: 'No OMW role', message: 'You do not have access. Request an OMW role in myComcastAccess.' },
        quote: { icon: 'bi-shield-lock', title: 'Access denied', message: AccessErrors.messages.scope },
        session: { icon: 'bi-clock-history', title: 'Session expired', message: AccessErrors.messages.caseSession },
        unavailable: { icon: 'bi-cloud-slash', title: 'Service unavailable', message: AccessErrors.messages.unavailable },
        denied: { icon: 'bi-shield-lock', title: 'Access denied', message: AccessErrors.messages.action }
      };

      function show() {
        $scope.reason = VIEWS.hasOwnProperty($location.search().reason) ? $location.search().reason : 'denied';
        $scope.view = VIEWS[$scope.reason];
        $scope.trackingId = AccessService.trackingId();
        $scope.requestRoleUrl = $scope.reason === 'role' ? AccessService.requestRoleUrl() : '';
        // A refusal that may pass (a role just approved, a service that came back) offers another check.
        $scope.canCheckAgain = AccessService.isEnabled() && ($scope.reason === 'role' || $scope.reason === 'unavailable');
        var landing = AccessService.status() === 'ready' ? AccessService.landingPath() : '';
        $scope.landing = landing && landing.indexOf('/no-access') !== 0 ? landing : '';
        $scope.canSignOut = !AccessService.isCase() && AuthService.isAuthenticated();
      }

      $scope.checking = false;
      $scope.checkAgain = function() {
        if ($scope.checking) return;
        $scope.checking = true;
        AccessService.load(true).then(function() {
          $scope.checking = false;
          if (AccessService.status() === 'ready') $location.url(AccessService.landingPath()).replace();
          else show();
        });
      };
      $scope.signOut = function() { AuthService.logout(); };
      show();
    }]);
