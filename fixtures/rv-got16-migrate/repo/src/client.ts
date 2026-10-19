import got from 'got';
import type {Snapshot, SnapshotResult} from './types';

export async function readSnapshot(url: string): Promise<SnapshotResult> {
  const response = await got<Snapshot>(url, {
    http2: true,
    agent: {http2: false},
    responseType: 'json',
    retry: {limit: 1},
    timeout: {request: 2500},
  });
  return {
    status: response.statusCode,
    requestId: response.headers['x-request-id'] as string | undefined,
    payload: response.body,
  };
}
