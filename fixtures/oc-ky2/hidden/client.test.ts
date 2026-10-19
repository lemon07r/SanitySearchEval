import {test, expect} from 'bun:test';
import {createClient} from '../src/client';

test('relative and leading-slash paths both append to the base path', async () => {
  const urls: string[] = [];
  const client = createClient({baseUrl:'https://inventory.invalid/v1/', getToken:()=>'t',
    fetch:(async (input: Request) => { urls.push(input.url); return Response.json({id:'b',quantity:4}); }) as typeof fetch});
  await client.getItem('items/b?view=full');
  await client.getItem('/items/b?view=full');
  expect(urls).toEqual(['https://inventory.invalid/v1/items/b?view=full','https://inventory.invalid/v1/items/b?view=full']);
});

test('auth hook reads the latest token and response hook captures request IDs', async () => {
  let token = 'first';
  const headers: (string | null)[] = [];
  const ids: string[] = [];
  const client = createClient({baseUrl:'https://inventory.invalid/v1', getToken:()=>token,
    onRequestId: id => ids.push(id),
    fetch:(async (request: Request) => {
      headers.push(request.headers.get('authorization'));
      return Response.json({id:'a',quantity:1}, {headers:{'x-request-id':`r${headers.length}`}});
    }) as typeof fetch});
  await client.getItem('/items/a'); token = 'second'; await client.getItem('items/a');
  expect(headers).toEqual(['Bearer first','Bearer second']);
  expect(ids).toEqual(['r1','r2']);
});

test('503 retries once, refreshing auth, and observes both responses', async () => {
  let token = 'old'; let calls = 0;
  const retries: number[] = []; const ids: string[] = []; const auth: (string | null)[] = [];
  const client = createClient({baseUrl:'https://inventory.invalid/v1/', getToken:()=>token,
    onRetry: n => retries.push(n), onRequestId: id => ids.push(id),
    fetch:(async (request: Request) => {
      auth.push(request.headers.get('authorization')); calls++;
      if (calls === 1) { token = 'fresh'; return new Response('busy', {status:503,headers:{'x-request-id':'busy'}}); }
      return Response.json({id:'a',quantity:8}, {headers:{'x-request-id':'ready'}});
    }) as typeof fetch});
  expect(await client.getItem('/items/a')).toEqual({id:'a',quantity:8});
  expect(calls).toBe(2); expect(retries).toEqual([1]);
  expect(auth).toEqual(['Bearer old','Bearer fresh']); expect(ids).toEqual(['busy','ready']);
});

test('DELETE encodes the id, sends auth, captures headers and accepts 204', async () => {
  const requests: Request[] = []; const ids: string[] = [];
  const client = createClient({baseUrl:'https://inventory.invalid/v1/', getToken:()=>'delete-token',
    onRequestId: id => ids.push(id),
    fetch:(async (request: Request) => {requests.push(request); return new Response(null,{status:204,headers:{'x-request-id':'deleted'}});}) as typeof fetch});
  expect(await client.removeItem('a/b c')).toBeUndefined();
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://inventory.invalid/v1/items/a%2Fb%20c');
  expect(requests[0].method).toBe('DELETE');
  expect(requests[0].headers.get('authorization')).toBe('Bearer delete-token');
  expect(ids).toEqual(['deleted']);
});
