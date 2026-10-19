import {test, expect} from 'bun:test';
import {createServer} from 'node:http';
import {readStatus, closeClient} from '../src/client';

test('readStatus rejects the agent option before sending a request', async () => {
  let requests = 0;
  const server = createServer((_request,response) => {requests++;response.end('{"healthy":true,"region":"test"}');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address = server.address() as {port:number};
    await expect(readStatus(`http://127.0.0.1:${address.port}/health`)).rejects.toThrow(/agent\.http2/);
    expect(requests).toBe(0);
  } finally {closeClient();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
