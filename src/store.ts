import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { redact, sanitized } from "./redact";
import type { Unit } from "./types";
export const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
export async function writeSafe(path: string, content: string) { await writeFile(path, redact(content)); }
export async function writeJSON(path: string, value: unknown) { await writeSafe(path, JSON.stringify(value, null, 2) + "\n"); }
export async function readJSONL<T = any>(path: string): Promise<T[]> {
  let text: string; try { text = await readFile(path, "utf8"); } catch (e: any) { if (e.code === "ENOENT") return []; throw e; }
  return text.split("\n").filter(Boolean).map((line, i) => { try { return JSON.parse(line); } catch { throw Error(`Invalid JSONL at ${path}:${i + 1}; repair incomplete trailing line before resuming`); } });
}
const NOT_RETAINED = "[brave result not retained]";
// Brave's API terms forbid storing search results, so public artifacts keep only derived metrics for Brave arms.
export function publicUnit(unit: Unit): Unit {
  if (!unit.arm.startsWith("brave:")) return unit;
  const u: any = structuredClone(unit);
  for (const r of u.requests ?? []) if (r.kind === "read") { r.url = NOT_RETAINED; if (r.params?.url) r.params.url = NOT_RETAINED; }
  for (const k of ["reported", "false_positives", "uncertain", "unmatched_reported"]) if (Array.isArray(u.metrics?.[k])) u.metrics[k] = u.metrics[k].map((f: any) => ({...f, explanation: NOT_RETAINED, citations: []}));
  if (Array.isArray(u.urls)) u.urls = u.urls.map(() => NOT_RETAINED);
  if (Array.isArray(u.metrics?.results)) u.metrics.results = u.metrics.results.map((r: any) => ({...r, url: NOT_RETAINED, published_at: null}));
  return u;
}
export function publicJudgment<T extends {arm?: string; judgment?: any}>(result: T): T {
  if (!result.arm?.startsWith("brave:") || !result.judgment) return result;
  const r: any = structuredClone(result); r.judgment.reason = NOT_RETAINED; return r;
}
export class Store {
  readonly completed = new Set<string>();
  readonly units: Unit[] = [];
  constructor(readonly dir: string) {}
  async init() { await mkdir(join(this.dir, "private"), {recursive: true, mode: 0o700}); for (const u of await readJSONL<Unit>(join(this.dir, "units.jsonl"))) { if (this.completed.has(u.key)) throw Error(`Duplicate completed unit ${u.key}`); this.completed.add(u.key); this.units.push(u); } }
  privatePath(key: string) { return join(this.dir, "private", sha256(key) + ".json"); }
  async complete(unit: Unit, privateData: unknown) {
    if (this.completed.has(unit.key)) throw Error(`Unit already completed: ${unit.key}`);
    await writeJSON(this.privatePath(unit.key), privateData);
    await appendFile(join(this.dir, "units.jsonl"), redact(JSON.stringify(publicUnit(unit))) + "\n");
    this.completed.add(unit.key); this.units.push(sanitized(publicUnit(unit)));
  }
}
