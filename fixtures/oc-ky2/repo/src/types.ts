export interface ClientConfig {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  getToken: () => string;
  onRequestId?: (id: string) => void;
  onRetry?: (attempt: number) => void;
}

export interface Item { id: string; quantity: number }
