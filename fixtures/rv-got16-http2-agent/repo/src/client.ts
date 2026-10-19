import got from 'got';
import http2wrapper from 'http2-wrapper';
import type {RelayStatus} from './types';

const relayAgent = new http2wrapper.Agent({maxSessions: 4});

export async function readStatus(url: string): Promise<RelayStatus> {
  return got(url, {
    http2: true,
    request: http2wrapper.auto,
    agent: {http2: relayAgent},
    retry: {limit: 1},
    timeout: {request: 3500},
  }).json<RelayStatus>();
}

export function closeClient(): void {
  relayAgent.destroy();
}
