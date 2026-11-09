'use strict';

angular.module('quoteManagement')
  .controller('QuoteListCtrl', ['$scope', '$location', '$timeout', '$route', 'QuoteViewService',
    function($scope, $location, $timeout, $route, QuoteViewService) {
      var view = QuoteViewService;
      var searchTimer;
      var lastQuery;
      var filterChips = [];
      var filterKeys = ['state', 'designStatus', 'category', 'channelType'];
      var searchTypes = ['quoteRequestId', 'externalId', 'proposalId', 'text'];
      $scope.categoryOptions = [];
      $scope.channelTypeOptions = [];
      $scope.designStatusOptions = [];
      $scope.stateOptions = ['RECEIVED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED'];
      $scope.displayValue = view.displayValue;
      $scope.getStateLabel = view.stateLabel;
      $scope.validationError = null;
      $scope.searchError = null;
      $scope.searchBy = 'auto';
      $scope.lookupOnly = !!(window.APP_CONFIG && window.APP_CONFIG.quoteDataLookupOnly);
      // The route says which page this is: 'home' (default list and filters), 'search' (the search features),
      // or nothing, which shows both together.
      var route = $route.current && $route.current.$$route;
      $scope.pageMode = route && route.mode || null;
      // Home always lists; quoteDataLookupOnly only limits what the Search page offers.
      if ($scope.pageMode === 'home') $scope.lookupOnly = false;
      // Search never lists without something to look for. Home can be switched off with defaultListEnabled: false.
      $scope.requireTerm = $scope.pageMode === 'search';
      $scope.listEnabled = !($scope.pageMode === 'home' && window.APP_CONFIG && window.APP_CONFIG.defaultListEnabled === false);
      $scope.isExactLookup = function() { return !!view.lookupCriteria($scope.searchTerm, $scope.searchBy, $scope.lookupOnly); };
      $scope.lookupLabel = function() {
        var criteria = view.lookupCriteria($scope.searchTerm, $scope.searchBy, $scope.lookupOnly);
        if (!criteria) return '';
        return criteria.quoteRequestId ? 'quote request ID' : criteria.externalId ? 'external ID' : 'proposal ID';
      };

      function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

      function rememberOptions(rows) {
        filterKeys.forEach(function(key) {
          var options = $scope[key + 'Options'];
          var values = rows.map(function(row) { return row[key]; });
          values.push($scope.filters[key]);
          values.forEach(function(value) {
            if (value && options.indexOf(value) === -1) options.push(value);
          });
          options.sort();
        });
      }

      // Recent searches: the last few exact lookups that found a quote, kept in this browser only.
      var RECENT_KEY = 'omw-recent-searches';
      var searchLabels = ['auto', 'quoteRequestId', 'externalId', 'proposalId'];
      function readRecent() {
        try {
          var list = JSON.parse(window.localStorage.getItem(RECENT_KEY));
          return (angular.isArray(list) ? list : []).filter(function(item) {
            return item && typeof item.term === 'string' && item.term.length <= 200 && searchLabels.indexOf(item.by) !== -1;
          }).slice(0, 5);
        } catch (error) { return []; }
      }
      function rememberSearch() {
        var term = view.text($scope.searchTerm);
        if (!term || term.length > 200 || !view.lookupCriteria(term, $scope.searchBy, $scope.lookupOnly)) return;
        var list = $scope.recentSearches.filter(function(item) { return item.term !== term; });
        list.unshift({ term: term, by: searchLabels.indexOf($scope.searchBy) !== -1 ? $scope.searchBy : 'auto' });
        $scope.recentSearches = list.slice(0, 5);
        try { window.localStorage.setItem(RECENT_KEY, JSON.stringify($scope.recentSearches)); } catch (error) { /* storage unavailable */ }
      }
      $scope.recentSearches = readRecent();
      $scope.useRecent = function(item) {
        $scope.searchTerm = item.term;
        $scope.searchBy = item.by;
        $scope.applyFilters();
      };
      // Home page: greeting and the "how to look it up" cards.
      var hour = new Date().getHours();
      $scope.greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      $scope.firstName = function() {
        var user = $scope.$root && $scope.$root.currentUser;
        return view.text(user && user.name).split(/[\s@.]/)[0];
      };
      $scope.useSearchType = function(type) {
        $scope.searchBy = type;
        $scope.searchError = null;
        $timeout(function() {
          var input = document.getElementById('quote-search');
          if (input) input.focus();
        });
      };

      var loader = view.createLoader($scope, 'quotes', function(page) {
        rememberOptions(page.items);
        if (page.items.length) rememberSearch();
        // Reflect a server-corrected page without requesting the same results again.
        if (lastQuery.page !== page.currentPage || lastQuery.size !== page.pageSize) {
          lastQuery = angular.extend({}, lastQuery, { page: page.currentPage, size: page.pageSize });
          $location.search(lastQuery).replace();
        }
      });

      function cancelSearch() {
        if (searchTimer) $timeout.cancel(searchTimer);
        searchTimer = null;
      }

      function readQuery() {
        var query = $location.search();
        $scope.currentPage = view.integer(query.page, 0);
        $scope.pageSize = view.integer(query.size, 25, 1);
        $scope.searchTerm = view.text(query.search);
        $scope.searchBy = searchTypes.indexOf(query.searchBy) !== -1 ? query.searchBy : 'auto';
        $scope.filters = {
          fromDate: view.dateInput(query.fromDate),
          toDate: view.dateInput(query.toDate)
        };
        filterKeys.forEach(function(key) { $scope.filters[key] = view.text(query[key]); });
        rememberOptions([]);
      }

      function queryString() {
        var query = { page: $scope.isExactLookup() ? 0 : $scope.currentPage, size: $scope.pageSize };
        var search = view.text($scope.searchTerm);
        if (search) query.search = search;
        if ($scope.searchBy !== 'auto') query.searchBy = $scope.searchBy;
        filterKeys.forEach(function(key) { if ($scope.filters[key]) query[key] = $scope.filters[key]; });
        if ($scope.filters.fromDate) query.fromDate = view.dateOnly($scope.filters.fromDate) || 'invalid';
        if ($scope.filters.toDate) query.toDate = view.dateOnly($scope.filters.toDate) || 'invalid';
        return query;
      }

      function locationQuery() {
        var source = $location.search();
        var query = { page: view.integer(source.page, 0), size: view.integer(source.size, 25, 1) };
        if (searchTypes.indexOf(source.searchBy) !== -1) query.searchBy = source.searchBy;
        ['search'].concat(filterKeys).forEach(function(key) {
          if (view.text(source[key])) query[key] = view.text(source[key]);
        });
        ['fromDate', 'toDate'].forEach(function(key) {
          if (source[key]) query[key] = view.dateOnly(view.dateInput(source[key])) || 'invalid';
        });
        return query;
      }

      function validate() {
        $scope.searchError = ['quoteRequestId', 'externalId', 'proposalId'].indexOf($scope.searchBy) !== -1 && !view.text($scope.searchTerm)
          ? 'Enter a ' + { quoteRequestId: 'quote request ID', externalId: 'external ID', proposalId: 'proposal ID' }[$scope.searchBy] + '.' : null;
        if (!$scope.listEnabled || ($scope.requireTerm && !$scope.searchError && !view.text($scope.searchTerm))) {
          $scope.validationError = null;
          return false;
        }
        if ($scope.lookupOnly && (!view.text($scope.searchTerm) || $scope.searchBy === 'text')) {
          if ($scope.searchBy === 'text') $scope.searchError = 'This backend requires a quote request ID, external ID, or proposal ID.';
          $scope.validationError = null;
          return false;
        }
        if ($scope.searchError || $scope.isExactLookup()) {
          $scope.validationError = null;
          return !$scope.searchError;
        }
        var from = view.dateOnly($scope.filters.fromDate);
        var to = view.dateOnly($scope.filters.toDate);
        $scope.validationError =
          ($scope.filters.fromDate !== null && !from) || ($scope.filters.toDate !== null && !to)
          ? 'Enter valid created dates.'
          : from && to && from > to ? 'Created from must be on or before Created to.' : null;
        return !$scope.validationError;
      }

      function request(query) {
        var criteria = view.lookupCriteria(query.search, query.searchBy, $scope.lookupOnly);
        if (criteria) {
          loader.load(angular.extend({ page: 0, size: query.size }, criteria));
          return;
        }
        var params = angular.extend({}, query, { sort: 'createdAt,desc' });
        delete params.searchBy;
        if (query.fromDate) params.createdFrom = query.fromDate + 'T00:00:00';
        if (query.toDate) params.createdTo = query.toDate + 'T23:59:59.999';
        delete params.fromDate;
        delete params.toDate;
        loader.load(params);
      }

      function commit(force) {
        cancelSearch();
        if (!validate()) {
          loader.reset();
          lastQuery = null;
          return;
        }
        var query = queryString();
        if (!force && angular.equals(query, lastQuery)) return;
        lastQuery = angular.copy(query);
        $location.search(query);
        request(query);
      }

      $scope.applyFilters = function() {
        $scope.currentPage = 0;
        commit(false);
      };
      $scope.clearFilters = function() {
        $scope.searchTerm = '';
        $scope.searchBy = 'auto';
        $scope.filters = { state: '', designStatus: '', category: '', channelType: '', fromDate: null, toDate: null };
        $scope.currentPage = 0;
        commit(!!($scope.validationError || $scope.searchError));
      };
      $scope.onSearchChange = function() {
        cancelSearch();
        searchTimer = $timeout(function() {
          searchTimer = null;
          $scope.applyFilters();
        }, 300);
      };
      $scope.refresh = function() {
        if (searchTimer) $scope.currentPage = 0;
        commit(true);
      };
      $scope.goToPage = function(page) {
        if (view.integer(page, null) === null || page >= $scope.totalPages || page === $scope.currentPage) return;
        $scope.currentPage = page;
        commit(false);
      };
      $scope.activeFilterChips = function() {
        var chips = [];
        var labels = { state: 'State', designStatus: 'Design', category: 'Category', channelType: 'Channel' };
        if (view.text($scope.searchTerm)) chips.push({
          key: 'search', label: ($scope.isExactLookup() ? capitalize($scope.lookupLabel()) + ': ' : 'Search: ') + view.text($scope.searchTerm)
        });
        if ($scope.isExactLookup()) {
          if (!angular.equals(chips, filterChips)) filterChips = chips;
          return filterChips;
        }
        filterKeys.forEach(function(key) {
          if ($scope.filters[key]) chips.push({ key: key, label: labels[key] + ': ' +
            (key === 'state' ? view.stateLabel($scope.filters[key]) : $scope.filters[key]) });
        });
        if (view.dateOnly($scope.filters.fromDate)) chips.push({ key: 'fromDate', label: 'From: ' + view.dateOnly($scope.filters.fromDate) });
        if (view.dateOnly($scope.filters.toDate)) chips.push({ key: 'toDate', label: 'To: ' + view.dateOnly($scope.filters.toDate) });
        if (!angular.equals(chips, filterChips)) filterChips = chips;
        return filterChips;
      };
      $scope.hasActiveFilters = function() { return $scope.activeFilterChips().length > 0; };
      $scope.removeFilterChip = function(key) {
        if (key === 'search') {
          $scope.searchTerm = '';
          $scope.searchBy = 'auto';
        }
        else $scope.filters[key] = key === 'fromDate' || key === 'toDate' ? null : '';
        $scope.applyFilters();
      };
      $scope.$on('$routeUpdate', function() {
        if ($location.path() !== '/quotes' && $location.path() !== '/search') return;
        var query = locationQuery();
        if (angular.equals(query, lastQuery)) return;
        cancelSearch();
        readQuery();
        lastQuery = angular.copy(query);
        if (validate()) request(query);
        else loader.reset();
      });
      $scope.$on('$destroy', function() {
        cancelSearch();
      });
      readQuery();
      commit(true);
    }
  ]);
