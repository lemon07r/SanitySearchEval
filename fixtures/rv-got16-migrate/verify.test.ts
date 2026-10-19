import {test, expect} from 'bun:test';
import {createServer} from 'node:http';
import {readSnapshot} from '../src/client';

test('native transport returns status, headers and JSON on local HTTP', async () => {
  const paths: string[] = [];
  const server = createServer((request,response) => {
    paths.push(request.url!);
    response.writeHead(request.url === '/missing' ? 418 : 201, {'content-type':'application/json','x-request-id':'local-42'});
    response.end(JSON.stringify({service:'queue',pending:3}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const {port} = server.address() as {port:number};
    expect(await readSnapshot(`http://127.0.0.1:${port}/snapshot`)).toEqual({
      status:201,requestId:'local-42',payload:{service:'queue',pending:3},
    });
    await expect(readSnapshot(`http://127.0.0.1:${port}/missing`)).rejects.toMatchObject({response:{statusCode:418}});
    expect(paths).toEqual(['/snapshot','/missing']);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
