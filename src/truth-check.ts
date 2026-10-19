import { readFile, mkdir } from "node:fs/promises";
import { commonRead, documentText } from "./web-read";
import { sha256, writeJSON } from "./store";
import { log } from "./redact";
import type { SearchCase } from "./types";
// Compare letter/digit token streams so markdown syntax, quotes and spacing artifacts don't matter.
export const normalizeQuote = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export async function truthCheck(paths: string[]) {
  const cache = new Map<string, Awaited<ReturnType<typeof commonRead>>>(); const rows: any[] = [];
  for (const path of paths) {
    const data = JSON.parse(await readFile(path, "utf8"));
    for (const c of data.cases as SearchCase[]) for (const e of c.excerpts) {
      let response = cache.get(e.url); if (!response) { response = await commonRead(e.url); cache.set(e.url,response); }
      const ok = !response.error && !!normalizeQuote(e.quote) && normalizeQuote(documentText(response.raw?.body ?? response.value.text, response.raw?.contentType ?? "text/plain")).includes(normalizeQuote(e.quote));
      rows.push({case_file: path, case_id: c.id, url: e.url, pass: ok, sha256: response.error ? null : sha256(response.value.text), error: response.error, checked_at: new Date().toISOString()});
    }
  }
  await mkdir("cases",{recursive:true}); await writeJSON("cases/truth-check.json", {timestamp: new Date().toISOString(), results: rows});
  log("Case\tStatus\tURL"); for (const row of rows) log(`${row.case_id}\t${row.pass ? "PASS" : "FAIL"}\t${row.url}`);
  return rows.every(r => r.pass);
}
