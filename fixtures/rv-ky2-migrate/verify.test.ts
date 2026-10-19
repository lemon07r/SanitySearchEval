import {test, expect} from 'bun:test';
import {queueClient} from '../src/client';

test('GET and empty DELETE preserve URL, auth and response telemetry', async () => {
  const requests: Request[] = []; const statuses: number[] = [];
  const client = queueClient({root:'https://queue.invalid/admin/',token:'queue-token',
    onStatus:status=>statuses.push(status),
    fetch:(async (request: Request) => {
      requests.push(request);
      return request.method === 'DELETE' ? new Response(null,{status:204}) : Response.json({id:'a/b',paused:false});
    }) as typeof fetch});
  expect(await client.getQueue('a/b')).toEqual({id:'a/b',paused:false});
  expect(await client.deleteQueue('a/b')).toBeUndefined();
  expect(requests.map(request=>request.url)).toEqual([
    'https://queue.invalid/admin/queues/a%2Fb','https://queue.invalid/admin/queues/a%2Fb',
  ]);
  expect(requests.map(request=>request.method)).toEqual(['GET','DELETE']);
  expect(requests.map(request=>request.headers.get('authorization'))).toEqual(['Bearer queue-token','Bearer queue-token']);
  expect(statuses).toEqual([200,204]);
});
