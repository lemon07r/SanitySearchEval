import { LIMITS, PRICES } from "./config";
import type { Profile, Cost } from "./types";
export function estimateUnit(profile: Profile | undefined, product?: "revera" | "opencode"): number {
  const search = !profile ? 0 : profile.provider === "brave" ? PRICES.brave : profile.provider === "exa" ? PRICES.exa[profile.mode as "auto" | "deep-lite"] : profile.provider === "parallel" ? PRICES.parallel[profile.mode as "fast" | "advanced"] : profile.provider === "firecrawl" ? (profile.mode === "search-md" ? 7 : 2) * PRICES.firecrawl_credit : (profile.mode === "advanced" ? 2 : 1) * PRICES.tavily_credit;
  const read = !profile || profile.provider === "brave" || profile.id === "firecrawl:search-md" ? 0 : profile.provider === "exa" || profile.provider === "parallel" ? 0.001 : profile.provider === "firecrawl" ? PRICES.firecrawl_credit : PRICES.tavily_credit;
  // Planning estimate, not an upper bound: 8k input + 1k output tokens / model turn.
  return product ? LIMITS[product].calls * (8000 * PRICES.model.input + 1000 * PRICES.model.output) / 1e6 + 2 * (search + read) : search + read;
}
export function assertBudget(estimate: number, cap: number) { if (!Number.isFinite(cap) || cap < 0) throw Error("Invalid --max-cost-usd"); if (estimate > cap + 1e-10) throw Error(`Budget refusal: estimated $${estimate.toFixed(4)} exceeds --max-cost-usd ${cap}; raise the cap explicitly (--yes does not override it)`); }
export function accountedCost(costs: Cost[], fallback: number) { let unknown = false; const known = costs.reduce((s, c) => { const value = c.metered_usd ?? c.estimated_usd; if (value === null) unknown = true; return s + (value ?? 0); }, 0); return unknown ? Math.max(known, fallback) : known; }
export class Budget {
  readonly started = Date.now(); spent = 0; reserved = 0; stop_reason: string | null = null;
  constructor(readonly cap: number, readonly minutes: number) {}
  canStart(estimate: number) {
    if (this.stop_reason) return false;
    if (Date.now() - this.started >= this.minutes * 60000) this.stop_reason = "time cap reached";
    else if (this.spent >= this.cap || this.spent + this.reserved + estimate > this.cap + 1e-10) this.stop_reason = "cost cap reached (including in-flight reservations)";
    if (this.stop_reason) return false;
    this.reserved += estimate; return true;
  }
  finish(estimate: number, costs: Cost[]) { this.reserved -= estimate; this.spent += accountedCost(costs, estimate); }
}
