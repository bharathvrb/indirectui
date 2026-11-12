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
      $scope.stateOptions = ['RECEIVED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED', 'FAILURE'];
      $scope.displayValue = view.displayValue;
      $scope.getStateLabel = view.stateLabel;
      $scope.validationError = null;
      $scope.searchError = null;
      // Which kind of ID the Search page looks up; empty until the person chooses one.
      $scope.searchBy = '';
      $scope.submitted = false;
      $scope.lookupOnly = !!(window.APP_CONFIG && window.APP_CONFIG.quoteDataLookupOnly);
      // The route says which page this is: 'home' (default list and filters), 'search' (the search features),
      // or nothing, which shows both together.
      var route = $route.current && $route.current.$$route;
      $scope.pageMode = route && route.mode || null;
      // Home always lists; quoteDataLookupOnly only limits what the Search page offers.
      if ($scope.pageMode === 'home') $scope.lookupOnly = false;
      // Search never lists without something to look for. Home can be switched off with defaultListEnabled: false.
      $scope.requireTerm = $scope.pageMode === 'search';
      // Home shows only the newest 25 quotes: one request, no further pages. Reloading or pressing Refresh asks the backend again.
      $scope.latestOnly = $scope.pageMode === 'home';
      var HOME_PAGE_SIZE = 25;
      $scope.listEnabled = !($scope.pageMode === 'home' && window.APP_CONFIG && window.APP_CONFIG.defaultListEnabled === false);
      // What each Search type is called, and what the field says while it is chosen.
      var typeLabels = { quoteRequestId: 'quote request ID', externalId: 'external ID', proposalId: 'proposal ID', text: 'search text' };
      $scope.typeLabel = function() { return typeLabels[$scope.searchBy] || ''; };
      $scope.isExactLookup = function() { return !!view.lookupCriteria($scope.searchTerm, $scope.searchBy); };
      $scope.lookupLabel = function() { return view.lookupCriteria($scope.searchTerm, $scope.searchBy) ? typeLabels[$scope.searchBy] : ''; };

      function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

      // The filter boxes suggest the values QuoteData has sent, and accept any value typed in full. The lists are learned
      // from the quotes loaded so far and kept in this browser (they only ever hold values QuoteData itself returned),
      // so they do not shrink to what happens to be among the 25 on screen.
      var FILTER_VALUES_KEY = 'omw-filter-values';
      function readStoredValues() {
        try {
          var saved = JSON.parse(window.localStorage.getItem(FILTER_VALUES_KEY));
          return saved && typeof saved === 'object' ? saved : {};
        } catch (error) { return {}; }
      }
      function storeValues() {
        var saved = {};
        filterKeys.forEach(function(key) { saved[key] = $scope[key + 'Options'].slice(0, 100); });
        try { window.localStorage.setItem(FILTER_VALUES_KEY, JSON.stringify(saved)); } catch (error) { /* storage unavailable */ }
      }
      function addOption(options, value) {
        if (typeof value === 'string' && value.length <= 120 && value.trim() && options.indexOf(value) === -1) {
          options.push(value);
          return true;
        }
        return false;
      }
      (function loadStoredOptions() {
        var saved = readStoredValues();
        filterKeys.forEach(function(key) {
          (angular.isArray(saved[key]) ? saved[key] : []).forEach(function(value) { addOption($scope[key + 'Options'], value); });
          $scope[key + 'Options'].sort();
        });
      }());

      function rememberOptions(rows) {
        var learned = false;
        filterKeys.forEach(function(key) {
          var options = $scope[key + 'Options'];
          var values = rows.map(function(row) { return row[key]; });
          values.push($scope.filters[key]);
          values.forEach(function(value) { if (addOption(options, value)) learned = true; });
          options.sort();
        });
        if (learned) storeValues();
      }

      // A value typed into a filter box is matched to the spelling QuoteData uses (letter case, and the friendly name for a
      // state such as "Failed"); anything else is sent as typed, because the backend may know values this browser has not seen.
      function canonicalFilters() {
        filterKeys.forEach(function(key) {
          var typed = view.text($scope.filters[key]);
          var lower = typed.toLowerCase();
          var match = typed && $scope[key + 'Options'].filter(function(option) {
            return option.toLowerCase() === lower || (key === 'state' && view.stateLabel(option).toLowerCase() === lower);
          })[0];
          $scope.filters[key] = match || typed;
        });
      }

      // Recent searches: the last few exact lookups that found a quote, kept in this browser only.
      var RECENT_KEY = 'omw-recent-searches';
      var searchLabels = ['quoteRequestId', 'externalId', 'proposalId'];
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
        if (!term || term.length > 200 || !view.lookupCriteria(term, $scope.searchBy)) return;
        var list = $scope.recentSearches.filter(function(item) { return item.term !== term; });
        list.unshift({ term: term, by: $scope.searchBy });
        $scope.recentSearches = list.slice(0, 5);
        try { window.localStorage.setItem(RECENT_KEY, JSON.stringify($scope.recentSearches)); } catch (error) { /* storage unavailable */ }
      }
      $scope.recentSearches = readRecent();
      $scope.useRecent = function(item) {
        $scope.searchTerm = item.term;
        $scope.searchBy = item.by;
        $scope.applyFilters();
      };
      // Home: "Watch tour" opens the product tour video. The video element only exists while the pop-up is open,
      // so nothing is downloaded until someone asks for it.
      $scope.tour = { open: false };
      $scope.tourFiles = { poster: 'assets/media/quote-management-tour.jpg', mp4: 'assets/media/quote-management-tour.mp4', webm: 'assets/media/quote-management-tour.webm' };
      // Chapter start times in seconds, matching the recorded tour (src/assets/media/quote-management-tour.mp4 and .webm).
      $scope.tourChapters = [
        { label: 'Sign in', time: 0 }, { label: 'Home', time: 9.5 }, { label: 'Filters', time: 19 }, { label: 'Open a quote', time: 26 },
        { label: 'Journey and errors', time: 34 }, { label: 'Tabs', time: 50.5 }, { label: 'Search', time: 68.5 }
      ];
      var tourReturnFocus = null;
      $scope.openTour = function() {
        tourReturnFocus = document.activeElement;
        $scope.tour.open = true;
        $timeout(function() {
          var close = document.getElementById('tour-close');
          if (close) close.focus();
        });
      };
      $scope.closeTour = function() {
        var video = document.getElementById('tour-video');
        if (video && video.pause) video.pause();
        $scope.tour.open = false;
        $timeout(function() {
          if (tourReturnFocus && document.documentElement.contains(tourReturnFocus)) tourReturnFocus.focus();
        });
      };
      $scope.seekTour = function(time) {
        var video = document.getElementById('tour-video');
        if (!video) return;
        video.currentTime = time;
        var started = video.play && video.play();
        if (started && started.catch) started.catch(function() { /* the viewer can press play */ });
      };
      $scope.tourKeydown = function(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          $scope.closeTour();
        } else if (event.key === 'Tab') {
          var dialog = document.getElementById('tour-dialog');
          var elements = dialog && dialog.querySelectorAll('button:not([disabled]), video[controls]');
          if (!elements || !elements.length) return;
          var first = elements[0], last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };
      // Choosing what to look up by starts a fresh lookup: the old value and results belong to the old type.
      $scope.useSearchType = function(type) {
        if (type === $scope.searchBy) return;
        cancelSearch();
        $scope.searchBy = type;
        $scope.searchTerm = '';
        $scope.searchError = null;
        $scope.submitted = false;
        $scope.currentPage = 0;
        loader.reset();
        lastQuery = null;
        $location.search({ page: 0, size: $scope.pageSize, searchBy: type });
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
        $scope.currentPage = $scope.latestOnly ? 0 : view.integer(query.page, 0);
        $scope.pageSize = $scope.latestOnly ? HOME_PAGE_SIZE : view.integer(query.size, 25, 1);
        $scope.searchTerm = view.text(query.search);
        $scope.searchBy = searchTypes.indexOf(query.searchBy) !== -1 ? query.searchBy : '';
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
        if ($scope.searchBy) query.searchBy = $scope.searchBy;
        filterKeys.forEach(function(key) { if ($scope.filters[key]) query[key] = $scope.filters[key]; });
        if ($scope.filters.fromDate) query.fromDate = view.dateOnly($scope.filters.fromDate) || 'invalid';
        if ($scope.filters.toDate) query.toDate = view.dateOnly($scope.filters.toDate) || 'invalid';
        return query;
      }

      function locationQuery() {
        var source = $location.search();
        var query = $scope.latestOnly ? { page: 0, size: HOME_PAGE_SIZE } : { page: view.integer(source.page, 0), size: view.integer(source.size, 25, 1) };
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
        // Asking for nothing is only an error once the person has pressed Search.
        $scope.searchError = $scope.submitted && $scope.searchBy && !view.text($scope.searchTerm)
          ? 'Enter ' + ($scope.searchBy === 'externalId' ? 'an ' : 'a ') + $scope.typeLabel() + '.' : null;
        var hasTerm = !!view.text($scope.searchTerm);
        if (!$scope.listEnabled || (($scope.requireTerm || $scope.lookupOnly) && !hasTerm) || ($scope.requireTerm && !$scope.searchBy)) {
          $scope.validationError = null;
          return false;
        }
        if ($scope.lookupOnly && !$scope.isExactLookup()) {
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
        var criteria = view.lookupCriteria(query.search, query.searchBy);
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
        canonicalFilters();
        if (!validate()) {
          loader.reset();
          lastQuery = null;
          // An emptied search drops its value from the address too, so a reload does not bring it back.
          if ($scope.requireTerm) $location.search(queryString()).replace();
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
      $scope.submitSearch = function() {
        $scope.submitted = true;
        $scope.applyFilters();
      };
      $scope.clearFilters = function() {
        $scope.searchTerm = '';
        $scope.submitted = false;
        $scope.filters = { state: '', designStatus: '', category: '', channelType: '', fromDate: null, toDate: null };
        $scope.currentPage = 0;
        commit(!!($scope.validationError || $scope.searchError));
      };
      $scope.onSearchChange = function() {
        cancelSearch();
        $scope.submitted = false;
        $scope.searchError = null;
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
        if ($scope.latestOnly) return;
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
      // The default list (opened with no search or filter in the address) starts with the configured category. It is an
      // ordinary Category filter: it shows in the menu and as a chip, and a person can change or clear it.
      var defaultCategory = window.APP_CONFIG && typeof window.APP_CONFIG.defaultCategory === 'string' ? window.APP_CONFIG.defaultCategory.trim() : '';
      var untouched = ['search', 'searchBy', 'state', 'designStatus', 'category', 'channelType', 'fromDate', 'toDate'].every(function(key) {
        return view.text($location.search()[key]) === '';
      });
      if (defaultCategory && $scope.listEnabled && !$scope.requireTerm && !$scope.lookupOnly && untouched) {
        $scope.filters.category = defaultCategory;
        rememberOptions([]);
      }
      commit(true);
    }
  ]);
