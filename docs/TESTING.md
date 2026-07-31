# Testing Guide

## Overview

The backend uses Vitest for unit testing and `@vitest/coverage-v8` for code coverage. Tests run in Node and mock Supabase/network boundaries, so they do not create accounts, send recovery emails, revoke real sessions, or require production secrets.

## Commands

Run the full unit suite once:

```bash
npm test
```

Run tests continuously during development:

```bash
npm run test:watch
```

Run tests with enforced coverage thresholds:

```bash
npm run test:coverage
```

The HTML report is generated under `coverage/` and is excluded from Git.

## Current coverage scope

| Test file | Coverage |
|---|---|
| `tests/config/cors.test.js` | Origin parsing, normalization, deduplication, and rejection behavior |
| `tests/controller/auth.controller.test.js` | Sign-up, sign-in, recovery, reset, current user, logout, validation, and safe error mapping |
| `tests/controller/category.controller.test.js` | Category list, lookup, create, update, delete, and not-found behavior |
| `tests/middleware/auth.middleware.test.js` | Missing, invalid, expired, and valid bearer-token behavior |
| `tests/middleware/role.middleware.test.js` | Missing profile, inactive account, denied role, and allowed role behavior |
| `tests/model/category.model.test.js` | Category filtering, normalization, safe fields, validation, and authenticated writes |
| `tests/migrations/catalog-migrations.test.js` | Brand/product constraints, relationships, RLS, policies, and least-privilege grants |
| `tests/services/auth.service.test.js` | Supabase Auth calls, authenticated REST requests, errors, password update, and logout |
| `tests/services/category.service.test.js` | Category use cases and typed not-found behavior |
| `tests/services/inventory.service.test.js` | Inventory validation, authenticated writes, updates, and stock adjustment |

The suite contains 76 passing tests. Coverage is enforced for the security-sensitive and refactored modules, including Arcjet request decisions.

| Metric | Coverage | Required threshold |
|---|---:|---:|
| Statements | 88.06% | 80% |
| Branches | 79.31% | 75% |
| Functions | 92.45% | 80% |
| Lines | 91.28% | 80% |

Coverage thresholds are defined in `vitest.config.js`. A coverage command fails when a threshold is not met.

## Test environment

`tests/setup.js` supplies non-secret placeholder configuration for tests. Do not import real development or production credentials into unit tests.

Tests must remain:

- Deterministic and independent of execution order.
- Isolated from real Supabase projects and external services.
- Free of real tokens, email addresses, keys, and passwords.
- Explicit about authentication and authorization failure cases.
- Focused on observable behavior instead of private implementation details.

## Security testing requirements

Every authentication or authorization change should test:

- Missing credentials.
- Malformed credentials.
- Invalid or expired credentials.
- Valid credentials.
- Input normalization and rejection.
- Generic errors that do not reveal whether an account exists.
- Prevention of password and token leakage in responses.
- Enforcement of the required user role or resource ownership.

Every request-origin change should test trusted, untrusted, malformed, wildcard, and origin-less requests.

## Next testing work

Unit coverage is only the first layer. The project still needs:

- API integration tests using an isolated Supabase test project or local Supabase stack.
- RLS tests for anonymous users, employees, admins, super admins, owners, and non-owners.
- Inventory, product, brand, role, and error-middleware unit tests.
- Concurrency tests for stock adjustment and SKU creation.
- Frontend/backend end-to-end tests for registration, login, email confirmation, and password recovery.
- CI enforcement for linting, unit tests, coverage, migration validation, dependency audit, and secret scanning.
