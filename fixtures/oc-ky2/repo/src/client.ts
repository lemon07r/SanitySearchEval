import ky from 'ky';
import type {ClientConfig, Item} from './types';

export function createClient(config: ClientConfig) {
  const api = ky.create({
    prefixUrl: config.baseUrl,
    fetch: config.fetch,
    retry: {limit: 1, statusCodes: [503], delay: () => 0},
    hooks: {
      beforeRequest: [(request, options) => {
        request.headers.set('authorization', `Bearer ${config.getToken()}`);
      }],
      afterResponse: [(request, options, response) => {
        const id = response.headers.get('x-request-id');
        if (id) config.onRequestId?.(id);
      }],
      beforeRetry: [({request, retryCount}) => {
        request.headers.set('authorization', `Bearer ${config.getToken()}`);
        config.onRetry?.(retryCount);
      }],
    },
  });
  return {
    getItem: (path: string) => api.get(path).json<Item>(),
    removeItem: async (id: string): Promise<void> => {
      await api.delete(`items/${encodeURIComponent(id)}`).json();
    },
  };
}
