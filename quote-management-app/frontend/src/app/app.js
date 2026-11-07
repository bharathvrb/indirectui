'use strict';

angular.module('quoteManagement', ['ngRoute', 'ngSanitize', 'ngAnimate'])
    .constant('API_BASE_URL', (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || '')
    .config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
        $routeProvider
            .when('/login', {
                templateUrl: 'app/components/login/login.html', controller: 'LoginCtrl', title: 'Welcome'
            })
            .when('/', { redirectTo: '/login' })
            .when('/quotes', {
                templateUrl: 'app/components/quote-list/quote-list.html',
                controller: 'QuoteListCtrl', reloadOnSearch: false, title: 'Quote requests'
            })
            .when('/quotes/:id', {
                templateUrl: 'app/components/quote-detail/quote-detail.html',
                controller: 'QuoteDetailCtrl', reloadOnSearch: false, title: 'Quote workspace'
            })
            .when('/support-tickets', {
                templateUrl: 'app/components/support-tickets/support-tickets.html',
                controller: 'SupportTicketsCtrl', reloadOnSearch: false, title: 'Ticket search'
            })
            .otherwise({ redirectTo: '/login' });
        $httpProvider.interceptors.push('AuthInterceptor');
    }])
    .factory('AuthInterceptor', ['$injector', '$q', 'API_BASE_URL', function($injector, $q, API_BASE_URL) {
        function isApi(url) {
            if (typeof url !== 'string' || !API_BASE_URL) return false;
            var base = new URL(API_BASE_URL, window.location.origin);
            var request = new URL(url, window.location.href);
            var prefix = base.pathname.replace(/\/$/, '');
            return request.origin === base.origin &&
                ['/quotedata/', '/tmf-api/', '/api/'].some(function(path) {
                    return request.pathname.indexOf(prefix + path) === 0;
                });
        }

        function isServiceProxy(url) {
            if (typeof url !== 'string' || !window.APP_CONFIG || window.APP_CONFIG.apiAuthMode !== 'service-proxy') return false;
            var request = new URL(url, window.location.href);
            return request.origin === window.location.origin && request.pathname.indexOf('/api/quotedata/v1/') === 0;
        }

        return {
            request: function(config) {
                var proxy = isServiceProxy(config.url);
                if (!isApi(config.url) && !proxy) return config;
                var auth = $injector.get('AuthService');
                if (!auth.isAuthenticated()) {
                    auth.requireLogin();
                    return $q.reject({ status: 401, authRequired: true, config: config });
                }
                var identity = proxy ? auth.acquireProxyIdentity() : auth.acquireToken();
                return identity.then(function(token) {
                    config.headers = config.headers || {};
                    if (proxy) {
                        delete config.headers.Authorization;
                        delete config.headers.authorization;
                    }
                    if (token) config.headers.Authorization = 'Bearer ' + token;
                    return config;
                });
            },
            responseError: function(error) {
                if (error.authRequired || (error.status === 401 && error.config &&
                    (isApi(error.config.url) || isServiceProxy(error.config.url)))) {
                    $injector.get('AuthService').requireLogin('session-expired');
                }
                return $q.reject(error);
            }
        };
    }])
    .run(['$rootScope', '$location', '$timeout', 'AuthService', function($rootScope, $location, $timeout, AuthService) {
        $rootScope.appReady = true;
        $rootScope.appName = 'Quote Management';
        $rootScope.themePreference = window.QuoteTheme ? window.QuoteTheme.getPreference() : 'light';
        $rootScope.setTheme = function() {
            window.QuoteTheme.setPreference($rootScope.themePreference);
        };
        $rootScope.toggleNavigation = function() {
            $rootScope.mobileMenuOpen = !$rootScope.mobileMenuOpen;
        };
        $rootScope.supportUrl = window.APP_CONFIG && /^https:\/\//.test(window.APP_CONFIG.supportUrl || '')
            ? window.APP_CONFIG.supportUrl : null;

        function updateSession() {
            var user = AuthService.getUser();
            $rootScope.currentUser = user ? {
                name: user.name || user.username || 'Signed-in user',
                email: user.username || '',
                authType: user.authType || 'sso'
            } : null;
            $rootScope.canUpdateQuotes = !!user;
            $rootScope.isLoginRoute = !user || $location.path() === '/login' || $location.path() === '/';
        }

        $rootScope.isActive = function(path) {
            return $location.path() === path || (path === '/quotes' && $location.path().indexOf('/quotes/') === 0);
        };
        $rootScope.$on('$routeChangeStart', function(event, next) {
            var route = next && next.$$route;
            if (!route || route.redirectTo) return;
            if (route.originalPath !== '/login' && !AuthService.isAuthenticated()) {
                event.preventDefault();
                AuthService.requireLogin();
                updateSession();
            } else if (route.originalPath === '/login' && AuthService.isAuthenticated()) {
                event.preventDefault();
                $location.url(AuthService.getReturnUrl()).replace();
            }
        });
        $rootScope.$on('$routeChangeSuccess', function(event, current) {
            updateSession();
            $rootScope.mobileMenuOpen = false;
            $rootScope.pageTitle = current && current.title || 'Workspace';
            document.title = $rootScope.pageTitle + ' | Quote Management';
            $timeout(function() {
                var main = document.getElementById('main-content');
                if (main) main.focus({ preventScroll: true });
            }, 0, false);
        });
        $rootScope.$on('$routeChangeError', function() {
            $rootScope.shellError = 'This page could not load. Reload the browser to try again.';
        });
        $rootScope.logout = function() {
            if ($rootScope.signingOut) return;
            $rootScope.signingOut = true;
            AuthService.logout().catch(function() {
                $rootScope.shellError = 'Sign-out could not complete. Please try again.';
            }).finally(function() { $rootScope.signingOut = false; });
        };
        updateSession();
    }]);
