# Inventory client

`createClient` binds an API base URL (including its `/v1/` path), credentials and an
injectable fetch implementation. getItem accepts paths with or without a leading
slash; both append to the API base path. Every request uses the current bearer
token. Each response updates request-id telemetry when that header is present.
Transient 503s retry once and call onRetry with the attempt number. removeItem
resolves with undefined for a successful DELETE (the service returns 204).

Ky has been upgraded; restore this behavior in `src/`. Do not change dependencies
or tests. `bun test tests` uses an injected fetch, not the live inventory service.
