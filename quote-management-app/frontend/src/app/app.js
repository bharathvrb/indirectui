'use strict';

angular.module('quoteManagement', ['ngRoute'])
    .constant('API_BASE_URL', (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || '')
    .config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
        $routeProvider
            .when('/login', {
                templateUrl: 'app/components/login/login.html', controller: 'LoginCtrl', title: 'Welcome'
            })
            // A page framed by Dynamics starts the handshake; every other visitor signs in.
            .when('/', {
                redirectTo: function() {
                    var embed = window.APP_CONFIG && window.APP_CONFIG.embed;
                    var framed = false;
                    try { framed = window.self !== window.top; } catch (error) { framed = true; }
                    return embed && embed.enabled === true && framed ? '/embed' : '/login';
                }
            })
            .when('/embed', {
                templateUrl: 'app/components/embed/embed.html', controller: 'EmbedCtrl', title: 'Open from Dynamics'
            })
            .when('/no-access', {
                templateUrl: 'app/components/access/access.html', controller: 'AccessCtrl', title: 'Access'
            })
            // Home: the default list of quotes. Search: the search features (smart search and the ID types).
            .when('/quotes', {
                templateUrl: 'app/components/quote-list/quote-list.html',
                controller: 'QuoteListCtrl', reloadOnSearch: false, title: 'Home', mode: 'home',
                resolve: { access: ['AccessGuard', function(guard) { return guard.check('list'); }] },
                // Old shared links such as /quotes?search=ABC now belong on the Search page.
                redirectTo: function(params, path, search) {
                    if (!search || !search.search) return undefined;
                    return '/search?' + Object.keys(search).map(function(key) {
                        return encodeURIComponent(key) + '=' + encodeURIComponent(search[key]);
                    }).join('&');
                }
            })
            .when('/search', {
                templateUrl: 'app/components/quote-list/quote-list.html',
                controller: 'QuoteListCtrl', reloadOnSearch: false, title: 'Search', mode: 'search',
                resolve: { access: ['AccessGuard', function(guard) { return guard.check('search'); }] }
            })
            .when('/quotes/:id', {
                templateUrl: 'app/components/quote-detail/quote-detail.html',
                controller: 'QuoteDetailCtrl', reloadOnSearch: false, title: 'Quote details',
                resolve: { access: ['AccessGuard', function(guard) { return guard.check('quote'); }] }
            })
            .when('/support-tickets', {
                templateUrl: 'app/components/support-tickets/support-tickets.html',
                controller: 'SupportTicketsCtrl', reloadOnSearch: false, title: 'Sales Support Tickets',
                resolve: { access: ['AccessGuard', function(guard) { return guard.check('list'); }] }
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
    .run(['$rootScope', '$location', '$timeout', 'AuthService', 'AccessService', function($rootScope, $location, $timeout, AuthService, AccessService) {
        // Pages that work without a sign-in of their own. Everything else asks the person to sign in first.
        var PUBLIC_ROUTES = ['/login', '/embed', '/no-access'];
        $rootScope.appReady = true;
        // Templates ask $root.access.allows('complete') and the like; true for everything while access.enabled is off.
        $rootScope.access = AccessService;
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
            $rootScope.isLoginRoute = !user || PUBLIC_ROUTES.indexOf($location.path()) !== -1 || $location.path() === '/';
        }

        $rootScope.isActive = function(path) {
            return $location.path() === path || (path === '/quotes' && $location.path().indexOf('/quotes/') === 0);
        };
        $rootScope.$on('$routeChangeStart', function(event, next) {
            var route = next && next.$$route;
            // Plain redirects (like / to /login) are followed as they are; a redirect function still needs the sign-in check.
            if (!route || typeof route.redirectTo === 'string' || route.originalPath === '/') return;
            if (PUBLIC_ROUTES.indexOf(route.originalPath) === -1 && !AuthService.isAuthenticated()) {
                event.preventDefault();
                AuthService.requireLogin();
                updateSession();
            } else if (route.originalPath === '/login' && AuthService.isAuthenticated()) {
                event.preventDefault();
                $location.url(AuthService.getReturnUrl()).replace();
            }
        });
        $rootScope.$on('$routeChangeSuccess', function(event, current) {
            // A new sign-in starts from a clean slate: permissions belong to the person who signed in.
            if (current && current.originalPath === '/login') AccessService.reset();
            updateSession();
            $rootScope.mobileMenuOpen = false;
            $rootScope.pageTitle = current && current.title || 'Workspace';
            document.title = $rootScope.pageTitle + ' | Quote Management';
            $timeout(function() {
                var main = document.getElementById('main-content');
                if (main) main.focus({ preventScroll: true });
            }, 0, false);
        });
        $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
            // The access guard refuses a page by rejecting with where to go instead.
            if (rejection && rejection.redirectTo) {
                $location.url(rejection.redirectTo).replace();
                return;
            }
            if (rejection && rejection.expired) {
                if (rejection.caseSession) $location.url('/no-access?reason=session').replace();
                else AuthService.requireLogin('session-expired');
                return;
            }
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
