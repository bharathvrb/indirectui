'use strict';

// One contact (customer or site) as a card: name, role, how to reach them, and a "Details" drawer
// that lists every field the API returned, so nothing is lost compared with a wide table.
angular.module('quoteManagement')
  .component('qmContactCard', {
    bindings: { contact: '<', fields: '<', read: '&' },
    template: [
      '<article class="qm-contact" id="{{$ctrl.contact._key}}" tabindex="-1" ng-class="{\'is-signer\': $ctrl.isSigner()}">',
      '  <header class="qm-contact-head">',
      '    <span class="qm-contact-avatar" aria-hidden="true">{{$ctrl.initials()}}</span>',
      '    <div class="qm-contact-who">',
      '      <h4 class="qm-contact-name">{{$ctrl.name()}}</h4>',
      '      <p class="qm-contact-role" ng-if="$ctrl.subtitle()">{{$ctrl.subtitle()}}</p>',
      '    </div>',
      '    <div class="qm-contact-tags">',
      '      <span class="badge bg-primary" ng-if="$ctrl.contact.role">{{$ctrl.contact.role}}</span>',
      '      <span class="badge bg-success" ng-if="$ctrl.isSigner()"><i class="bi bi-patch-check-fill me-1" aria-hidden="true"></i>Signer</span>',
      '      <span class="badge" ng-if="$ctrl.contact.status" ng-class="$ctrl.statusClass()">{{$ctrl.contact.status}}</span>',
      '    </div>',
      '  </header>',
      '  <ul class="qm-contact-lines" ng-if="$ctrl.contact.emailAddress || $ctrl.phone() || $ctrl.contact.mobileNumber">',
      '    <li ng-if="$ctrl.contact.emailAddress"><i class="bi bi-envelope" aria-hidden="true"></i><a ng-href="mailto:{{$ctrl.contact.emailAddress}}">{{$ctrl.contact.emailAddress}}</a></li>',
      '    <li ng-if="$ctrl.phone()"><i class="bi bi-telephone" aria-hidden="true"></i><a ng-href="tel:{{$ctrl.contact.phoneNumber}}">{{$ctrl.phone()}}</a></li>',
      '    <li ng-if="$ctrl.contact.mobileNumber"><i class="bi bi-phone" aria-hidden="true"></i><a ng-href="tel:{{$ctrl.contact.mobileNumber}}">{{$ctrl.contact.mobileNumber}}</a><span class="qm-contact-note">mobile</span></li>',
      '  </ul>',
      '  <button type="button" class="qm-more" ng-click="$ctrl.open = !$ctrl.open" aria-expanded="{{!!$ctrl.open}}" aria-controls="{{$ctrl.contact._key}}-all">',
      '    <i class="bi" ng-class="$ctrl.open ? \'bi-chevron-up\' : \'bi-chevron-down\'" aria-hidden="true"></i>{{$ctrl.open ? \'Hide\' : \'Show\'}} all details',
      '  </button>',
      '  <dl class="qm-contact-all" id="{{$ctrl.contact._key}}-all" ng-if="$ctrl.open">',
      '    <div ng-repeat="field in $ctrl.fields"><dt>{{field[1]}}</dt><dd>{{$ctrl.value(field[0])}}</dd></div>',
      '  </dl>',
      '</article>'
    ].join('\n'),
    controller: function() {
      var ctrl = this;
      function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
      ctrl.name = function() {
        var full = [text(ctrl.contact.givenName), text(ctrl.contact.familyName)].filter(Boolean).join(' ');
        return full || text(ctrl.contact.roleName) || text(ctrl.contact.role) || 'Unnamed contact';
      };
      ctrl.initials = function() {
        var parts = [text(ctrl.contact.givenName), text(ctrl.contact.familyName)].filter(Boolean);
        var letters = parts.length ? parts.map(function(part) { return part.charAt(0); }).join('') : ctrl.name().charAt(0);
        return letters.slice(0, 2).toUpperCase();
      };
      ctrl.subtitle = function() {
        return [text(ctrl.contact.title), text(ctrl.contact.roleName)].filter(function(item, index, all) {
          return item && all.indexOf(item) === index;
        }).join(' · ');
      };
      ctrl.isSigner = function() { return ctrl.contact.isSigner === true || ctrl.contact.isSigner === 1 || ctrl.contact.isSigner === 'true'; };
      ctrl.phone = function() {
        var number = text(ctrl.contact.phoneNumber);
        return number && text(ctrl.contact.phoneExtension) ? number + ' ext ' + text(ctrl.contact.phoneExtension) : number;
      };
      ctrl.statusClass = function() { return text(ctrl.contact.status).toUpperCase() === 'ACTIVE' ? 'bg-success' : 'bg-secondary'; };
      ctrl.value = function(key) { return ctrl.read({ contact: ctrl.contact, key: key }); };
    }
  });
