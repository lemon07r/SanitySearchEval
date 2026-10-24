import { test, expect } from "bun:test";
import samples from "./fixtures/providers.json";
import { normalizeBrave } from "../src/providers/brave";
import { normalizeExa, readExa } from "../src/providers/exa";
import { normalizeParallel, readParallel } from "../src/providers/parallel";
import { normalizeFirecrawl, normalizeFirecrawlDeveloper, readFirecrawl } from "../src/providers/firecrawl";
import { normalizeTavily, readTavily } from "../src/providers/tavily";
import { createAdapter, providerCost } from "../src/providers";
import { PROFILES, template } from "../src/config";
import { estimateUnit } from "../src/budget";
import { ToolSession } from "../src/tools";
const url = "https://example.com/docs";
process.env.FIRECRAWL_API_KEY ||= "test-only-key";
process.env.EXA_API_KEY ||= "test-only-key";
process.env.BRAVE_API_KEY ||= "test-only-key";
test("fifteen unique profiles retain exact frozen native parameters", () => {
  expect(PROFILES).toHaveLength(17); expect(new Set(PROFILES.map(p=>p.id)).size).toBe(17);
  expect(PROFILES.find(p=>p.id==="parallel:fast")!.read.params.advanced_settings.full_content).toEqual({max_chars_per_result:60000});
  expect(PROFILES.find(p=>p.id==="firecrawl:search")!.read.params.maxAge).toBeUndefined();
  expect(PROFILES.find(p=>p.id==="tavily:basic")!.search.params.auto_parameters).toBe(false);
  const oldIds = ["brave:llm-context", "brave:web", "exa:auto", "exa:deep-lite", "parallel:fast", "parallel:advanced", "firecrawl:search", "firecrawl:search-md", "tavily:advanced", "tavily:basic"];
  for (const id of oldIds) { const profile=PROFILES.find(p=>p.id===id)!; expect(profile).toBeDefined(); expect(profile).not.toHaveProperty("posthoc"); expect(profile).not.toHaveProperty("headers"); }
  expect(PROFILES.filter(p=>p.posthoc).map(p=>p.id)).toEqual(["firecrawl:developer", "exa:auto-objective", "exa:auto-dynamic", "exa:lite", "exa:auto-uncached", "exa:auto-objective-uncached", "brave:web-nospell"]);
  expect(PROFILES.filter(p=>p.posthoc).every(p=>p.baseline===false)).toBe(true);
});
test("post-hoc profiles extend existing parameters without changing reads", () => {
  const profile = (id: string) => PROFILES.find(p=>p.id===id)!;
  const developer=profile("firecrawl:developer");
  expect(developer.search).toEqual({url:"https://api.firecrawl.dev/v2/search/developer",method:"POST",params:{query:"$query",k:5,passages:5,types:["doc","issue","pull_request","readme"]}});
  expect(developer.read).toEqual(profile("firecrawl:search").read);
  for (const mode of ["auto-objective", "auto-dynamic", "lite"]) {
    const exa=profile(`exa:${mode}`), auto=profile("exa:auto");
    expect(exa.search).toEqual({...auto.search,params:{...auto.search.params,type:mode==="lite"?"lite":"auto",objective:"$purpose",...(mode==="auto-dynamic"?{contents:{highlights:{dynamic:true}}}:{})}});
    expect(exa.read).toEqual(auto.read);
  }
  const brave=profile("brave:web");
  expect(profile("brave:web-nospell").search).toEqual({...brave.search,params:{...brave.search.params,spellcheck:false}});
  expect(profile("brave:web-nospell").read).toEqual(brave.read);
});
for (const [name, normalize, sample] of [["brave",normalizeBrave,samples.brave],["brave:web",(d:any)=>normalizeBrave(d,"web"),samples.braveWeb],["exa",normalizeExa,samples.exa],["parallel",normalizeParallel,samples.parallel],["firecrawl",normalizeFirecrawl,samples.firecrawl],["tavily",normalizeTavily,samples.tavily]] as const) {
  test(`${name} normalization from recorded shape`,()=>{ const result=normalize(sample)[0]; expect(result.url).toBe(url); expect(result.snippet_or_excerpt).toContain("library.validate()"); expect(result.published_at).toBe(name==="firecrawl"?null:"2026-10-01"); });
}
test("dates are never guessed",()=>{ expect(normalizeBrave({web:{results:[{url,age:"today"}]}},"web")[0].published_at).toBeNull(); expect(normalizeExa({results:[{url}]} )[0].published_at).toBeNull(); });
test("Brave web zero results omit the web block, but malformed results still fail",()=>{
  for (const mode of ["web", "web-nospell"]) {
    expect(normalizeBrave({type:"search",query:{original:"no matches"}},mode)).toEqual([]);
    expect(normalizeBrave({web:{}},mode)).toEqual([]);
    expect(normalizeBrave(samples.braveWeb,mode)).toEqual(normalizeBrave(samples.braveWeb,"web"));
    for (const results of [null,undefined,{},"invalid"]) expect(()=>normalizeBrave({web:{results}},mode)).toThrow(SyntaxError);
    for (const data of [null,undefined,[],"invalid",42]) expect(()=>normalizeBrave(data,mode)).toThrow(SyntaxError);
  }
});
test("Firecrawl developer preserves order, passages and only source metadata",()=>{
  const rows=normalizeFirecrawlDeveloper({success:true,partial:true,coverage:{private:true},reranked:true,results:[
    {id:"first",type:"doc",url,title:"  Library docs  ",passages:[{text:"First passage"},{text:"Second passage"}],metadata:{publishedDate:"2026-10-01"}},
    {id:"second",type:"issue",url:`${url}/issue`,title:"  ",passages:[]},
    {id:"third",type:"readme",url:`${url}/readme`,passages:[{text:"Readme"}]},
    {id:"invalid",type:"doc",url:123,passages:[]}
  ]});
  expect(rows).toEqual([
    {title:"Library docs",url,published_at:null,snippet_or_excerpt:"First passage\n\nSecond passage",source:"firecrawl-developer",metadata:{id:"first",type:"doc"}},
    {title:`${url}/issue`,url:`${url}/issue`,published_at:null,snippet_or_excerpt:"",source:"firecrawl-developer",metadata:{id:"second",type:"issue"}},
    {title:`${url}/readme`,url:`${url}/readme`,published_at:null,snippet_or_excerpt:"Readme",source:"firecrawl-developer",metadata:{id:"third",type:"readme"}}
  ]);
  expect(normalizeFirecrawlDeveloper({success:true,results:[]})).toEqual([]);
  for (const data of [{success:false,results:[]},{success:true},{results:{}},null]) expect(()=>normalizeFirecrawlDeveloper(data)).toThrow(SyntaxError);
});
test("Firecrawl developer derives missing types from ID prefixes",()=>{
  const kinds=["doc","issue","pull_request","readme"];
  const rows=normalizeFirecrawlDeveloper({success:true,partial:true,results:[
    ...kinds.map(kind=>({id:`${kind}:123`,url,passages:[{text:"Source passage"}]})),
    {id:"doc:override",type:"issue",url,passages:[]},
    {id:"readme:null-type",type:null,url,passages:[]},
    {id:123,url,passages:[]},
    {url,passages:[]}
  ]});
  expect(rows.map(row=>row.metadata.type)).toEqual([...kinds,"issue","readme",null,null]);
  for (const row of rows) { expect(row).not.toHaveProperty("partial"); expect(row.metadata).not.toHaveProperty("partial"); }
});
test("native read failures remain failures",()=>{
  expect(readExa({results:[],statuses:[{id:url,status:"error"}]},url).error?.class).toBe("empty");
  expect(readParallel({results:[],errors:[{url,http_status_code:403,error_type:"blocked"}]},url).error?.class).toBe("http_4xx");
  expect(readTavily({results:[],failed_results:[{url,error:"failed"}]},url).error?.class).toBe("empty");
  expect(readFirecrawl({success:true,data:{markdown:"error page",metadata:{statusCode:404}}}).error?.class).toBe("http_4xx");
});
test("Exa contents errors retain HTTP status and timeout tags",()=>{
  for (const [error, classification] of [
    [{httpStatusCode:429,tag:"CRAWL_RATE_LIMIT"},"http_429"],
    [{httpStatusCode:500,tag:"CRAWL_ERROR"},"http_5xx"],
    [{httpStatusCode:503},"http_5xx"],
    [{httpStatusCode:403,tag:"CRAWL_FORBIDDEN"},"http_4xx"],
    [{httpStatusCode:404},"http_4xx"],
    [{httpStatusCode:408,tag:"CRAWL_TIMEOUT"},"timeout"],
    [{httpStatusCode:504,tag:"CRAWL_LIVECRAWL_TIMEOUT"},"timeout"],
    [{tag:"CRAWL_TIMEOUT"},"timeout"],
    [{tag:"CRAWL_LIVECRAWL_TIMEOUT"},"timeout"],
    [{tag:"UNKNOWN"},"empty"]
  ] as const) {
    const result=readExa({results:[],statuses:[{id:url,status:"error",error}]},url);
    expect(result.text).toBe(""); expect(result.error?.class).toBe(classification);
    if ("tag" in error) expect(result.error?.message).toContain(error.tag);
    if ("httpStatusCode" in error) expect(result.error?.message).toContain(String(error.httpStatusCode));
  }
  expect(readExa({results:[{url,text:"success"}],statuses:[{id:"other-url",status:"error",error:{httpStatusCode:403}}]},url).text).toBe("success");
  expect(readExa({results:[],statuses:[{id:"other-url",status:"error",error:{httpStatusCode:429}}]},url).error?.class).toBe("http_429");
});
test("native read text and cache metadata",()=>{ expect(readExa(samples.exa,url).text).toContain("2.0.0"); expect(readParallel(samples.parallel,url).text).toContain("2.0.0"); expect(readTavily(samples.tavily,url).text).toContain("2.0.0"); const r=readFirecrawl({success:true,data:{markdown:"doc",metadata:{statusCode:200,cacheState:"hit",cachedAt:"now"}}}); expect(r.metadata?.cacheState).toBe("hit"); });
test("cost estimates, dollar fields, retry unknowns",()=>{
  const exa=PROFILES.find(p=>p.id==="exa:auto")!;
  expect(providerCost(exa,false,samples.exa).metered_usd).toBe(.007); expect(providerCost(exa,false,samples.exa,2).metered_usd).toBeNull();
  expect(providerCost(PROFILES.find(p=>p.id==="tavily:advanced")!,false,samples.tavily).estimated_usd).toBe(.016);
  expect(providerCost(PROFILES.find(p=>p.id==="tavily:advanced")!,true,{}).estimated_usd).toBe(.008);
  expect(providerCost(PROFILES.find(p=>p.id==="firecrawl:search")!,false,samples.firecrawl).estimated_usd).toBe(.00198);
});
test("post-hoc costs retain Exa metering and estimate Firecrawl credit blocks",()=>{
  for (const [id, price] of [["exa:auto-objective",.007],["exa:auto-dynamic",.007],["exa:lite",.004],["brave:web-nospell",.005]] as const) {
    const profile=PROFILES.find(p=>p.id===id)!;
    expect(providerCost(profile,false,{}).estimated_usd).toBe(price);
    expect(providerCost(profile,false,{},2).estimated_usd).toBe(price*2);
    expect(estimateUnit(profile)).toBeCloseTo(price+(profile.provider==="exa"?.001:0),10);
    if (profile.provider==="exa") {
      expect(providerCost(profile,false,{costDollars:{total:.003}}).metered_usd).toBe(.003);
      expect(providerCost(profile,false,{costDollars:{total:.003}},2).metered_usd).toBeNull();
      expect(providerCost(profile,true,{}).estimated_usd).toBe(.001);
    }
  }
  const developer=PROFILES.find(p=>p.id==="firecrawl:developer")!;
  expect(providerCost(developer,false,{}).estimated_usd).toBe(.00198);
  expect(estimateUnit(developer)).toBeCloseTo(.00297,10);
  expect(providerCost(developer,false,{}).basis).toContain("estimated credits");
  expect(providerCost(developer,true,{}).estimated_usd).toBe(.00099);
  expect(providerCost({...developer,search:{...developer.search,params:{...developer.search.params,k:11}}},false,{}).estimated_usd).toBe(.00396);
});
for (const id of ["exa:auto-objective", "exa:auto-dynamic", "exa:lite"]) test(`${id} sends optional purpose only when supplied`,async()=>{
  const bodies: any[]=[];
  const adapter=createAdapter(PROFILES.find(p=>p.id===id)!, (async(_input:any,init:any)=>{bodies.push(JSON.parse(init.body));return Response.json(samples.exa);}) as unknown as typeof fetch);
  for (const purpose of [undefined,"Find the migration guidance",""]) expect((await adapter.search("library 2.0.0",purpose)).error).toBeUndefined();
  expect(bodies).toHaveLength(3);
  expect(bodies[0]).not.toHaveProperty("objective");
  expect(bodies[0].query).toBe("library 2.0.0");
  expect(bodies[1].objective).toBe("Find the migration guidance");
  expect(bodies[2]).not.toHaveProperty("objective");
});
test("template omits missing purpose keys recursively without changing other variables",()=>{
  expect(template({query:"$query",nested:{objective:"$purpose"},fallback:"$purpose_or_query",unknown:"$unknown"},{"$query":"query","$purpose_or_query":"query"})).toEqual({query:"query",nested:{},fallback:"query",unknown:"$unknown"});
  for (const purpose of [undefined, "", "  "]) expect(template({list:["$query","$purpose"],o:{objective:"$purpose"}},{"$query":"q","$purpose":purpose})).toEqual({list:["q"],o:{}});
  expect(template({list:["$purpose"],objective:"$purpose"},{"$purpose":"p"})).toEqual({list:["p"],objective:"p"});
});
test("profile headers cannot override provider credentials, whatever their case",async()=>{
  const profile={...PROFILES.find(p=>p.id==="exa:auto-dynamic")!,headers:{"X-API-Key":"spoofed","Exa-Beta":"b"}};
  let sent: Headers|undefined;
  await createAdapter(profile,(async(_i:any,init:any)=>{sent=new Headers(init.headers);return Response.json(samples.exa);}) as unknown as typeof fetch).search("q");
  expect(sent!.get("x-api-key")).toBe(process.env.EXA_API_KEY!); expect(sent!.get("Exa-Beta")).toBe("b");
});
test("Exa dynamic sends beta header on search only and never maxCharacters",async()=>{
  const requests: {url:string;headers:Headers;body:any}[]=[];
  const profile=PROFILES.find(p=>p.id==="exa:auto-dynamic")!;
  const adapter=createAdapter(profile,(async(input:any,init:any)=>{requests.push({url:String(input),headers:new Headers(init.headers),body:JSON.parse(init.body)});return Response.json(samples.exa);}) as unknown as typeof fetch);
  const search=await adapter.search("library 2.0.0","Find docs");
  expect(search.error).toBeUndefined(); expect((await adapter.read(search.value[0])).error).toBeUndefined();
  expect(requests).toHaveLength(2);
  expect(requests[0].headers.get("Exa-Beta")).toBe("dynamic-highlights-2026-08-28");
  expect(requests[0].headers.get("x-api-key")).toBe(process.env.EXA_API_KEY!);
  expect(requests[0].body.contents.highlights).toEqual({dynamic:true});
  expect(requests[0].body.contents.highlights).not.toHaveProperty("maxCharacters");
  expect(requests[1].headers.has("Exa-Beta")).toBe(false);
  expect(requests[1].headers.get("x-api-key")).toBe(process.env.EXA_API_KEY!);
  expect(requests[1].url).toBe("https://api.exa.ai/contents");
  expect(requests[1].body).toEqual({urls:[url],text:{maxCharacters:60000}});
  expect(JSON.parse(JSON.stringify(profile))).toMatchObject({posthoc:true,headers:{"Exa-Beta":"dynamic-highlights-2026-08-28"}});
});
test("Brave no-spell sends spellcheck=false and normalizes web results",async()=>{
  let requested="";
  const adapter=createAdapter(PROFILES.find(p=>p.id==="brave:web-nospell")!,(async(input:any)=>{requested=String(input);return Response.json(samples.braveWeb);}) as unknown as typeof fetch);
  const result=await adapter.search("library 2.0.0");
  expect(new URL(requested).searchParams.get("spellcheck")).toBe("false");
  expect(result.error).toBeUndefined(); expect(result.value).toEqual(normalizeBrave(samples.braveWeb,"web"));
});
test("bundled Firecrawl read makes no extra call and arbitrary IDs are blocked",async()=>{
  let calls=0; const adapter=createAdapter(PROFILES.find(p=>p.id==="firecrawl:search-md")!, (async()=>{ calls++; return new Response(JSON.stringify(samples.firecrawl)); }) as unknown as typeof fetch);
  const session=new ToolSession(adapter); const search=await session.web_search({query:"library 2.0.0"}); const read=await session.web_read({result_id:search.results[0].id});
  expect(calls).toBe(1); expect(read.provenance).toBe("firecrawl/search-scrape"); expect((await session.web_read({result_id:"https://example.com"})).error?.class).toBe("blocked");
});
test("blocked profiles cannot reach a provider endpoint",async()=>{
  let calls=0; const adapter=createAdapter(PROFILES.find(p=>p.id==="brave:llm-context")!, (async()=>{calls++;throw Error("must not call");}) as unknown as typeof fetch);
  const outcome=await adapter.search("anything");expect(calls).toBe(0);expect(outcome.error?.class).toBe("blocked");expect(outcome.error?.message).toContain("OPTION_NOT_IN_PLAN");
});
