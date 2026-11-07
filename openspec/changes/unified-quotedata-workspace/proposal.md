## Why

The current UI layers several conflicting themes over a partially implemented QuoteData workflow. A fresh comparison with the Indirect Quote UI requirements exposed broken local asset serving, incomplete authenticated deep links, and usability gaps that cannot be solved by another color override.

## What Changes

- Replace the stacked visual variants with one responsive, accessible design system: blue brand accents, white/charcoal surfaces, semantic status colors, and persistent light/dark/system themes.
- Provide one common SSO experience without role-specific menus; preserve intended quote links across sign-in, and never turn authentication failures into authenticated access.
- Improve quote search and ticket lookup using a shared paginated results component, URL state, race-safe requests, clear filters and distinct loading/error/empty states.
- Reconcile all detail tabs with UI-03 through UI-17, including the documented nested site/item response, contextual navigation, processing diagnostics, safe payload viewing, complete confirmation and customer CSV export.
- Keep retry visibly disabled for this release. Treat contract download as optional configuration, not a confirmed backend capability.
- Repair the existing frontend build/start/test setup and document unresolved remote API and SSO deployment prerequisites.

## Capabilities

### New Capabilities
- `unified-quotedata-workspace`: Requirement-aligned common SSO workspace, consistent themes and accessible operational workflows backed by QuoteData.

### Modified Capabilities
None. The repository has an older unarchived mock-oriented change but no published base specs. This change records the current QuoteData requirements without rewriting that historical work.

## Impact

Changes are limited to the AngularJS frontend, frontend tooling, directly related documentation, and these OpenSpec artifacts. The Spring Boot mock backend is not the remote QuoteData service and will not be expanded to imitate it. Existing AngularJS, Bootstrap, Gulp and Karma/Jasmine tooling will be reused. No sample customer data or credentials from the Word document will be committed.
