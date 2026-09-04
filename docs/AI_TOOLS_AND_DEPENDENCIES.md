# AI Tools and Dependencies

Last reviewed: September 4, 2026

## Purpose

The Seasonal Harvest AI assistant answers authenticated questions about products,
brands, categories, stock levels, product movement, and reorder recommendations using
live backend queries. It uses Claude with read-only tools. The model never connects directly to
Supabase and never receives database credentials.

## Installed project dependency

| Package | Type | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | Runtime npm dependency | Official Anthropic SDK used to call Claude and process tool-use blocks |

Existing dependencies reused by the AI endpoint:

| Package | Purpose in the AI feature |
|---|---|
| `express` | Hosts `POST /api/v1/assistant/chat` |
| `@supabase/supabase-js` | Reads live product and inventory data through existing repositories |
| `@arcjet/node` | Applies the existing global API protection and rate limiting |
| `dotenv` | Loads the server-side Anthropic key and Claude model name |

No vector database, embeddings package, agent framework, or conversation database is
installed yet. Live structured product and stock questions do not need them. Add those
only if requirements expand to document search or persistent chat history.

## AI module structure

```text
ai/
|-- prompts/
|   `-- assistant.prompt.js       # Safety and response instructions
`-- tools/
    `-- assistant-tools.js        # Read-only tool schemas and handlers
config/
`-- anthropic.js                  # Lazy, server-side Anthropic client
controller/
`-- assistant.controller.js       # HTTP validation and response handling
routes/
`-- assistant.routes.js           # Authenticated admin-only chat route
services/
`-- assistant.service.js          # Claude tool-use loop
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes for AI requests | Secret server-side API key. Never prefix it with `VITE_`, return it from an endpoint, or commit it. |
| `ANTHROPIC_MODEL` | No | Model override. Defaults to `claude-sonnet-4-6` in the service. |
| `AI_RATE_LIMIT_MAX` | No | Maximum AI requests per authenticated user in one window. Defaults to 10. |
| `AI_RATE_LIMIT_WINDOW_MS` | No | AI rate-limit window in milliseconds. Defaults to 60,000. |

Set these values in `.env.development.local` and in the production host's secret
settings. `.env.example` contains placeholders only.

## Endpoint

```http
POST /api/v1/assistant/chat
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "message": "Which products are low in stock?"
}
```

The first release permits only active `admin` and `super_admin` profiles because stock
levels are operational data. Requests also pass through the globally mounted Arcjet
middleware. Messages are limited to 2,000 characters, model output is limited, tool
rounds are capped, and tools are read-only. A dedicated per-user limiter additionally
protects the endpoint. It is process-local, so a shared limiter must replace it if the
backend is deployed with multiple instances.

Every accepted AI request emits structured JSON audit events for start, success, and
failure. Audit records include actor ID, role, message length, duration, response ID,
and safe error code. Prompts, answers, credentials, and access tokens are not logged.

## Available AI tools

| Tool | Data returned |
|---|---|
| `search_products` | Up to 50 active catalog products, optionally filtered by name |
| `get_product` | One catalog product by UUID |
| `search_brands` | Up to 50 active brands, optionally filtered by name |
| `search_categories` | Up to 50 categories, optionally filtered by name |
| `get_inventory_summary` | Total value, item count, quantity, average price, and low-stock count |
| `get_low_stock_items` | Up to 50 items at or below their low-stock threshold |
| `analyze_inventory_movement` | Fast-, slow-, and non-moving rankings; low/high stock; and reorder suggestions with calculation inputs |

Movement analysis defaults to the last 30 days, 7 lead-time days, and 3 safety-stock
days. It treats `SUBTRACT` ledger movements as outbound demand. Recommendations use:

```text
max(0, ceil(average_daily_outbound * (lead_time_days + safety_stock_days)) - available_quantity)
```

Because damaged, expired, missing, and manual stock reductions can also be `SUBTRACT`
movements, staff must review unusual adjustments before placing an order.

## Before live use

1. Revoke any Anthropic key exposed in chat or source control, create a replacement, and store it only in backend secret settings.
2. Confirm the configured Claude model is enabled for the Anthropic workspace.
3. Apply and verify the existing Supabase migrations and RLS policies.
4. Add persistent usage budgets and live Claude/Supabase integration tests. Dedicated
   per-user rate limiting, metadata-only audit events, and unit tests are implemented.
5. Review what inventory fields are safe to expose to each application role.
6. Test tool answers against a non-production Supabase project.

## Planned additions

- Sales and revenue tools after orders are implemented
- Persistent conversations only after retention and deletion rules are approved
- Streaming responses if the frontend needs progressive rendering

Official references:

- [Anthropic TypeScript SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)
- [Claude tool use](https://platform.claude.com/docs/en/build-with-claude/tool-use/overview)
