import { LIMITS, PROVIDER_LIMITS } from "./config";
import type { HttpResult, ToolError } from "./types";
export class Semaphore {
  private active = 0;
  private waiters: (() => void)[] = [];
  constructor(readonly limit: number) { if (!Number.isInteger(limit) || limit < 1) throw Error("Invalid concurrency"); }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>(r => this.waiters.push(r));
    else this.active++;
    try { return await fn(); } finally { const next = this.waiters.shift(); if (next) next(); else this.active--; }
  }
}
const semaphores = new Map<string, Semaphore>();
export class StartSpacing {
  private gate = new Semaphore(1);
  private lastStart = -Infinity;
  constructor(readonly interval: number, private clock = () => performance.now(), private sleep: (ms: number) => Promise<any> = Bun.sleep) {}
  async wait(): Promise<number> { const asked = this.clock(); await this.gate.run(async () => { let wait = this.lastStart + this.interval - this.clock(); while (wait > 0) { await this.sleep(wait); wait = this.lastStart + this.interval - this.clock(); } this.lastStart = this.clock(); }); return this.clock() - asked; }
}
const spacings = new Map<string, StartSpacing>();
export function errorClass(status?: number, error?: any): ToolError["class"] {
  if (status === 429) return "http_429";
  if (status && status >= 500) return "http_5xx";
  if (status && status >= 400) return "http_4xx";
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "timeout";
  if (error instanceof SyntaxError) return "parse";
  return "network";
}
export interface HttpOptions {url: string; method?: string; params?: any; headers?: Record<string, string>; timeout?: number; provider?: string; fetcher?: typeof fetch; sleep?: (ms: number) => Promise<any>}
export async function requestJSON(o: HttpOptions): Promise<HttpResult> {
  const provider = o.provider ?? "llm";
  const limits = PROVIDER_LIMITS[provider as keyof typeof PROVIDER_LIMITS] ?? {concurrency: LIMITS.provider_concurrency, min_interval_ms: 0};
  const gate = semaphores.get(provider) ?? new Semaphore(limits.concurrency);
  semaphores.set(provider, gate);
  const spacing = spacings.get(provider) ?? new StartSpacing(limits.min_interval_ms);
  spacings.set(provider, spacing);
  return gate.run(async () => {
    const start = performance.now();
    const method = o.method ?? "POST";
    let url = o.url;
    if (method === "GET" && o.params) { const u = new URL(url); for (const [k, v] of Object.entries(o.params)) u.searchParams.set(k, String(v)); url = u.href; }
    const result: HttpResult = {data: null, attempts: [], ms: 0, pacing_ms: 0, request: {url, method, params: o.params ?? null}};
    for (let i = 0; i < 2; i++) {
      result.pacing_ms! += await spacing.wait();
      const began = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), o.timeout ?? LIMITS.search_ms);
      let retryAfter: string | null = null;
      let retry = false;
      try {
        const response = await (o.fetcher ?? fetch)(url, {method, headers: {"Content-Type": "application/json", ...o.headers}, body: method === "GET" ? undefined : JSON.stringify(o.params), signal: controller.signal});
        retryAfter = response.headers.get("retry-after");
        const cache: Record<string, string> = {};
        for (const key of ["age", "cf-cache-status", "x-cache"]) { const v = response.headers.get(key); if (v !== null) cache[key] = v; }
        const attempt = {status: response.status, ms: 0, request_id: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined, cache};
        result.attempts.push(attempt);
        const text = await response.text();
        attempt.ms = performance.now() - began;
        if (!response.ok) { result.error = {class: errorClass(response.status), message: `HTTP ${response.status}`}; try { result.data = JSON.parse(text); } catch { result.data = {body: text}; } retry = response.status === 429 || response.status >= 500; }
        else {
          result.data = JSON.parse(text);
          delete result.error;
          attempt.request_id = result.data?.requestId ?? result.data?.request_id ?? result.data?.search_id ?? result.data?.extract_id ?? result.data?.id ?? attempt.request_id;
        }
      } catch (error: any) {
        const cls = errorClass(undefined, controller.signal.aborted ? {name: "AbortError"} : error);
        result.error = {class: cls, message: cls === "timeout" ? "Request timed out" : String(error.message ?? error)};
        if (result.attempts.length === i) result.attempts.push({status: null, ms: performance.now() - began, cache: {}, error: result.error.message});
        else result.attempts[i].error = result.error.message;
        retry = cls === "timeout" || cls === "network";
      } finally { clearTimeout(timer); }
      if (!retry || i === 1) break;
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const wait = retryAfter === null ? 2000 : Math.min(10000, Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()));
      await (o.sleep ?? Bun.sleep)(Number.isFinite(wait) ? wait : 2000);
    }
    // Self-imposed plan pacing is client-side queueing, not provider latency; retries and backoff stay included.
    result.ms = performance.now() - start - result.pacing_ms!;
    return result;
  });
}
