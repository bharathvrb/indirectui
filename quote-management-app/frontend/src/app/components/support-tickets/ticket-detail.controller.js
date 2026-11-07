'use strict';

angular.module('quoteManagement')
  .controller('TicketDetailCtrl', ['$scope', '$routeParams', '$location', 'SupportTicketService',
    function($scope, $routeParams, $location, SupportTicketService) {

      $scope.ticket = null;
      $scope.loading = true;
      $scope.error = null;

      var statusLabels = {
        open:            { label: 'Open',             css: 'danger' },
        inProgress:      { label: 'In Progress',      css: 'warning' },
        pendingCustomer: { label: 'Pending Customer', css: 'info' },
        resolved:        { label: 'Resolved',         css: 'success' },
        closed:          { label: 'Closed',           css: 'secondary' },
        cancelled:       { label: 'Cancelled',        css: 'dark' }
      };

      var priorityLabels = {
        critical: { label: 'Critical', css: 'danger' },
        high:     { label: 'High',     css: 'warning' },
        medium:   { label: 'Medium',   css: 'primary' },
        low:      { label: 'Low',      css: 'secondary' }
      };

      $scope.getStatusCss   = function(s) { return (statusLabels[s]   || { css: 'secondary' }).css; };
      $scope.getStatusLabel = function(s) { return (statusLabels[s]   || { label: s }).label; };
      $scope.getPriorityCss  = function(p) { return (priorityLabels[p] || { css: 'secondary' }).css; };
      $scope.getPriorityLabel = function(p) { return (priorityLabels[p] || { label: p }).label; };

      $scope.loadTicket = function() {
        $scope.loading = true;
        SupportTicketService.getTicket($routeParams.id).then(function(res) {
          $scope.ticket = res.data;
          $scope.loading = false;
        }, function() {
          $scope.error = 'Ticket not found.';
          $scope.loading = false;
        });
      };

      $scope.updateStatus = function(status) {
        var resolution = null;
        if (status === 'resolved' || status === 'closed') {
          resolution = prompt('Enter resolution notes:');
          if (resolution === null) return;
        }
        SupportTicketService.updateStatus($scope.ticket.id, status, resolution).then(function(res) {
          $scope.ticket = res.data;
        });
      };

      $scope.retryQuote = function() {
        if (!confirm('Record a retry attempt for the associated quote?')) return;
        SupportTicketService.retryFromTicket($scope.ticket.id).then(function(res) {
          $scope.ticket = res.data;
          alert('Retry recorded. Retry count: ' + $scope.ticket.retryCount);
        });
      };

      $scope.viewQuote = function() {
        if ($scope.ticket && $scope.ticket.quote) {
          $location.path('/quotes/' + $scope.ticket.quote.id);
        }
      };

      $scope.goBack = function() { $location.path('/support-tickets'); };

      $scope.loadTicket();
    }
  ]);