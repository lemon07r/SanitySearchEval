import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { parseHTML } from "linkedom";
import Turndown from "turndown";
import { LIMITS } from "./config";
import type { Outcome } from "./types";
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (kind === 6) {
    if (ip.includes(".")) return true;
    const halves = ip.split("::");
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
    const words = (halves.length > 1 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left).map(w => parseInt(w, 16));
    const first = words[0];
    return words.every(w => w === 0) || (words.slice(0, 7).every(w => w === 0) && words[7] === 1) || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || words.slice(0, 5).every(w => w === 0) && (words[5] === 0xffff || words[5] === 0) || (first & 0xffc0) === 0xfec0;
  }
  return true;
}
export async function checkURL(input: string, resolver: (host: string) => Promise<{address: string; family: number}[]> = host => lookup(host, {all: true})) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password) throw Error("blocked: HTTPS without credentials required");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{address: host, family: isIP(host)}] : await resolver(host);
  if (!addresses.length || addresses.some(a => isBlockedAddress(a.address))) throw Error("blocked: non-public address");
  return {url, addresses};
}
export async function checkRedirect(from: string, location: string, resolver?: Parameters<typeof checkURL>[1]) { return checkURL(new URL(location, from).href, resolver); }
const markdown = new Turndown({codeBlockStyle: "fenced", headingStyle: "atx"});
function stripChrome(document: any) {
  for (const el of document.querySelectorAll("script,style,noscript,svg,template,nav,header,footer,aside,dialog,[hidden],[aria-hidden=true]")) el.remove();
}
const ENTITIES: Record<string, string> = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " "};
// Plain tag-stripped text of the whole document, used by truth:check (not shown to models).
export function documentText(text: string, contentType: string): string {
  if (!/html|xhtml/.test(contentType)) return text;
  return text.replace(/<(script|style|svg|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m);
}
// Whole <main> (or body) as markdown with page chrome removed. Readability was tried first and
// dropped load-bearing text on GitHub advisory and PostgreSQL release-note pages; the shared
// query-aware trimming selects the relevant blocks afterwards.
export function extractDocument(text: string, contentType: string, _url: string): {text: string; title?: string} {
  if (!/html|xhtml/.test(contentType)) return {text};
  const {document} = parseHTML(text);
  const title = document.querySelector("title")?.textContent?.trim() || undefined;
  stripChrome(document);
  const main: any = document.querySelector("main,[role=main]") ?? document.body;
  if (main?.innerHTML) { try { return {text: markdown.turndown(main.innerHTML), title}; } catch { /* plain text below */ } }
  return {text: document.body?.textContent ?? document.textContent ?? "", title};
}
async function getDocument(input: string, deadline: number, hops = 0): Promise<{body: string; contentType: string; url: string; status: number; cache: Record<string, string>}> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new DOMException("Request timed out", "TimeoutError");
  const checked = await Promise.race([checkURL(input), new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new DOMException("DNS timed out", "TimeoutError")), remaining); t.unref(); })]);
  // Pin the validated DNS answer, preventing a second lookup / DNS rebinding.
  const response = await new Promise<{body: string; contentType: string; status: number; location?: string; cache: Record<string, string>}>((resolve, reject) => {
    const req = request(checked.url, {headers: {"User-Agent": "SanitySearchEval/1.0", Accept: "text/html,text/plain,text/markdown,application/xhtml+xml"}, lookup: ((_host: string, opts: any, cb: any) => { const a = checked.addresses[0]; if (opts?.all) cb(null, [a]); else cb(null, a.address, a.family); }) as any}, res => {
      const status = res.statusCode ?? 0; const contentType = String(res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const cache: Record<string, string> = {};
      for (const k of ["age", "cf-cache-status", "x-cache"]) if (res.headers[k]) cache[k] = String(res.headers[k]);
      if (status >= 300 && status < 400 && res.headers.location) { res.destroy(); resolve({body: "", contentType, status, location: res.headers.location, cache}); return; }
      if (status >= 400) { res.destroy(); reject(Error(`http:${status}`)); return; }
      if (!["text/html", "application/xhtml+xml", "text/plain", "text/markdown"].includes(contentType)) { res.destroy(); reject(Error("blocked: unsupported content type")); return; }
      if (Number(res.headers["content-length"]) > LIMITS.body_bytes) { res.destroy(); reject(Error("blocked: document too large")); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      res.on("data", chunk => { bytes += chunk.length; if (bytes > LIMITS.body_bytes) { req.destroy(Error("blocked: document too large")); return; } chunks.push(Buffer.from(chunk)); });
      res.on("end", () => resolve({body: Buffer.concat(chunks).toString("utf8"), contentType, status, cache}));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new DOMException("Request timed out", "TimeoutError")), Math.max(1, deadline - Date.now()));
    req.on("close", () => clearTimeout(timer)); req.on("error", reject); req.end();
  });
  if (response.location) {
    if (hops >= LIMITS.redirects) throw Error("blocked: redirect limit");
    return getDocument(new URL(response.location, input).href, deadline, hops + 1);
  }
  return {...response, url: input};
}
export async function commonRead(url: string): Promise<Outcome<{text: string; title?: string; provenance: string; metadata?: any}>> {
  const start = performance.now(); const attempts: any[] = []; let error: any; let raw: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    const began = performance.now();
    try {
      raw = await getDocument(url, Date.now() + LIMITS.read_ms);
      attempts.push({status: raw.status, ms: performance.now() - began, cache: raw.cache});
      const value = {...extractDocument(raw.body, raw.contentType, raw.url), provenance: "common-reader", metadata: {final_url: raw.url, cache: raw.cache}};
      if (!value.text.trim()) error = {class: "empty", message: "Empty document"};
      return {value, error, raw, cost: {estimated_usd: 0, metered_usd: null, basis: "common reader: no API fee; transport not metered"}, ms: performance.now() - start, http: {data: raw, attempts, ms: performance.now() - start, request: {url, method: "GET", params: null}, error}};
    } catch (e: any) {
      const status = Number(e.message?.match(/^http:(\d+)/)?.[1]) || null;
      const cls = e.name === "TimeoutError" ? "timeout" : e.message?.startsWith("blocked:") ? "blocked" : status === 429 ? "http_429" : status && status >= 500 ? "http_5xx" : status ? "http_4xx" : "network";
      error = {class: cls, message: e.message}; attempts.push({status, ms: performance.now() - began, cache: {}, error: e.message});
      if (attempt || !["timeout", "network", "http_429", "http_5xx"].includes(cls)) break;
      await Bun.sleep(2000);
    }
  }
  return {value: {text: "", provenance: "common-reader"}, raw, error, ms: performance.now() - start, cost: {estimated_usd: 0, metered_usd: null, basis: "common reader: no API fee; transport not metered"}, http: {data: raw, attempts, ms: performance.now() - start, request: {url, method: "GET", params: null}, error}};
}
