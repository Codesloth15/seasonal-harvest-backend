# AI Tools and Dependencies

Last reviewed: August 14, 2026

## Purpose

The Seasonal Harvest AI assistant answers authenticated questions about products,
brands, categories, inventory totals, and low-stock items using live backend queries. It uses the OpenAI
Responses API with read-only function tools. The model never connects directly to
Supabase and never receives database credentials.

## Installed project dependency

| Package | Type | Purpose |
|---|---|---|
| `openai` | Runtime npm dependency | Official JavaScript SDK used by the backend to call the OpenAI Responses API and process function calls |

Existing dependencies reused by the AI endpoint:

| Package | Purpose in the AI feature |
|---|---|
| `express` | Hosts `POST /api/v1/assistant/chat` |
| `@supabase/supabase-js` | Reads live product and inventory data through existing repositories |
| `@arcjet/node` | Applies the existing global API protection and rate limiting |
| `dotenv` | Loads the server-side OpenAI key and model name |

No vector database, embeddings package, agent framework, or conversation database is
installed yet. Live structured product and stock questions do not need them. Add those
only if requirements expand to document search or persistent chat history.

## Development tool installed

| Tool | Scope | Purpose |
|---|---|---|
| `openaiDeveloperDocs` MCP server | Global Codex development environment | Provides current official OpenAI API documentation while developing the integration; it is not deployed with the backend |

Restart Codex before expecting the newly installed documentation server to appear in a
new development session.

## AI module structure

```text
ai/
|-- prompts/
|   `-- assistant.prompt.js       # Safety and response instructions
`-- tools/
    `-- assistant-tools.js        # Read-only tool schemas and handlers
config/
`-- openai.js                     # Lazy, server-side OpenAI client
controller/
`-- assistant.controller.js       # HTTP validation and response handling
routes/
`-- assistant.routes.js           # Authenticated admin-only chat route
services/
`-- assistant.service.js          # Responses API and tool-call loop
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes for AI requests | Secret server-side API key. Never prefix it with `VITE_`, return it from an endpoint, or commit it. |
| `OPENAI_MODEL` | No | Model override. Defaults to `gpt-5.6-sol` in the service. |
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

## Before live use

1. Create an OpenAI project API key and store it only in backend secret settings.
2. Confirm the configured model is enabled for the OpenAI project.
3. Apply and verify the existing Supabase migrations and RLS policies.
4. Add persistent usage budgets and live OpenAI/Supabase integration tests. Dedicated
   per-user rate limiting, metadata-only audit events, and unit tests are implemented.
5. Review what inventory fields are safe to expose to each application role.
6. Test tool answers against a non-production Supabase project.

## Planned additions

- Expose approved catalog totals and stock-movement trends to the assistant by
  wrapping the role-protected dashboard analytics service in read-only AI tools
- Sales and revenue tools after orders are implemented
- Persistent conversations only after retention and deletion rules are approved
- Streaming responses if the frontend needs progressive rendering

Official references:

- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text-generation)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
