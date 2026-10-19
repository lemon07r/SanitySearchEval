import {test, expect} from 'bun:test';
import {createClient} from '../src/client';

test('reads an inventory item', async () => {
  const client = createClient({baseUrl:'https://inventory.invalid/v1/', getToken:()=>'token',
    fetch: (async () => Response.json({id:'a', quantity:3})) as typeof fetch});
  expect(await client.getItem('items/a')).toEqual({id:'a', quantity:3});
});

test('removes an inventory item', async () => {
  const client = createClient({baseUrl:'https://inventory.invalid/v1/', getToken:()=>'token',
    fetch: (async () => new Response(null, {status:204})) as typeof fetch});
  expect(await client.removeItem('a')).toBeUndefined();
});
