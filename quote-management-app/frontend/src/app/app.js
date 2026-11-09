'use strict';

angular.module('quoteManagement', ['ngRoute'])
    .constant('API_BASE_URL', (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || '')
    .config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
        $routeProvider
            .when('/login', {
                templateUrl: 'app/components/login/login.html', controller: 'LoginCtrl', title: 'Welcome'
            })
            .when('/', { redirectTo: '/login' })
            .when('/quotes', {
                templateUrl: 'app/components/quote-list/quote-list.html',
                controller: 'QuoteListCtrl', reloadOnSearch: false, title: 'Quotes'
            })
            .when('/quotes/:id', {
                templateUrl: 'app/components/quote-detail/quote-detail.html',
                controller: 'QuoteDetailCtrl', reloadOnSearch: false, title: 'Quote details'
            })
            .when('/support-tickets', {
                templateUrl: 'app/components/support-tickets/support-tickets.html',
                controller: 'SupportTicketsCtrl', reloadOnSearch: false, title: 'Sales Support Tickets'
            })
            .otherwise({ redirectTo: '/login' });
        $httpProvider.interceptors.push('AuthInterceptor');
    }])
    // Adds the caller's identity to same-origin QuoteData proxy requests only. The server proxy
    // holds the QuoteData service credentials; browser tokens are never sent to QuoteData.
    .factory('AuthInterceptor', ['$injector', '$q', 'API_BASE_URL', function($injector, $q, API_BASE_URL) {
        function isProxy(url) {
            if (typeof url !== 'string' || !API_BASE_URL) return false;
            var base = new URL(API_BASE_URL, window.location.origin);
            var request = new URL(url, window.location.href);
            return base.origin === window.location.origin && request.origin === base.origin &&
                request.pathname.indexOf(base.pathname.replace(/\/$/, '') + '/quotedata/') === 0;
        }

        // Drives the thin progress bar at the top of the page: counts proxy requests that are in flight.
        function track(config, step) {
            var root = $injector.get('$rootScope');
            root.pendingRequests = Math.max(0, (root.pendingRequests || 0) + step);
            config.qmTracked = step > 0;
        }
        function release(config) {
            if (config && config.qmTracked) {
                config.qmTracked = false;
                var root = $injector.get('$rootScope');
                root.pendingRequests = Math.max(0, (root.pendingRequests || 0) - 1);
            }
        }

        return {
            request: function(config) {
                if (!isProxy(config.url)) return config;
                var auth = $injector.get('AuthService');
                if (!auth.isAuthenticated()) {
                    auth.requireLogin();
                    return $q.reject({ status: 401, authRequired: true, config: config });
                }
                return auth.acquireProxyIdentity().then(function(token) {
                    config.headers = config.headers || {};
                    delete config.headers.Authorization;
                    delete config.headers.authorization;
                    if (token) config.headers.Authorization = 'Bearer ' + token;
                    track(config, 1);
                    return config;
                });
            },
            response: function(response) {
                release(response.config);
                return response;
            },
            responseError: function(error) {
                release(error && error.config);
                if (error.authRequired || (error.status === 401 && error.config && isProxy(error.config.url))) {
                    $injector.get('AuthService').requireLogin('session-expired');
                }
                return $q.reject(error);
            }
        };
    }])
    .run(['$rootScope', '$location', '$timeout', 'AuthService', function($rootScope, $location, $timeout, AuthService) {
        $rootScope.appReady = true;
        $rootScope.pendingRequests = 0;
        $rootScope.themePreference = window.QuoteTheme ? window.QuoteTheme.getPreference() : 'light';
        $rootScope.setTheme = function() {
            window.QuoteTheme.setPreference($rootScope.themePreference);
        };
        // Skip link: hash links would change the route, so move focus directly.
        $rootScope.skipToContent = function($event) {
            $event.preventDefault();
            var main = document.getElementById('main-content');
            if (main) main.focus();
        };
        $rootScope.toggleNavigation = function() {
            $rootScope.mobileMenuOpen = !$rootScope.mobileMenuOpen;
        };
        // Desktop sidebar: expanded or icon-only. The choice is remembered per browser.
        function readSidebar() {
            try { return window.localStorage.getItem('omw-sidebar') === 'collapsed'; } catch (error) { return false; }
        }
        $rootScope.sidebarCollapsed = readSidebar();
        $rootScope.toggleSidebar = function() {
            $rootScope.sidebarCollapsed = !$rootScope.sidebarCollapsed;
            try { window.localStorage.setItem('omw-sidebar', $rootScope.sidebarCollapsed ? 'collapsed' : 'expanded'); } catch (error) { /* storage unavailable */ }
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
