'use strict';

angular.module('quoteManagement')
    .controller('LoginCtrl', ['$scope', '$location', '$window', 'AuthService', 'AccessService', 'EmbedService', 'FrameBridge',
        function($scope, $location, $window, AuthService, AccessService, EmbedService, FrameBridge) {
        $scope.signingIn = false;
        $scope.authError = AuthService.getInitializationError();
        $scope.ssoConfigured = AuthService.isSsoConfigured();
        $scope.localSupported = AuthService.isLocalLoginSupported();
        $scope.localEnabled = AuthService.isLocalLoginEnabled();
        $scope.localError = AuthService.getLocalInitializationError();
        $scope.credentials = { username: '', password: '' };
        $scope.localSigningIn = false;
        $scope.passwordVisible = false;
        $scope.sessionExpired = $location.search().reason === 'session-expired';
        $scope.returningToQuote = AuthService.getReturnUrl().indexOf('/quotes/') === 0;
        // Framed by Dynamics (story 26564): sign-in cannot continue in the frame, so it opens in a top-level window from a click.
        $scope.framed = EmbedService.isEnabled() && FrameBridge.isFramed();
        $scope.signInWindowOpened = false;
        $scope.popupBlocked = false;
        $scope.checkingSignIn = false;
        $scope.openSignInWindow = function() {
            $scope.popupBlocked = false;
            if (FrameBridge.open(AuthService.newWindowSignInUrl())) $scope.signInWindowOpened = true;
            else $scope.popupBlocked = true;
        };
        $scope.checkSignedIn = function() {
            if ($scope.checkingSignIn) return;
            if (!AccessService.isEnabled()) {
                $window.location.reload();
                return;
            }
            $scope.checkingSignIn = true;
            AccessService.load(true).then(function() {
                $scope.checkingSignIn = false;
                if (AccessService.status() === 'ready') $location.url(AuthService.getReturnUrl()).replace();
                else $scope.authError = 'We could not find your sign-in yet. Finish signing in in the other window, then try again.';
            });
        };
        $scope.signIn = function() {
            if ($scope.signingIn || $scope.localSigningIn) return;
            $scope.authError = null;
            $scope.signingIn = true;
            AuthService.login().catch(function() {
                $scope.signingIn = false;
                $scope.authError = 'We could not start your sign-in. Please try again or contact your administrator.';
            });
        };
        $scope.togglePassword = function() {
            $scope.passwordVisible = !$scope.passwordVisible;
        };
        $scope.signInLocal = function() {
            if ($scope.signingIn || $scope.localSigningIn) return;
            if (!$scope.localEnabled) {
                $scope.localError = 'Local sign-in is not enabled on this server.';
                return;
            }
            var username = ($scope.credentials.username || '').trim();
            if (!username || !$scope.credentials.password) {
                $scope.localError = 'Enter your username and password.';
                return;
            }
            var destination = AuthService.getReturnUrl();
            $scope.localSigningIn = true;
            $scope.localError = null;
            var request = AuthService.loginLocal(username, $scope.credentials.password);
            $scope.credentials.password = '';
            $scope.passwordVisible = false;
            request.then(function() {
                $location.url(destination).replace();
            }, function(error) {
                $scope.localError = error.status === 429
                    ? 'Too many sign-in attempts. Wait a few minutes and try again.'
                    : error.status === 401 ? 'Incorrect username or password.'
                    : error.data && error.data.message || 'Local sign-in could not complete. Please try again.';
            }).finally(function() {
                $scope.localSigningIn = false;
            });
        };
        $scope.$on('$destroy', function() { $scope.credentials.password = ''; });
    }]);
