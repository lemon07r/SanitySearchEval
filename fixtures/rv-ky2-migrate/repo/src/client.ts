import ky from 'ky';
import type {Queue} from './types';

export function queueClient(config: {
  root: string;
  token: string;
  fetch: typeof globalThis.fetch;
  onStatus?: (status: number) => void;
}) {
  const api = ky.create({
    prefix: config.root,
    fetch: config.fetch,
    retry: 0,
    hooks: {
      beforeRequest: [({request}) => {
        request.headers.set('authorization', `Bearer ${config.token}`);
      }],
      afterResponse: [({response}) => {
        config.onStatus?.(response.status);
      }],
    },
  });
  return {
    getQueue: (id: string) => api.get(`queues/${encodeURIComponent(id)}`).json<Queue>(),
    deleteQueue: async (id: string): Promise<void> => {
      await api.delete(`queues/${encodeURIComponent(id)}`);
    },
  };
}
