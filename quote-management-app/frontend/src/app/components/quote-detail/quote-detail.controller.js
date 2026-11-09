'use strict';

angular.module('quoteManagement')
  .controller('QuoteDetailCtrl', ['$scope', '$routeParams', '$location', '$timeout', '$window', '$document', '$q', 'QuoteService', 'QuoteJourney',
    function($scope, $routeParams, $location, $timeout, $window, $document, $q, QuoteService, QuoteJourney) {
      var document = $document[0];
      var requestGeneration = 0;
      var returnFocus = null;
      var restoreFocusAfterLoad = false;
      var siteLookup = Object.create(null);
      var itemLookup = Object.create(null);
      var contactLookup = Object.create(null);
      var focusTimers = [];
      var copyTimer = null;
      var copiedTimer = null;
      $scope.loading = true;
      $scope.error = null;
      $scope.trackingId = null;
      $scope.quote = null;
      $scope.activeTab = 'customer';
      $scope.failureSummary = null;
      $scope.idRows = [];
      $scope.customer = {};
      $scope.customerAddress = {};
      $scope.customerContacts = [];
      $scope.sites = [];
      $scope.selectedSiteId = '';
      $scope.promotions = [];
      $scope.promotionGroupRows = [];
      $scope.processingSteps = [];
      $scope.monitoring = null;
      $scope.errorRows = [];
      $scope.errorFilters = { source: '', code: '' };
      $scope.errorSourceOptions = [];
      $scope.errorCodeOptions = [];
      $scope.events = [];
      $scope.payloadFormatted = '';
      $scope.payloadInvalid = false;
      $scope.payloadWarning = null;
      $scope.payloadCollapsed = false;
      $scope.showFullPayload = true;
      $scope.payloadSearch = '';
      $scope.payloadQuery = { text: '' };
      $scope.payloadSearchCount = 0;
      $scope.contract = { soa: null, msa: null };
      $scope.contractDownloadError = null;
      $scope.completeDialogOpen = false;
      $scope.completeSubmitting = false;
      $scope.completeError = null;
      $scope.completeForm = { note: '' };
      $scope.focusItemId = null;
      $scope.copyFeedback = '';
      $scope.navigationNotice = '';
      $scope.errorItemId = '';
      $scope.completeTrackingId = null;
      $scope.contractTrackingId = null;
      $scope.completionNotice = '';
      $scope.tabs = [
        { id: 'customer', label: 'Customer', icon: 'bi-building' }, { id: 'sites', label: 'Sites', icon: 'bi-geo-alt' },
        { id: 'products', label: 'Products', icon: 'bi-box-seam' }, { id: 'promotions', label: 'Promotions', icon: 'bi-tags' },
        { id: 'processing', label: 'Processing', icon: 'bi-diagram-3' }, { id: 'errors', label: 'Errors', icon: 'bi-bug' },
        { id: 'events', label: 'Events', icon: 'bi-broadcast' }, { id: 'payload', label: 'Payload', icon: 'bi-braces' },
        { id: 'contract', label: 'Contracts', icon: 'bi-file-earmark-text' }
      ];
      $scope.journey = QuoteJourney.build([]);
      $scope.ui = { compact: false, stepsOpen: false };
      $scope.copiedValue = '';
      // Step retry (UI-11): visible everywhere a step failed; enabled only by features.retryEnabled.
      $scope.retryEnabled = !!($window.APP_CONFIG && $window.APP_CONFIG.features && $window.APP_CONFIG.features.retryEnabled === true);
      $scope.retry = { open: false, step: null, submitting: false, error: null, trackingId: null };
      $scope.retryRequested = Object.create(null);
      $scope.customerFields = [
        ['customerName', 'Customer Name'], ['tradingName', 'Trading Name'], ['organizationType', 'Organization Type'],
        ['channelType', 'Channel Type'], ['customerType', 'Customer Type'], ['customerSubType', 'Customer Sub-Type'],
        ['industry', 'Industry'], ['subIndustry', 'Sub-Industry'], ['sic4', 'SIC4'], ['specialPopulation', 'Special Population'],
        ['custDivisionId', 'Division ID'], ['custRegionId', 'Region ID'], ['existingCustomerId', 'Existing Customer ID'],
        ['existingAgreementId', 'Existing Agreement ID'], ['amdocsCustomerId', 'Amdocs Customer ID']
      ];
      $scope.addressFields = [
        ['street1', 'Street 1'], ['street2', 'Street 2'], ['city', 'City'], ['state', 'State'],
        ['postCode', 'Post Code'], ['country', 'Country'], ['latitude', 'Latitude'], ['longitude', 'Longitude']
      ];
      $scope.contactFields = [
        ['id', 'Contact ID'], ['role', 'Role'], ['roleName', 'Role Name'], ['givenName', 'Given Name'],
        ['familyName', 'Family Name'], ['title', 'Title'], ['emailAddress', 'Email'], ['phoneNumber', 'Phone'],
        ['phoneExtension', 'Extension'], ['mobileNumber', 'Mobile'], ['preferredContactMethod', 'Preferred Contact Method'],
        ['partyRefId', 'Party Ref ID'], ['existingPartyId', 'Existing Party ID'], ['amdocsIndividualId', 'Amdocs Individual ID'],
        ['isSigner', 'Is Signer'], ['signerAuthority', 'Signer Authority'], ['status', 'Status'],
        ['referredType', 'Referred Type'], ['createdAt', 'Created At']
      ];
      $scope.detailStats = {
        siteCount: 0,
        productCount: 0,
        errorCount: 0
      };

      function normalizeKey(value) {
        return String(value || '').replace(/[^a-z0-9]/ig, '').toLowerCase();
      }

      function asArray(value) {
        return angular.isArray(value) ? value : [];
      }

      function toNumber(value, fallback) {
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? fallback : parsed;
      }

      function getField(obj, names) {
        if (!obj) return null;
        var i;

        for (i = 0; i < names.length; i++) {
          if (Object.prototype.hasOwnProperty.call(obj, names[i]) && obj[names[i]] !== undefined && obj[names[i]] !== null) {
            return obj[names[i]];
          }
        }

        var lookup = {};
        Object.keys(obj).forEach(function(key) {
          lookup[normalizeKey(key)] = obj[key];
        });

        for (i = 0; i < names.length; i++) {
          var normalized = normalizeKey(names[i]);
          if (lookup[normalized] !== undefined && lookup[normalized] !== null) return lookup[normalized];
        }

        return null;
      }

      function normalizeState(state) {
        var value = String(state || '').trim().toUpperCase();
        if (value === 'INPROGRESS') return 'IN_PROGRESS';
        if (value === 'PENDINGAPPROVAL') return 'PENDING_APPROVAL';
        return value;
      }

      function normalizeStepStatus(status) {
        var value = String(status || '').toUpperCase();
        if (value === 'FAILED') return 'FAILURE';
        if (value === 'SUCCESS' || value === 'COMPLETED') return 'SUCCESS';
        if (value === 'INPROGRESS') return 'IN_PROGRESS';
        return value;
      }

      function tryParseJson(value) {
        if (!value || typeof value !== 'string') return null;
        try {
          return JSON.parse(value);
        } catch (e) {
          return null;
        }
      }

      function extractTrackingId(err) {
        if (!err) return null;
        if (err.data && err.data.trackingId) return err.data.trackingId;
        var responseId = angular.isFunction(err.headers) && (err.headers('trackingId') || err.headers('x-tracking-id'));
        return responseId || getField(err.config && err.config.headers, ['trackingId', 'x-tracking-id']);
      }

      function toDateTime(value) {
        if (!value) return 0;
        var date = new Date(value);
        if (isNaN(date.getTime())) return 0;
        return date.getTime();
      }

      function normalizeBoolean(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'boolean') return value;
        var text = String(value).trim().toLowerCase();
        if (text === '1' || text === 'true' || text === 'yes' || text === 'y') return true;
        if (text === '0' || text === 'false' || text === 'no' || text === 'n') return false;
        return !!value;
      }

      function mapContact(contact) {
        return {
          id: getField(contact, ['id', 'contactId']),
          role: getField(contact, ['role', 'contactRole', 'contactType']),
          roleName: getField(contact, ['roleName', 'contactRoleName']),
          givenName: getField(contact, ['givenName', 'firstName', 'name']),
          familyName: getField(contact, ['familyName', 'lastName']),
          title: getField(contact, ['title']),
          emailAddress: getField(contact, ['emailAddress', 'email']),
          phoneNumber: getField(contact, ['phoneNumber', 'phone']),
          phoneExtension: getField(contact, ['phoneExtension', 'extension']),
          mobileNumber: getField(contact, ['mobileNumber']),
          preferredContactMethod: getField(contact, ['preferredContactMethod']),
          partyRefId: getField(contact, ['partyRefId']),
          existingPartyId: getField(contact, ['existingPartyId']),
          amdocsIndividualId: getField(contact, ['amdocsIndividualId']),
          isSigner: normalizeBoolean(getField(contact, ['isSigner'])),
          signerAuthority: getField(contact, ['signerAuthority']),
          status: getField(contact, ['status']),
          referredType: getField(contact, ['referredType']),
          createdAt: getField(contact, ['createdAt'])
        };
      }

      function mapAddress(addressSource) {
        if (!addressSource) return null;
        return {
          street1: getField(addressSource, ['street1', 'custStreet1']),
          street2: getField(addressSource, ['street2', 'custStreet2']),
          city: getField(addressSource, ['city', 'custCity']),
          state: getField(addressSource, ['state', 'stateOrProvince', 'custState']),
          postCode: getField(addressSource, ['postCode', 'postalCode', 'custPostCode']),
          country: getField(addressSource, ['country', 'custCountry']),
          latitude: getField(addressSource, ['latitude', 'custLatitude']),
          longitude: getField(addressSource, ['longitude', 'custLongitude'])
        };
      }

      function mapPrices(rawPrices) {
        return asArray(rawPrices).map(function(price) {
          return {
            priceType: getField(price, ['priceType']),
            priceName: getField(price, ['priceName', 'name']),
            recurringPeriod: getField(price, ['recurringPeriod', 'recurringChargePeriod']),
            amount: getField(price, ['amount', 'value']),
            currency: getField(price, ['currency', 'unit', 'currencyCode'])
          };
        });
      }

      function mapCharacteristics(rawCharacteristics) {
        return asArray(rawCharacteristics).map(function(characteristic) {
          return {
            name: getField(characteristic, ['name']),
            value: getField(characteristic, ['value']),
            valueType: getField(characteristic, ['valueType']),
            displayName: getField(characteristic, ['displayName'])
          };
        });
      }

      function mapTerms(rawTerms) {
        return asArray(rawTerms).map(function(term) {
          return {
            termName: getField(term, ['termName', 'name']),
            termDuration: getField(term, ['termDuration', 'duration']),
            termUnits: getField(term, ['termUnits', 'units']),
            termType: getField(term, ['termType', 'type']),
            isRequestedTerm: getField(term, ['isRequestedTerm'])
          };
        });
      }

      function mapPromotions(rawPromotions, context) {
        return asArray(rawPromotions).map(function(promotion) {
          return {
            promotionId: getField(promotion, ['promotionId', 'id']),
            promotionName: getField(promotion, ['promotionName', 'name']),
            promotionType: getField(promotion, ['promotionType', 'type']),
            qualified: normalizeBoolean(getField(promotion, ['qualified'])),
            applied: normalizeBoolean(getField(promotion, ['applied'])),
            sqoImmediatePromotionId: getField(promotion, ['sqoImmediatePromotionId']),
            sqoQualifiedResponse: getField(promotion, ['sqoQualifiedResponse']),
            status: getField(promotion, ['status']),
            createdAt: getField(promotion, ['createdAt']),
            siteId: context.siteId,
            siteName: context.siteName,
            productItemId: context.productItemId,
            productItemName: context.productItemName
          };
        });
      }

      function mapPayloadItems(payloadItems, siteName, siteId) {
        function walk(item, level) {
          var product = item.product || {};
          var offering = item.productOffering || {};
          var amount = null;
          var currency = null;
          var payloadPrices = asArray(item.quoteItemPrice).map(function(rawPrice) {
            var dutyFree = rawPrice.price && rawPrice.price.dutyFreeAmount ? rawPrice.price.dutyFreeAmount : {};
            amount = dutyFree.value !== undefined ? dutyFree.value : amount;
            currency = dutyFree.unit || currency;
            return {
              priceType: rawPrice.priceType,
              priceName: rawPrice.name,
              recurringPeriod: rawPrice.recurringChargePeriod,
              amount: dutyFree.value,
              currency: dutyFree.unit
            };
          });

          var payloadTerms = asArray(product.productTerm).map(function(rawTerm) {
            var duration = rawTerm.duration || {};
            return {
              termName: rawTerm.name,
              termDuration: duration.amount,
              termUnits: duration.units,
              termType: rawTerm.termType || rawTerm['@type'],
              isRequestedTerm: rawTerm.isRequested
            };
          });

          var payloadCharacteristics = asArray(product.productCharacteristic).map(function(rawChar) {
            return {
              name: rawChar.name,
              value: rawChar.value,
              valueType: rawChar.valueType,
              displayName: rawChar.displayName
            };
          });

          var mapped = {
            itemId: getField(item, ['id']),
            parentItemId: null,
            itemLevel: level,
            productOfferingName: offering.name || product.name,
            productOfferingType: getField(offering, ['@referredType', '@type', 'productOfferingType']),
            action: getField(item, ['action']),
            quantity: getField(item, ['quantity']),
            isBundle: getField(product, ['isBundle']),
            productSpecId: getField(product, ['id', 'productSpecificationId']),
            status: normalizeStepStatus(getField(item, ['state'])),
            sqoProductOfferingInstanceId: null,
            sqoProductOfferingAgreementId: getField(offering, ['id']),
            characteristics: payloadCharacteristics,
            prices: payloadPrices,
            terms: payloadTerms,
            promotions: mapPromotions(asArray(item.promotion), {
              siteId: siteId,
              siteName: siteName,
              productItemId: getField(item, ['id']),
              productItemName: offering.name || product.name
            }),
            children: []
          };

          mapped.children = asArray(item.quoteItem).map(function(child) {
            var mappedChild = walk(child, level + 1);
            mappedChild.parentItemId = mapped.itemId;
            return mappedChild;
          });

          return mapped;
        }

        return asArray(payloadItems).map(function(item) {
          return walk(item, 0);
        });
      }

      function buildItemTree(rawItems, siteContext) {
        var items = Object.create(null);
        var nodes = [];
        var roots = [];

        function add(rawItem, nestedParent, ancestors) {
          if (!rawItem || ancestors.indexOf(rawItem) !== -1) return;
          var itemId = getField(rawItem, ['itemId', 'id']);
          var parentId = getField(rawItem, ['parentItemId', 'parentId']);
          var node = {
            id: getField(rawItem, ['id']),
            itemId: itemId,
            parentItemId: parentId === null && nestedParent ? nestedParent.itemId : parentId,
            itemLevel: toNumber(getField(rawItem, ['itemLevel']), null),
            productOfferingName: getField(rawItem, ['productOfferingName', 'productName', 'name']),
            productOfferingId: getField(rawItem, ['productOfferingId']),
            productOfferingType: getField(rawItem, ['productOfferingType']),
            action: getField(rawItem, ['action']),
            quantity: getField(rawItem, ['quantity']),
            isBundle: normalizeBoolean(getField(rawItem, ['isBundle'])),
            productSpecId: getField(rawItem, ['productSpecId']),
            status: normalizeStepStatus(getField(rawItem, ['status'])),
            sqoProductOfferingInstanceId: getField(rawItem, ['sqoProductOfferingInstanceId']),
            sqoProductOfferingAgreementId: getField(rawItem, ['sqoProductOfferingAgreementId']),
            sqoRootOfferInstanceId: getField(rawItem, ['sqoRootOfferInstanceId']),
            createdAt: getField(rawItem, ['createdAt']),
            characteristics: mapCharacteristics(getField(rawItem, ['characteristics'])),
            prices: mapPrices(getField(rawItem, ['prices'])),
            terms: mapTerms(getField(rawItem, ['terms'])),
            promotions: mapPromotions(getField(rawItem, ['promotions']), {
              siteId: siteContext.siteId,
              siteName: siteContext.siteName,
              productItemId: itemId,
              productItemName: getField(rawItem, ['productOfferingName', 'productName', 'name'])
            }),
            children: [],
            _key: siteContext._key + '-item-' + nodes.length,
            _site: siteContext,
            _nestedParent: nestedParent
          };
          nodes.push(node);
          if (itemId !== null && items[String(itemId)] === undefined) items[String(itemId)] = node;
          var databaseId = getField(rawItem, ['id']);
          if (databaseId !== null && items[String(databaseId)] === undefined) items[String(databaseId)] = node;
          asArray(getField(rawItem, ['children', 'items'])).forEach(function(child) {
            add(child, node, ancestors.concat([rawItem]));
          });
        }
        asArray(rawItems).forEach(function(rawItem) { add(rawItem, null, []); });
        nodes.forEach(function(node) {
          node._parent = node.itemLevel === 0 ? null : (items[String(node.parentItemId)] || node._nestedParent || null);
          delete node._nestedParent;
        });
        // Break a cyclic edge, not the entire component: every item must remain reachable.
        nodes.forEach(function(node) {
          var seen = [node];
          var parent = node._parent;
          while (parent) {
            if (seen.indexOf(parent) !== -1) {
              node._parent = null;
              break;
            }
            seen.push(parent);
            parent = parent._parent;
          }
        });
        nodes.forEach(function(node) {
          if (node._parent) node._parent.children.push(node);
          else roots.push(node);
          node._expanded = node.itemLevel === null ? !node._parent : node.itemLevel === 0;
          node._detailsExpanded = false;
          [node.itemId, node.id].forEach(function(id) {
            if (id === null || id === undefined) return;
            var matches = itemLookup[String(id)] || (itemLookup[String(id)] = []);
            if (matches.indexOf(node) === -1) matches.push(node);
          });
        });
        return roots;
      }

      function collectPromotionsFromTree(nodes, bucket) {
        asArray(nodes).forEach(function(node) {
          asArray(node.promotions).forEach(function(promotion) { bucket.push(promotion); });
          collectPromotionsFromTree(node.children, bucket);
        });
      }

      function countProducts(nodes) {
        var count = 0;
        asArray(nodes).forEach(function(node) {
          count++;
          count += countProducts(node.children);
        });
        return count;
      }

      function buildVisibleItems(site) {
        var visible = [];
        var visited = {};

        function walk(node, depth) {
          if (!node) return;
          var visitKey = node._key || site.siteId + '::' + node.itemId;
          if (visited[visitKey]) return;
          visited[visitKey] = true;

          node._depth = depth;
          node._hasChildren = asArray(node.children).length > 0;
          visible.push(node);

          if (node._hasChildren && node._expanded) {
            node.children.forEach(function(child) { walk(child, depth + 1); });
          }
        }

        asArray(site.productItems).forEach(function(root) { walk(root, 0); });
        site.visibleItems = visible;
      }

      function hydrateCustomer(data, payload) {
        var customerParty = null;
        var payloadRelated = asArray(payload && payload.relatedParty);
        payloadRelated.forEach(function(party) {
          if (!customerParty && String(party.role || '').toLowerCase() === 'customer') {
            customerParty = party;
          }
        });

        var characteristics = customerParty && customerParty.characteristic ? customerParty.characteristic : [];
        function payloadCharacteristic(name) {
          var match = asArray(characteristics).filter(function(c) { return c && c.name === name; })[0];
          return match ? match.value : null;
        }

        $scope.customer = {
          customerName: getField(data, ['customerName']) || (customerParty ? customerParty.name : null),
          tradingName: getField(data, ['tradingName']) || payloadCharacteristic('tradingName'),
          organizationType: getField(data, ['organizationType']) || payloadCharacteristic('organizationType'),
          channelType: getField(data, ['channelType']) || payloadCharacteristic('channelType'),
          customerType: getField(data, ['customerType']) || payloadCharacteristic('customerType'),
          customerSubType: getField(data, ['customerSubType']) || payloadCharacteristic('customerSubType'),
          industry: getField(data, ['industry']) || payloadCharacteristic('industry'),
          subIndustry: getField(data, ['subIndustry']) || payloadCharacteristic('subIndustry'),
          sic4: getField(data, ['sic4']) || payloadCharacteristic('sic4'),
          specialPopulation: getField(data, ['specialPopulation']) || payloadCharacteristic('specialPopulation')
        };
        $scope.customerFields.forEach(function(field) {
          var stored = getField(data, [field[0]]);
          if (stored !== null && stored !== undefined) $scope.customer[field[0]] = stored;
        });

        $scope.customerAddress = mapAddress({
          street1: getField(data, ['custStreet1']),
          street2: getField(data, ['custStreet2']),
          city: getField(data, ['custCity']),
          state: getField(data, ['custState']),
          postCode: getField(data, ['custPostCode']),
          country: getField(data, ['custCountry']),
          latitude: getField(data, ['custLatitude']),
          longitude: getField(data, ['custLongitude'])
        }) || {};

        var postalAddress = asArray(payload && payload.contactMedium).filter(function(medium) {
          return String(medium.mediumType || '').toLowerCase() === 'postaladdress';
        })[0];
        var fallbackAddress = mapAddress(postalAddress && postalAddress.characteristic) || {};
        $scope.addressFields.forEach(function(field) {
          if ($scope.customerAddress[field[0]] === null) $scope.customerAddress[field[0]] = fallbackAddress[field[0]];
        });

        $scope.customerContacts = asArray(getField(data, ['contacts'])).map(mapContact);

        if ($scope.customerContacts.length === 0 && payload) {
          var payloadMediums = asArray(payload.contactMedium);
          $scope.customerContacts = payloadRelated
            .filter(function(party) { return String(party.role || '').toLowerCase() === 'contact'; })
            .map(function(contactParty) {
              var matchingMediums = payloadMediums.filter(function(medium) {
                var type = medium && medium.characteristic ? medium.characteristic.contactType : null;
                return type && type.indexOf(contactParty.id + ':') === 0;
              });
              var emailMedium = matchingMediums.filter(function(medium) { return medium.mediumType === 'EmailAddress'; })[0];
              var phoneMedium = matchingMediums.filter(function(medium) { return medium.mediumType === 'TelephoneNumber'; })[0];
              return {
                role: 'Contact',
                roleName: null,
                givenName: contactParty.name,
                familyName: null,
                title: null,
                emailAddress: emailMedium && emailMedium.characteristic ? emailMedium.characteristic.emailAddress : null,
                phoneNumber: phoneMedium && phoneMedium.characteristic ? phoneMedium.characteristic.phoneNumber : null,
                phoneExtension: phoneMedium && phoneMedium.characteristic ? phoneMedium.characteristic.extension : null,
                mobileNumber: null,
                preferredContactMethod: null,
                partyRefId: contactParty.id,
                existingPartyId: null,
                amdocsIndividualId: null,
                isSigner: null,
                signerAuthority: null,
                status: null
              };
            });
        }
      }

      function hydrateSitesProductsAndPromotions(data, payload) {
        var allPromotions = [];
        var sites = [];
        var rawSites = asArray(getField(data, ['sites']));
        var flatItems = asArray(getField(data, ['items']));
        siteLookup = Object.create(null);
        itemLookup = Object.create(null);
        contactLookup = Object.create(null);

        if (rawSites.length > 0) {
          rawSites.forEach(function(rawSite, index) {
            var siteId = getField(rawSite, ['siteId', 'siteItemId', 'id']) || ('SITE-' + index);
            var siteName = getField(rawSite, ['siteName', 'name', 'siteItemId']) || siteId;
            var address = mapAddress(getField(rawSite, ['address']) || rawSite) || {};

            var site = {
              _key: 'site-' + index,
              id: getField(rawSite, ['id']),
              siteItemId: getField(rawSite, ['siteItemId']),
              placeId: getField(rawSite, ['placeId']),
              quoteRequestId: getField(rawSite, ['quoteRequestId']),
              createdAt: getField(rawSite, ['createdAt']),
              siteId: siteId,
              siteName: siteName,
              action: getField(rawSite, ['action']),
              address: address,
              elocId: getField(rawSite, ['elocId']),
              naxIdx9: getField(rawSite, ['naxIdx9']),
              divisionId: getField(rawSite, ['divisionId']),
              regionId: getField(rawSite, ['regionId']),
              marketId: getField(rawSite, ['marketId']),
              latitude: getField(rawSite, ['latitude']) === null ? address.latitude : getField(rawSite, ['latitude']),
              longitude: getField(rawSite, ['longitude']) === null ? address.longitude : getField(rawSite, ['longitude']),
              cuid: getField(rawSite, ['cuid']),
              amdocsAddressId: getField(rawSite, ['amdocsAddressId']),
              status: getField(rawSite, ['status']),
              siteType: getField(rawSite, ['siteType']),
              siteSurveyId: getField(rawSite, ['siteSurveyId']),
              projectId: getField(rawSite, ['projectId']),
              contacts: asArray(getField(rawSite, ['contacts'])).map(mapContact),
              visibleItems: []
            };
            [site.siteId, site.siteItemId, site.id].forEach(function(id) {
              if (id !== null && id !== undefined) siteLookup[String(id)] = site;
            });
            site._rawItems = asArray(getField(rawSite, ['items', 'productItems']));
            sites.push(site);
          });
        }
        var unscoped = [];
        flatItems.forEach(function(item) {
          var site = siteLookup[String(getField(item, ['siteId', 'siteItemId', 'quoteSiteId']))];
          if (site) {
            var id = getField(item, ['itemId', 'id']);
            if (!site._rawItems.some(function(existing) { return id !== null && String(getField(existing, ['itemId', 'id'])) === String(id); })) {
              site._rawItems.push(item);
            }
          } else {
            unscoped.push(item);
          }
        });
        if (unscoped.length || (!sites.length && payload && angular.isArray(payload.quoteItem))) {
          var pseudoSite = {
            _key: 'quote-items',
            siteId: 'QUOTE',
            siteName: 'Quote Level',
            action: null,
            address: {},
            contacts: [],
            _synthetic: true,
            _rawItems: unscoped.length ? unscoped : mapPayloadItems(payload.quoteItem, 'Quote Level', 'QUOTE'),
            visibleItems: []
          };
          siteLookup.QUOTE = pseudoSite;
          sites.push(pseudoSite);
        }
        function indexContacts(contacts, site) {
          contacts.forEach(function(contact, index) {
            contact._key = (site ? site._key : 'customer') + '-contact-' + index;
            contact._site = site;
            [contact.id, contact.partyRefId, contact.existingPartyId].forEach(function(id) {
              if (id !== null && id !== undefined) contactLookup[String(id)] = contact;
            });
          });
        }
        indexContacts($scope.customerContacts, null);
        sites.forEach(function(site) {
          site.productItems = buildItemTree(site._rawItems, site);
          delete site._rawItems;
          indexContacts(site.contacts, site);
          collectPromotionsFromTree(site.productItems, allPromotions);
          buildVisibleItems(site);
        });
        $scope.promotionGroupRows = [];
        sites.forEach(function(site) {
          function visit(item) {
            if (item.promotions.length) $scope.promotionGroupRows.push({ item: item, site: site, rows: item.promotions });
            item.children.forEach(visit);
          }
          site.productItems.forEach(visit);
        });

        $scope.sites = sites;
        $scope.promotions = allPromotions;
      }

      function findItem(itemId, siteId) {
        var matches = itemLookup[String(itemId)] || [];
        var site = siteLookup[String(siteId)];
        return site ? matches.filter(function(item) { return item._site === site; })[0] : matches[0];
      }

      function hydrateProcessing(data) {
        var definitions = Object.create(null);
        asArray(getField(data, ['stepDefinitions'])).forEach(function(definition) {
          definitions[String(getField(definition, ['id', 'stepDefinitionId']))] = definition;
        });
        $scope.processingSteps = asArray(getField(data, ['stepExecutions'])).map(function(step, index) {
          var definitionId = getField(step, ['stepDefinitionId']);
          var definition = definitions[String(definitionId)] || getField(step, ['stepDefinition']) || {};
          var itemId = getField(step, ['itemId', 'scopeId']);
          var stepName = getField(step, ['stepName']) || getField(definition, ['stepName', 'name']);
          var status = normalizeStepStatus(getField(step, ['stepStatus', 'status']));
          var site = siteLookup[String(getField(step, ['siteId', 'siteItemId']))] || siteLookup[String(itemId)];
          var item = findItem(itemId, site && site.siteId);
          if (!site && item) site = item._site;
          var scope = String(getField(step, ['scope']) || getField(definition, ['scope', 'stepScope']) || '').toUpperCase();
          if (!scope) scope = item ? 'QUOTE_ITEM' : site && !site._synthetic ? 'SITE' : itemId && itemId !== 'QUOTE' ? 'QUOTE_ITEM' : 'QUOTE';
          if (item && status === 'FAILURE') item._hasFailedStep = true;
          return {
            id: getField(step, ['id']),
            _key: 'step-' + index,
            stepDefinitionId: definitionId,
            stepOrder: getField(step, ['stepOrder']) === null ? getField(definition, ['stepOrder']) : getField(step, ['stepOrder']),
            stepName: stepName,
            scope: scope,
            itemId: itemId,
            siteId: site ? site.siteId : getField(step, ['siteId']),
            productItemId: item ? item.itemId : null,
            stepStatus: status,
            attemptCount: getField(step, ['attemptCount']),
            maxRetries: getField(step, ['maxRetries']) === null ? getField(definition, ['maxRetries']) : getField(step, ['maxRetries']),
            startedAt: getField(step, ['startedAt']),
            completedAt: getField(step, ['completedAt']),
            createdAt: getField(step, ['createdAt'])
          };
        });

        $scope.processingSteps.sort(function(a, b) {
          var statusWeight = {
            FAILURE: 0,
            IN_PROGRESS: 1,
            PENDING: 2,
            SUCCESS: 3
          };
          var aw = statusWeight[a.stepStatus] !== undefined ? statusWeight[a.stepStatus] : 9;
          var bw = statusWeight[b.stepStatus] !== undefined ? statusWeight[b.stepStatus] : 9;
          if (aw !== bw) return aw - bw;
          if (a.stepOrder !== b.stepOrder) return toNumber(a.stepOrder, Infinity) - toNumber(b.stepOrder, Infinity);
          return toDateTime(b.createdAt) - toDateTime(a.createdAt);
        });

        var monitoringData = getField(data, ['processMonitoringExecution', 'processMonitoringExecutions', 'monitoring', 'monitoringExecution']);
        if (angular.isArray(monitoringData)) {
          monitoringData = monitoringData.length ? monitoringData[0] : null;
        }
        $scope.monitoring = null;
        if (monitoringData && angular.isObject(monitoringData) && Object.keys(monitoringData).length) {
          $scope.monitoring = {};
          ['pollingStatus', 'sqoStatus', 'sqoStatusDescription', 'lastPolledAt', 'attemptCount', 'maxRetries', 'isCompleted', 'isFailed']
            .forEach(function(field) { $scope.monitoring[field] = getField(monitoringData, [field]); });
        }
      }

      function hydrateErrors(data) {
        var steps = Object.create(null);
        $scope.processingSteps.forEach(function(step) {
          if (step.id !== null) steps[String(step.id)] = step;
        });
        $scope.errorRows = asArray(getField(data, ['errorDetails'])).map(function(error, index) {
          var step = steps[String(getField(error, ['stepExecutionId']))];
          var itemId = getField(error, ['itemId']);
          if (itemId === null && step) itemId = step.productItemId || (step.scope === 'QUOTE_ITEM' ? step.itemId : null);
          var siteId = getField(error, ['siteId', 'siteItemId']);
          var item = findItem(itemId, siteId);
          var contactId = getField(error, ['contactId']);
          var contact = contactLookup[String(contactId)];
          var site = siteLookup[String(siteId)] || (item && item._site) ||
            (contact && contact._site) || (step && siteLookup[String(step.siteId)]);
          return {
            _key: 'error-' + index,
            id: getField(error, ['id']),
            stepExecutionId: getField(error, ['stepExecutionId']),
            errorSource: getField(error, ['errorSource']),
            errorCode: getField(error, ['errorCode']),
            errorMessage: getField(error, ['errorMessage']),
            errorDetail: getField(error, ['errorDetail', 'message']),
            httpStatusCode: getField(error, ['httpStatusCode']),
            retryAttempt: getField(error, ['retryAttempt', 'attemptCount']),
            siteId: site ? site.siteId : siteId,
            itemId: item ? item.itemId : itemId,
            contactId: contactId,
            createdAt: getField(error, ['createdAt'])
          };
        });

        $scope.errorRows.sort(function(a, b) {
          return toDateTime(b.createdAt) - toDateTime(a.createdAt);
        });

        var sources = Object.create(null);
        var codes = Object.create(null);
        $scope.errorRows.forEach(function(row) {
          if (row.errorSource) sources[row.errorSource] = true;
          if (row.errorCode) codes[row.errorCode] = true;
        });
        $scope.errorSourceOptions = Object.keys(sources).sort();
        $scope.errorCodeOptions = Object.keys(codes).sort();
      }

      function hydrateEvents(data) {
        $scope.events = asArray(getField(data, ['events'])).map(function(eventRow) {
          return {
            eventType: getField(eventRow, ['eventType']),
            publishedToOnp: getField(eventRow, ['publishedToOnp']),
            onpResponseCode: getField(eventRow, ['onpResponseCode']),
            onpResponseMessage: getField(eventRow, ['onpResponseMessage']),
            eventTime: getField(eventRow, ['eventTime', 'createdAt'])
          };
        });
      }

      function hydratePayload(data) {
        var payloadText = getField(data, ['quotePayload']);
        $scope.payloadInvalid = false;
        $scope.payloadWarning = null;
        $scope.payloadCollapsed = false;
        $scope.showFullPayload = true;

        $scope.payloadFormatted = '';
        if (payloadText !== null && payloadText !== '') {
          try {
            $scope.payloadFormatted = JSON.stringify(typeof payloadText === 'string' ? JSON.parse(payloadText) : payloadText, null, 2);
          } catch (e) {
            $scope.payloadFormatted = String(payloadText);
            $scope.payloadInvalid = true;
            $scope.payloadWarning = 'Payload is not valid JSON';
          }
        }
        $scope.payloadBytes = Math.max(new $window.Blob([$scope.payloadFormatted]).size,
          typeof payloadText === 'string' ? new $window.Blob([payloadText]).size : 0);
        if ($scope.payloadBytes > (1024 * 1024)) {
          $scope.payloadCollapsed = true;
          $scope.showFullPayload = false;
        }

        updatePayloadSearchCount();
      }

      function hydrateFailureSummary(data) {
        var failedStep = $scope.processingSteps
          .filter(function(step) { return step.stepStatus === 'FAILURE'; })
          .sort(function(a, b) { return toDateTime(b.createdAt) - toDateTime(a.createdAt); })[0];

        if (!failedStep) {
          $scope.failureSummary = null;
          return;
        }

        var relatedError = $scope.errorRows
          .filter(function(error) { return String(error.stepExecutionId) === String(failedStep.id); })[0];

        $scope.failureSummary = {
          stepId: failedStep.id,
          failingStepName: failedStep.stepName,
          stageReached: failedStep.stepName,
          errorCode: relatedError ? relatedError.errorCode : null,
          errorMessage: relatedError ? relatedError.errorMessage : null
        };
      }

      function hydrateIdRows(data) {
        $scope.idRows = [
          { label: 'Dynamics Account', value: getField(data, ['dynamicsAccountId']) },
          { label: 'Dynamics Opportunity', value: getField(data, ['dynamicsOpportunityId']) },
          { label: 'Dynamics Contact', value: getField(data, ['dynamicsContactId']) },
          { label: 'Amdocs Customer', value: getField(data, ['amdocsCustomerId']) },
          { label: 'Amdocs Address', value: getField(data, ['amdocsAddressId']) },
          { label: 'Amdocs Organization', value: getField(data, ['amdocsOrganizationId']) },
          { label: 'SQO Proposal', value: getField(data, ['sqoProposalId']) },
          { label: 'SQO Framework Agreement', value: getField(data, ['sqoFrameworkAgreementId']) },
          { label: 'SQO Proposal Version', value: getField(data, ['sqoProposalVersion']) },
          { label: 'Envelope ID', value: getField(data, ['envelopeId']) },
          { label: 'DMAASID SOA', value: getField(data, ['dmaasIdSoa', 'dmaasidSoa', 'DMAASID_SOA']) },
          { label: 'DMAASID MSA', value: getField(data, ['dmaasIdMsa', 'dmaasidMsa', 'DMAASID_MSA']) },
          { label: 'Base Framework Agreement ID', value: getField(data, ['baseFrameworkAgreementId']) },
          { label: 'Base Framework Agreement Name', value: getField(data, ['baseFrameworkAgreementName']) },
          { label: 'Existing Customer ID', value: getField(data, ['existingCustomerId']) },
          { label: 'Existing Agreement ID', value: getField(data, ['existingAgreementId']) }
        ];
      }

      function hydrateContract(data) {
        $scope.contract = {
          soa: getField(data, ['dmaasIdSoa', 'dmaasidSoa', 'DMAASID_SOA']),
          msa: getField(data, ['dmaasIdMsa', 'dmaasidMsa', 'DMAASID_MSA'])
        };
      }

      // The journey lists the steps in order and attaches each failed step's latest recorded error.
      function hydrateJourney() {
        var latestError = Object.create(null);
        $scope.errorRows.forEach(function(row) {
          var key = String(row.stepExecutionId);
          if (row.stepExecutionId !== null && !latestError[key]) latestError[key] = row;
        });
        $scope.journey = QuoteJourney.build($scope.processingSteps.map(function(step) {
          return angular.extend({}, step, { error: step.id !== null ? latestError[String(step.id)] || null : null });
        }));
        // UI-03 failure summary: the latest failed step, with its position in the sequence and its error.
        var summary = $scope.failureSummary;
        $scope.journey.spotlight = summary ? $scope.journey.steps.filter(function(step) {
          return String(step.id) === String(summary.stepId);
        })[0] || null : null;
      }
      $scope.humanize = function(value) {
        return value === null || value === undefined || value === '' ? '—' : QuoteJourney.humanize(value);
      };
      $scope.stepLabel = function(name) { return QuoteJourney.stepInfo(name).label; };

      function hydrateDetailStats() {
        hydrateJourney();
        var productCount = 0;
        asArray($scope.sites).forEach(function(site) {
          productCount += countProducts(site.productItems);
        });

        $scope.detailStats = {
          siteCount: $scope.sites.filter(function(site) { return !site._synthetic; }).length,
          productCount: productCount,
          errorCount: $scope.errorRows.length
        };
      }

      function hydrateQuote(data) {
        var payload = tryParseJson(getField(data, ['quotePayload']));
        $scope.quote = {
          quoteRequestId: getField(data, ['quoteRequestId']) || $routeParams.id,
          externalId: getField(data, ['externalId']),
          category: getField(data, ['category']),
          state: normalizeState(getField(data, ['state'])),
          designStatus: getField(data, ['designStatus']),
          designSubStatus: getField(data, ['designSubStatus']),
          createdAt: getField(data, ['createdAt']),
          updatedAt: getField(data, ['updatedAt']),
          completedAt: getField(data, ['completedAt']),
          createdBy: getField(data, ['createdBy']),
          retryOf: getField(data, ['retryOf']),
          retryCount: getField(data, ['retryCount']),
          supportTicketNumber: getField(data, ['supportTicketNumber', 'ticketNumber']),
          description: getField(data, ['description']),
          message: getField(data, ['message'])
        };

        hydrateCustomer(data, payload);
        hydrateSitesProductsAndPromotions(data, payload);
        hydrateProcessing(data);
        hydrateErrors(data);
        hydrateEvents(data);
        hydratePayload(data, payload);
        hydrateFailureSummary(data);
        hydrateIdRows(data);
        hydrateContract(data);
        hydrateDetailStats();
      }

      function updatePayloadSearchCount() {
        var text = String($scope.payloadFormatted || '');
        var needle = String($scope.payloadSearch || '').trim();
        $scope.payloadMatches = [];
        if (!needle) {
          $scope.payloadSearchCount = 0;
          $scope.payloadMatchIndex = -1;
          return;
        }

        var pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        var match;
        while ((match = pattern.exec(text)) !== null) {
          $scope.payloadMatches.push({ index: match.index, length: match[0].length });
        }
        $scope.payloadSearchCount = $scope.payloadMatches.length;
        $scope.payloadMatchIndex = $scope.payloadMatches.length ? $scope.payloadMatches[0].index : -1;
        $scope.payloadMatchNumber = $scope.payloadMatches.length ? 1 : 0;
      }

      $scope.$watch('payloadSearch', updatePayloadSearchCount);
      $scope.setPayloadSearch = function(text) { $scope.payloadSearch = text; };

      $scope.displayValue = function(value) {
        return value === null || value === undefined || value === '' ? '—' : value;
      };
      $scope.booleanLabel = function(value) {
        var normalized = normalizeBoolean(value);
        return normalized === null ? '—' : normalized ? 'Yes' : 'No';
      };
      $scope.contactValue = function(contact, field) {
        return field === 'isSigner' ? $scope.booleanLabel(contact[field]) : $scope.displayValue(contact[field]);
      };
      $scope.isRemoved = function(row) {
        return String(row.action || '').toUpperCase() === 'DELETE';
      };
      function focusElement(id) {
        focusTimers.push($timeout(function() {
          var element = document.getElementById(id);
          if (!element) return;
          element.focus();
          if (element.scrollIntoView) element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }));
      }
      $scope.tabCount = function(tab) {
        var counts = {
          customer: $scope.customerContacts.length, sites: $scope.detailStats.siteCount,
          products: $scope.detailStats.productCount, promotions: $scope.promotions.length,
          processing: $scope.processingSteps.length, errors: $scope.errorRows.length, events: $scope.events.length,
          contract: ($scope.contract.soa ? 1 : 0) + ($scope.contract.msa ? 1 : 0)
        };
        return counts[tab];
      };
      $scope.tabKeydown = function(event, index) {
        var next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % $scope.tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + $scope.tabs.length - 1) % $scope.tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = $scope.tabs.length - 1;
        else return;
        event.preventDefault();
        $scope.setTab($scope.tabs[next].id);
        focusElement('detail-tab-' + $scope.activeTab);
      };

      $scope.getStateLabel = function(state) {
        var value = normalizeState(state);
        if (value === 'RECEIVED') return 'Received';
        if (value === 'IN_PROGRESS') return 'In Progress';
        if (value === 'PENDING_APPROVAL') return 'Pending Approval';
        if (value === 'COMPLETED') return 'Completed';
        if (value === 'FAILED') return 'Failed';
        return value || '—';
      };

      $scope.getStateBadgeClass = function(state) {
        var value = normalizeState(state);
        if (value === 'RECEIVED') return 'bg-primary';
        if (value === 'IN_PROGRESS') return 'bg-warning text-dark';
        if (value === 'PENDING_APPROVAL') return 'bg-info text-dark';
        if (value === 'COMPLETED') return 'bg-success';
        if (value === 'FAILED') return 'bg-danger';
        return 'bg-secondary';
      };

      // Step status words and colours come from the journey service so the tiles and the table always agree.
      var stepBadge = { success: 'bg-success', failure: 'bg-danger', progress: 'bg-warning text-dark' };
      $scope.getStepStatusClass = function(stepStatus) {
        return stepBadge[QuoteJourney.statusInfo(stepStatus).tone] || 'bg-secondary';
      };

      $scope.getStepStatusLabel = function(stepStatus) {
        var value = normalizeStepStatus(stepStatus);
        return value ? QuoteJourney.statusInfo(value).label : '—';
      };

      // The step grid stays closed until asked for; the failure panel and the journey header both open it.
      $scope.toggleSteps = function() { $scope.ui.stepsOpen = !$scope.ui.stepsOpen; };
      $scope.spotlightClick = function(event) {
        if (event && event.target && event.target.closest && event.target.closest('button, a')) return;
        $scope.toggleSteps();
      };

      // Customer tab: the profile card shows these; the details grid shows the rest.
      var profileKeys = ['customerName', 'tradingName', 'organizationType', 'channelType', 'customerType', 'customerSubType', 'industry', 'subIndustry'];
      $scope.customerDetailFields = $scope.customerFields.filter(function(field) { return profileKeys.indexOf(field[0]) === -1; });
      $scope.customerInitial = function() {
        var name = $scope.displayValue($scope.customer.customerName);
        return /^[A-Za-z0-9]/.test(name) ? name.charAt(0).toUpperCase() : '•';
      };
      // First price of an item for the one-line summary on a product card.
      // The result is cached on the item so the template sees the same object on every digest.
      $scope.primaryPrice = function(item) {
        if (!item) return null;
        if (item._price === undefined) {
          var price = item.prices && item.prices[0];
          item._price = !price || price.amount === null || price.amount === undefined || price.amount === ''
            ? null : { amount: price.amount, currency: price.currency, period: price.recurringPeriod };
        }
        return item._price;
      };

      $scope.setTab = function(tab) {
        $scope.activeTab = tab;
      };

      $scope.goBack = function() {
        $location.path('/quotes');
      };

      $scope.copyValue = function(value) {
        if (!$scope.canCopy(value)) return;
        $scope.copyFeedback = '';
        function copied() {
          notify('Copied to clipboard.');
          $scope.copiedValue = String(value);
          if (copiedTimer) $timeout.cancel(copiedTimer);
          copiedTimer = $timeout(function() { $scope.copiedValue = ''; }, 1800);
        }
        function failed() { notify('Copy unavailable. Select the text and copy it manually.'); }
        if ($window.navigator.clipboard && $window.navigator.clipboard.writeText) {
          try {
            return $q.when($window.navigator.clipboard.writeText(String(value))).then(copied, failed);
          } catch (e) {
            failed();
            return;
          }
        }
        var textarea = document.createElement('textarea');
        textarea.value = String(value);
        textarea.setAttribute('readonly', '');
        textarea.className = 'qm-copy-buffer';
        var previousFocus = document.activeElement;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          if (document.execCommand('copy')) copied();
          else failed();
        } catch (e) { failed(); }
        finally {
          document.body.removeChild(textarea);
          if (previousFocus && previousFocus.focus) previousFocus.focus();
        }
      };

      $scope.isCopied = function(value) {
        return $scope.copiedValue !== '' && $scope.copiedValue === String(value);
      };

      $scope.canCopy = function(value) {
        return value !== null && value !== undefined && value !== '' && value !== '—';
      };

      $scope.setSiteFilter = function(siteId) {
        $scope.selectedSiteId = siteId || '';
        $scope.focusItemId = null;
        $scope.errorItemId = '';
      };

      $scope.clearSiteFilter = function() {
        $scope.selectedSiteId = '';
        $scope.focusItemId = null;
        $scope.errorItemId = '';
      };

      $scope.filteredSites = function() {
        if (!$scope.selectedSiteId) return $scope.sites;
        return $scope.sites.filter(function(site) { return String(site.siteId) === String($scope.selectedSiteId); });
      };

      $scope.filteredProcessingSteps = function() {
        if (!$scope.selectedSiteId) return $scope.processingSteps;
        return $scope.processingSteps.filter(function(step) {
          return String(step.siteId) === String($scope.selectedSiteId);
        });
      };

      $scope.filteredErrors = function() {
        return $scope.errorRows.filter(function(row) {
          if ($scope.selectedSiteId && String(row.siteId) !== String($scope.selectedSiteId)) {
            return false;
          }
          if ($scope.errorFilters.source && row.errorSource !== $scope.errorFilters.source) {
            return false;
          }
          if ($scope.errorFilters.code && row.errorCode !== $scope.errorFilters.code) {
            return false;
          }
          if ($scope.errorItemId && String(row.itemId) !== String($scope.errorItemId)) return false;
          return true;
        });
      };
      $scope.clearErrorItemFilter = function() { $scope.errorItemId = ''; };
      $scope.clearErrorFilters = function() {
        $scope.errorFilters = { source: '', code: '' };
        $scope.errorItemId = '';
      };

      $scope.toggleItem = function(site, row) {
        if (!row || !row._hasChildren) return;
        row._expanded = !row._expanded;
        buildVisibleItems(site);
      };

      $scope.jumpToSite = function(siteId) {
        var site = siteLookup[String(siteId)];
        if (!site) {
          $scope.navigationNotice = 'The referenced site is not present in this response.';
          return;
        }
        $scope.navigationNotice = '';
        $scope.setSiteFilter(site.siteId);
        $scope.activeTab = 'sites';
        focusElement(site._key);
      };

      $scope.jumpToItem = function(itemId, siteId) {
        var item = findItem(itemId, siteId);
        if (!item) {
          $scope.navigationNotice = 'The referenced product item is not present in this response.';
          return;
        }
        $scope.navigationNotice = '';
        $scope.selectedSiteId = item._site.siteId;
        $scope.focusItemId = item.itemId;
        var parent = item._parent;
        while (parent) {
          parent._expanded = true;
          parent = parent._parent;
        }
        buildVisibleItems(item._site);
        $scope.activeTab = 'products';
        focusElement(item._key);
      };
      $scope.jumpToContact = function(contactId) {
        var contact = contactLookup[String(contactId)];
        if (!contact) {
          $scope.navigationNotice = 'The referenced contact is not present in this response.';
          return;
        }
        $scope.navigationNotice = '';
        $scope.activeTab = contact._site ? 'sites' : 'customer';
        if (contact._site) $scope.setSiteFilter(contact._site.siteId);
        focusElement(contact._key);
      };
      $scope.showItemErrors = function(item) {
        $scope.selectedSiteId = item._site.siteId;
        $scope.errorItemId = item.itemId;
        $scope.errorFilters = { source: '', code: '' };
        $scope.activeTab = 'errors';
        focusElement('detail-tab-errors');
      };
      $scope.promotionGroups = function() {
        return $scope.promotionGroupRows.filter(function(group) {
          return !$scope.selectedSiteId || String(group.site.siteId) === String($scope.selectedSiteId);
        });
      };

      $scope.isFailed = function() {
        return !$scope.completionSucceeded && $scope.quote && /(^|_)FAIL(ED|URE)($|_)/.test(normalizeState($scope.quote.state));
      };

      $scope.openCompleteDialog = function() {
        if (!$scope.isFailed() || !$scope.canUpdateQuotes || $scope.completeSubmitting) return;
        returnFocus = document.activeElement;
        $scope.completeContext = { quoteRequestId: $scope.quote.quoteRequestId, ticketNumber: $scope.quote.supportTicketNumber };
        $scope.completeDialogOpen = true;
        $scope.completeError = null;
        $scope.completeTrackingId = null;
        $scope.completeForm.note = '';
        focusElement('resolution-note');
      };

      $scope.closeCompleteDialog = function() {
        if ($scope.completeSubmitting) return;
        $scope.completeDialogOpen = false;
        $scope.completeError = null;
        $scope.completeForm.note = '';
        focusTimers.push($timeout(function() {
          var target = returnFocus && document.documentElement.contains(returnFocus) ? returnFocus : document.getElementById('quote-detail-heading');
          if (target) target.focus();
        }));
      };
      $scope.completeDialogKeydown = function(event) { trapDialogFocus(event, 'complete-dialog', $scope.closeCompleteDialog); };

      function trapDialogFocus(event, dialogId, close) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        } else if (event.key === 'Tab') {
          var dialog = document.getElementById(dialogId);
          var elements = dialog && dialog.querySelectorAll('button:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
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
      }

      function notify(message) {
        $scope.copyFeedback = message;
        if (copyTimer) $timeout.cancel(copyTimer);
        copyTimer = $timeout(function() { $scope.copyFeedback = ''; }, 3500);
      }

      function stepById(id) {
        if (id === null || id === undefined) return null;
        return $scope.processingSteps.filter(function(step) { return String(step.id) === String(id); })[0] || null;
      }
      $scope.stepForError = function(row) { return row ? stepById(row.stepExecutionId) : null; };
      $scope.isRetryable = function(step) {
        return !!step && normalizeStepStatus(step.stepStatus) === 'FAILURE' && step.id !== null && step.id !== undefined &&
          !$scope.completionSucceeded && !$scope.retryRequested[String(step.id)];
      };
      $scope.canRetry = function(step) {
        return $scope.retryEnabled && !!$scope.canUpdateQuotes && $scope.isRetryable(step) && !$scope.retry.submitting;
      };
      $scope.retryTitle = function(step) {
        if (!$scope.retryEnabled) return 'Coming soon';
        if (step && $scope.retryRequested[String(step.id)]) return 'Retry requested';
        return $scope.isRetryable(step) ? 'Retry this step' : 'Only failed steps can be retried';
      };
      $scope.openRetryDialog = function(step) {
        if (!$scope.canRetry(step) || $scope.retry.open) return;
        returnFocus = document.activeElement;
        $scope.retry = { open: true, step: step, submitting: false, error: null, trackingId: null };
        focusElement('retry-confirm');
      };
      $scope.closeRetryDialog = function() {
        if ($scope.retry.submitting) return;
        $scope.retry = { open: false, step: null, submitting: false, error: null, trackingId: null };
        focusTimers.push($timeout(function() {
          var target = returnFocus && document.documentElement.contains(returnFocus) ? returnFocus : document.getElementById('quote-detail-heading');
          if (target) target.focus();
        }));
      };
      $scope.retryDialogKeydown = function(event) { trapDialogFocus(event, 'retry-dialog', $scope.closeRetryDialog); };
      $scope.submitRetry = function() {
        var step = $scope.retry.step;
        if (!$scope.retry.open || $scope.retry.submitting || !$scope.retryEnabled || !$scope.isRetryable(step)) return;
        $scope.retry.submitting = true;
        $scope.retry.error = null;
        QuoteService.retryStep($scope.quote.quoteRequestId, step.id).then(function() {
          $scope.retryRequested[String(step.id)] = true;
          $scope.retry.submitting = false;
          $scope.closeRetryDialog();
          notify('Retry requested for ' + $scope.stepLabel(step.stepName) + '.');
          $scope.loadQuote();
        }, function(err) {
          $scope.retry.submitting = false;
          $scope.retry.trackingId = extractTrackingId(err);
          var status = err && err.status;
          $scope.retry.error = status === 403 ? 'You are not allowed to retry this step.'
            : status === 404 ? 'This step was not found. Reload the quote and try again.'
            : status === 409 ? 'This step is no longer failed or is already being retried.'
            : status === 501 ? 'Retry is not available yet.'
            : status === 0 ? 'Cannot reach the Quote Management server. Check your connection and try again.'
            : err && err.data && typeof err.data.message === 'string' ? err.data.message
            : 'Unable to retry this step.';
          if (status === 409) $scope.loadQuote();
        });
      };

      $scope.canSubmitComplete = function() {
        var note = ($scope.completeForm.note || '').trim();
        return $scope.completeDialogOpen && $scope.isFailed() && $scope.canUpdateQuotes &&
          note.length >= 1 && note.length <= 1000 && !$scope.completeSubmitting;
      };

      $scope.submitComplete = function() {
        if (!$scope.canSubmitComplete()) return;
        $scope.completeSubmitting = true;
        $scope.completeError = null;

        QuoteService.completeQuote($scope.quote.quoteRequestId, ($scope.completeForm.note || '').trim()).then(function() {
          $scope.completeSubmitting = false;
          $scope.completionSucceeded = true;
          $scope.completionNotice = 'Quote marked Completed.';
          $scope.closeCompleteDialog();
          restoreFocusAfterLoad = true;
          $scope.loadQuote();
        }, function(err) {
          $scope.completeSubmitting = false;
          $scope.completeTrackingId = extractTrackingId(err);
          if (err.status === 403) {
            $scope.completeError = 'You are not allowed to complete this quote.';
          } else if (err.status === 409) {
            $scope.completeError = 'This quote is already completed or not in a failed state.';
            $scope.loadQuote();
          } else {
            var message = err.data && err.data.message ? err.data.message : 'Unable to complete this quote.';
            $scope.completeError = message;
          }
        });
      };

      $scope.copyPayload = function() {
        if (!$scope.payloadFormatted) return;
        $scope.copyValue($scope.payloadFormatted);
      };

      $scope.payloadTextToDisplay = function() {
        if (!$scope.payloadCollapsed || $scope.showFullPayload) {
          return $scope.payloadFormatted;
        }
        return $scope.payloadFormatted.slice(0, 5000) + '\n\n... payload preview truncated ...';
      };

      $scope.showFullPayloadContent = function() {
        $scope.showFullPayload = true;
      };
      $scope.findPayloadMatch = function(next) {
        if (!$scope.payloadSearchCount) return;
        if (next) {
          $scope.payloadMatchNumber = $scope.payloadMatchNumber % $scope.payloadSearchCount + 1;
        }
        var match = $scope.payloadMatches[$scope.payloadMatchNumber - 1];
        $scope.payloadMatchIndex = match.index;
        $scope.showFullPayload = true;
        focusTimers.push($timeout(function() {
          var viewer = document.getElementById('quote-payload');
          if (!viewer || !viewer.firstChild) return;
          viewer.focus();
          var range = document.createRange();
          range.setStart(viewer.firstChild, match.index);
          range.setEnd(viewer.firstChild, match.index + match.length);
          var selection = $window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          var rect = range.getBoundingClientRect();
          var bounds = viewer.getBoundingClientRect();
          viewer.scrollTop += rect.top - bounds.top - viewer.clientHeight / 2;
        }));
      };

      $scope.customerCsv = function() {
        function esc(value) {
          var text = String($scope.displayValue(value));
          // Quoting alone does not stop spreadsheets from evaluating formula cells.
          if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
          return '"' + text.replace(/"/g, '""') + '"';
        }
        var rows = [['Section', 'Field', 'Value']];
        $scope.customerFields.forEach(function(field) { rows.push(['Customer', field[1], $scope.customer[field[0]]]); });
        $scope.addressFields.forEach(function(field) { rows.push(['Address', field[1], $scope.customerAddress[field[0]]]); });
        asArray($scope.customerContacts).forEach(function(contact, index) {
          var section = 'Contact ' + (index + 1);
          $scope.contactFields.forEach(function(field) { rows.push([section, field[1], $scope.contactValue(contact, field[0])]); });
        });
        return rows.map(function(row) { return row.map(esc).join(','); }).join('\r\n');
      };
      function saveBlob(blob, filename) {
        var link = document.createElement('a');
        var objectUrl = $window.URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = filename.replace(/[\\/:*?"<>|]/g, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        $timeout(function() { $window.URL.revokeObjectURL(objectUrl); }, 1000, false);
      }
      $scope.exportCustomerCsv = function() {
        if (!$scope.canExportCustomer()) return;
        saveBlob(new $window.Blob(['\uFEFF' + $scope.customerCsv()], { type: 'text/csv;charset=utf-8;' }),
          (($scope.quote && $scope.quote.quoteRequestId) || 'quote') + '-customer.csv');
      };

      $scope.canExportCustomer = function() {
        if ($scope.customerContacts.length > 0) return true;
        return $scope.customerFields.some(function(field) { return $scope.canCopy($scope.customer[field[0]]); }) ||
          $scope.addressFields.some(function(field) { return $scope.canCopy($scope.customerAddress[field[0]]); });
      };

      $scope.canDownloadContract = function() { return QuoteService.canDownloadContract(); };
      $scope.downloadContract = function(type) {
        $scope.contractDownloadError = null;
        $scope.contractTrackingId = null;
        if (!$scope.canDownloadContract()) {
          $scope.contractDownloadError = 'Contract download is unavailable: no download endpoint is configured.';
          return;
        }
        var dmaasId = type === 'SOA' ? $scope.contract.soa : $scope.contract.msa;
        if (!dmaasId || $scope.contractDownloading) return;
        $scope.contractDownloading = true;
        QuoteService.downloadContractByDmaasId(type, dmaasId).then(function(res) {
          $scope.contractDownloading = false;
          var contentType = (res.headers && res.headers('content-type')) || 'application/octet-stream';
          saveBlob(new $window.Blob([res.data], { type: contentType }), type.toLowerCase() + '-' + dmaasId);
        }, function(err) {
          $scope.contractDownloading = false;
          $scope.contractDownloadError = 'Contract download is not available for this record.';
          $scope.contractTrackingId = extractTrackingId(err);
        });
      };

      $scope.loadQuote = function() {
        var generation = ++requestGeneration;
        $scope.loading = true;
        $scope.error = null;
        $scope.trackingId = null;
        $scope.contractDownloadError = null;
        $scope.quote = null;
        $scope.customer = {};
        $scope.customerAddress = {};
        $scope.customerContacts = [];
        $scope.sites = [];
        $scope.promotions = [];
        $scope.promotionGroupRows = [];
        $scope.processingSteps = [];
        $scope.errorRows = [];
        $scope.events = [];
        $scope.idRows = [];
        $scope.monitoring = null;
        $scope.failureSummary = null;
        $scope.contract = { soa: null, msa: null };
        $scope.payloadFormatted = '';
        $scope.journey = QuoteJourney.build([]);
        siteLookup = Object.create(null);
        itemLookup = Object.create(null);
        contactLookup = Object.create(null);
        return QuoteService.getQuote($routeParams.id).then(function(res) {
          if (generation !== requestGeneration) return;
          if (!res.data || !angular.isObject(res.data) || angular.isArray(res.data) || getField(res.data, ['quoteRequestId']) === null) {
            $scope.loading = false;
            $scope.error = 'Unable to load quote details: the API returned an unrecognized response.';
            $scope.trackingId = extractTrackingId(res);
            return;
          }
          hydrateQuote(res.data);
          if ($scope.completionSucceeded) $scope.quote.state = 'COMPLETED';
          $scope.loading = false;
          if (restoreFocusAfterLoad) {
            restoreFocusAfterLoad = false;
            focusElement('quote-detail-heading');
          }
        }, function(err) {
          if (generation !== requestGeneration) return;
          $scope.loading = false;
          $scope.trackingId = extractTrackingId(err);
          if (err.status === 403) {
            $scope.error = 'Access denied';
          } else if (err.status === 404) {
            $scope.error = 'Quote not found';
          } else if (err.status === 410) {
            $scope.error = 'Quote archived';
          } else if (err.data && typeof err.data.code === 'string' && typeof err.data.message === 'string') {
            $scope.error = 'Unable to load quote details. ' + err.data.message;
          } else {
            $scope.error = 'Unable to load quote details.';
          }
          if (restoreFocusAfterLoad) {
            restoreFocusAfterLoad = false;
            focusElement('quote-load-error');
          }
        });
      };

      $scope.$on('$destroy', function() {
        requestGeneration++;
        focusTimers.forEach(function(timer) { $timeout.cancel(timer); });
        if (copyTimer) $timeout.cancel(copyTimer);
        if (copiedTimer) $timeout.cancel(copiedTimer);
      });
      $scope.loadQuote();
    }
  ]);
