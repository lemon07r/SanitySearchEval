# Queue control client

queueClient accepts an API root URL including its path, a bearer token and an
injectable fetch. getQueue returns the queue JSON; deleteQueue resolves with no
value after a successful response. IDs are single encoded path segments. The
optional onStatus callback receives every response's status. HTTP failures reject.
Retries are disabled because this client is used for interactive admin actions.
