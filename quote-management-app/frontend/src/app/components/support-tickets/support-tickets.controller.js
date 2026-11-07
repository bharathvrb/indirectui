'use strict';

angular.module('quoteManagement')
  .controller('SupportTicketsCtrl', ['$scope', '$location', 'QuoteViewService',
    function($scope, $location, QuoteViewService) {
      var view = QuoteViewService;
      var lastQuery;
      $scope.ticketNumber = '';
      $scope.lastSearchTicket = '';
      $scope.searched = false;
      $scope.validationError = null;
      $scope.displayValue = view.displayValue;
      var loader = view.createLoader($scope, 'results', function() {
        if (lastQuery.page !== $scope.currentPage || lastQuery.size !== $scope.pageSize) {
          lastQuery = angular.extend({}, lastQuery, { page: $scope.currentPage, size: $scope.pageSize });
          $location.search(lastQuery).replace();
        }
      });

      function readQuery() {
        var query = $location.search();
        $scope.ticketNumber = view.text(query.ticketNumber);
        $scope.lastSearchTicket = $scope.ticketNumber;
        $scope.currentPage = view.integer(query.page, 0);
        $scope.pageSize = view.integer(query.size, 25, 1);
      }
      function queryString() {
        var query = { page: $scope.currentPage, size: $scope.pageSize };
        if ($scope.lastSearchTicket) query.ticketNumber = $scope.lastSearchTicket;
        return query;
      }
      function request(query) {
        $scope.validationError = null;
        $scope.searched = !!query.ticketNumber;
        if (query.ticketNumber) loader.load(angular.extend({}, query, { sort: 'createdAt,desc' }));
        else loader.reset();
      }
      function commit(force) {
        var query = queryString();
        if (!force && angular.equals(query, lastQuery)) return;
        lastQuery = angular.copy(query);
        $location.search(query);
        request(query);
      }
      $scope.searchByTicket = function() {
        var ticket = view.text($scope.ticketNumber);
        if (!ticket) {
          loader.reset();
          $scope.searched = false;
          $scope.validationError = 'Enter a SKY or support ticket number.';
          return;
        }
        $scope.ticketNumber = ticket;
        $scope.lastSearchTicket = ticket;
        $scope.currentPage = 0;
        commit(true);
      };
      $scope.refresh = function() { if ($scope.lastSearchTicket) commit(true); };
      $scope.clearSearch = function() {
        $scope.ticketNumber = '';
        $scope.lastSearchTicket = '';
        $scope.currentPage = 0;
        commit(true);
      };
      $scope.goToPage = function(page) {
        if (view.integer(page, null) === null || page >= $scope.totalPages || page === $scope.currentPage) return;
        $scope.currentPage = page;
        commit(false);
      };
      $scope.$on('$routeUpdate', function() {
        if ($location.path() !== '/support-tickets') return;
        var source = $location.search();
        var query = { page: view.integer(source.page, 0), size: view.integer(source.size, 25, 1) };
        if (view.text(source.ticketNumber)) query.ticketNumber = view.text(source.ticketNumber);
        if (angular.equals(query, lastQuery)) return;
        readQuery();
        lastQuery = angular.copy(query);
        request(query);
      });
      readQuery();
      lastQuery = queryString();
      request(lastQuery);
    }
  ]);
