import { normalizeBrave } from "./brave";
import { normalizeExa, readExa } from "./exa";
import { normalizeParallel, readParallel } from "./parallel";
import { normalizeFirecrawl, normalizeFirecrawlDeveloper, readFirecrawl } from "./firecrawl";
import { normalizeTavily, readTavily } from "./tavily";
import { LIMITS, PRICES, template, unknownCost } from "../config";
import { providerKey } from "../env";
import { requestJSON } from "../http";
import { commonRead } from "../web-read";
import type { Adapter, Profile, Cost, HttpResult, Outcome, RawResult } from "../types";
export function providerCost(profile: Profile, read: boolean, data: any, attempts = 1): Cost {
  let fee: number; let basis = "list-price estimate per attempted request";
  switch (profile.provider) {
    case "brave": fee = read ? 0 : PRICES.brave; break;
    case "exa": fee = read ? PRICES.exa.read : PRICES.exa[profile.mode as keyof typeof PRICES.exa]; break;
    case "parallel": fee = read ? PRICES.parallel.read : PRICES.parallel[profile.mode as "fast" | "advanced"]; break;
    case "firecrawl": {
      const credits = data?.creditsUsed ?? data?.data?.metadata?.creditsUsed;
      const searchCredits = profile.mode === "developer" ? 2 * Math.ceil((profile.search.params.k ?? 10) / 10) : 2 + (profile.mode === "search-md" ? 5 : 0);
      fee = (typeof credits === "number" ? credits : read ? 1 : searchCredits) * PRICES.firecrawl_credit;
      basis = `${typeof credits === "number" ? "reported credits" : "estimated credits"} × Standard plan USD/credit; retries conservatively charged`;
      break;
    }
    case "tavily": {
      const credits = data?.usage?.credits;
      // The live single-URL extract reports one credit (a five-URL batch is not prorated).
      fee = (typeof credits === "number" ? credits : read ? 1 : profile.mode === "advanced" ? 2 : 1) * PRICES.tavily_credit;
      basis = `${typeof credits === "number" ? "reported credits" : "estimated credits"} × pay-as-you-go USD/credit; retries conservatively charged`;
    }
  }
  const dollars = data?.costDollars?.total;
  return {estimated_usd: fee! * attempts, metered_usd: profile.provider === "exa" && typeof dollars === "number" && attempts === 1 ? dollars : null, basis: basis + (profile.provider === "exa" && typeof dollars === "number" ? "; costDollars.total reported by Exa (vendor estimate)" : "")};
}
export function createAdapter(profile: Profile, fetcher?: typeof fetch): Adapter {
  const native = async (read: boolean, vars: Record<string, string | undefined>): Promise<HttpResult> => {
    const key = providerKey(profile.provider);
    const shape = read ? profile.read : profile.search;
    const params = template(shape.params, vars);
    if (profile.blocked_reason) return {data: null, attempts: [], ms: 0, request: {url: shape.url, method: shape.method, params}, error: {class: "blocked", message: profile.blocked_reason}};
    if (!key) return {data: null, attempts: [], ms: 0, request: {url: shape.url, method: shape.method, params}, error: {class: "blocked", message: `Missing ${profile.provider} credential`}};
    const auth = new Set(["x-subscription-token", "authorization", "x-api-key"]);
    const headers: Record<string, string> = read ? {} : Object.fromEntries(Object.entries(profile.headers ?? {}).filter(([k]) => !auth.has(k.toLowerCase())));
    if (profile.provider === "brave") headers["X-Subscription-Token"] = key;
    else if (["firecrawl", "tavily"].includes(profile.provider)) headers.Authorization = `Bearer ${key}`;
    else headers["x-api-key"] = key;
    return requestJSON({url: shape.url, method: shape.method, params, headers, provider: profile.provider, timeout: read ? LIMITS.read_ms : LIMITS.search_ms, fetcher});
  };
  const outcome = <T>(http: HttpResult, value: T, read: boolean, error = http.error): Outcome<T> => ({http, value, raw: http.data, error, ms: http.ms, cost: http.attempts.length ? providerCost(profile, read, http.data, http.attempts.length) : unknownCost("credential missing; no call attempted")});
  return {
    profile,
    async search(query, purpose) {
      const http = await native(false, {"$query": query, "$purpose_or_query": purpose ?? query, "$purpose": purpose});
      if (http.error) return outcome(http, [], false);
      try {
        const results: RawResult[] = profile.provider === "brave" ? normalizeBrave(http.data, profile.mode) : profile.provider === "exa" ? normalizeExa(http.data) : profile.provider === "parallel" ? normalizeParallel(http.data) : profile.provider === "firecrawl" ? (profile.mode === "developer" ? normalizeFirecrawlDeveloper(http.data) : normalizeFirecrawl(http.data)) : normalizeTavily(http.data);
        return outcome(http, results.slice(0, 5), false, results.length ? undefined : {class: "empty", message: "Search returned no results"});
      } catch (e: any) { return outcome(http, [], false, {class: "parse", message: e.message}); }
    },
    async read(result, purpose) {
      if (profile.provider === "brave") return commonRead(result.url);
      if (profile.id === "firecrawl:search-md" && result.markdown) {
        const parsed = readFirecrawl({success: true, data: {markdown: result.markdown, metadata: result.metadata}});
        return {value: {...parsed, provenance: "firecrawl/search-scrape"}, error: parsed.error, ms: 0, cost: {estimated_usd: 0, metered_usd: 0, basis: "bundled with prior search, no additional call"}};
      }
      const http = await native(true, {"$result_url": result.url, "$purpose_or_query": purpose ?? "Read the page", "$purpose": purpose});
      const provenance = `${profile.provider}/${profile.provider === "exa" ? "contents" : profile.provider === "firecrawl" ? "scrape" : "extract"}`;
      if (http.error) return outcome(http, {text: "", provenance}, true);
      try {
        const parsed = profile.provider === "exa" ? readExa(http.data, result.url) : profile.provider === "parallel" ? readParallel(http.data, result.url) : profile.provider === "firecrawl" ? readFirecrawl(http.data) : readTavily(http.data, result.url);
        return outcome(http, {...parsed, provenance}, true, parsed.error ?? (!parsed.text.trim() ? {class: "empty", message: "Empty read text"} : undefined));
      } catch (e: any) { return outcome(http, {text: "", provenance}, true, {class: "parse", message: e.message}); }
    }
  };
}
