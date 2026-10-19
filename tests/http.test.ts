import { test, expect } from "bun:test";
import { requestJSON, Semaphore, StartSpacing } from "../src/http";
import { createAdapter } from "../src/providers";
import { PROFILES, PROVIDER_LIMITS } from "../src/config";
process.env.TAVILY_API_KEY ||= "test-only-key";
for (const [status, cls] of [[429,"http_429"],[503,"http_5xx"],[404,"http_4xx"]] as const) test(`HTTP ${status} mapping and retry count`,async()=>{
  let calls=0; const waits:number[]=[]; const result=await requestJSON({url:"https://example.com",fetcher:(async()=>{calls++;return new Response("{}",{status,headers:{"retry-after":"30"}});}) as unknown as typeof fetch,sleep:async n=>{waits.push(n);}});
  expect(result.error?.class).toBe(cls); expect(calls).toBe(status===404?1:2); expect(waits).toEqual(status===404?[]:[10000]);
});
test("timeout, network and parse failure mapping",async()=>{
  for(const name of ["TimeoutError","TypeError"]) { const r=await requestJSON({url:"https://example.com",fetcher:(async()=>{throw new DOMException("failure",name);}) as unknown as typeof fetch,sleep:async()=>{}}); expect(r.error?.class).toBe(name==="TimeoutError"?"timeout":"network"); expect(r.attempts).toHaveLength(2); }
  const r=await requestJSON({url:"https://example.com",fetcher:(async()=>new Response("not JSON")) as unknown as typeof fetch,sleep:async()=>{}}); expect(r.error?.class).toBe("parse"); expect(r.attempts).toHaveLength(1);
});
test("cache, request identity, stripped headers and GET parameters",async()=>{
  const r=await requestJSON({url:"https://example.com",method:"GET",params:{q:"a b"},headers:{"x-api-key":"private"},fetcher:(async(input,init)=>{expect(String(input)).toContain("q=a+b");expect(init?.body).toBeUndefined();return new Response(JSON.stringify({request_id:"request-1"}),{headers:{age:"5","cf-cache-status":"HIT"}});}) as typeof fetch});
  expect(r.attempts[0].request_id).toBe("request-1"); expect(r.attempts[0].cache.age).toBe("5"); expect(JSON.stringify(r.request)).not.toContain("private");
});
test("empty and invalid successful responses are classified",async()=>{
  const profile=PROFILES.find(p=>p.id==="tavily:advanced")!;
  const empty=await createAdapter(profile,(async()=>new Response('{"results":[]}')) as unknown as typeof fetch).search("query"); expect(empty.error?.class).toBe("empty");
  const bad=await createAdapter(profile,(async()=>new Response('{}')) as unknown as typeof fetch).search("query"); expect(bad.error?.class).toBe("parse");
});
test("semaphore caps concurrency",async()=>{ const gate=new Semaphore(2);let active=0,max=0;await Promise.all(Array.from({length:8},()=>gate.run(async()=>{active++;max=Math.max(max,active);await Bun.sleep(2);active--;}))); expect(max).toBe(2); });
test("Brave has one slot and 1100 ms serialized request-start spacing",async()=>{
  expect(PROVIDER_LIMITS.brave).toEqual({concurrency:1,min_interval_ms:1100});
  let clock=0; const sleeps:number[]=[]; const spacing=new StartSpacing(1100,()=>clock,async ms=>{sleeps.push(ms);clock+=ms;});
  await Promise.all([spacing.wait(),spacing.wait(),spacing.wait()]); expect(sleeps).toEqual([1100,1100]); expect(clock).toBe(2200);
});
