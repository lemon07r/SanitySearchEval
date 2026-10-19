# Relay status service

The worker calls readStatus with the relay's absolute health URL. The relay returns
JSON with a healthy boolean and a region string. Requests have bounded retries and
timeouts. closeClient is called during shutdown. Run on Node 22.12+ or Bun.
