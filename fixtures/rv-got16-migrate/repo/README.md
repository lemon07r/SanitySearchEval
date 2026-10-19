# Snapshot monitor

readSnapshot receives an absolute URL to a JSON snapshot endpoint. It returns the
HTTP status, optional request-id and typed payload. The monitor deliberately avoids
sharing sessions between polls. Non-success HTTP statuses reject; callers handle
those failures. Node 22.12+ / Bun.
