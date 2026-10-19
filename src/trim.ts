export const tokens = (text: string) => Math.ceil(text.length / 4);
const STOP = new Set("the and for with from that this are was were will have has how what when which into use using can does not you your about then than its any all".split(" "));
export function queryTerms(query: string): string[] { return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}_]+(?:[._-][\p{L}\p{N}_]+)*/gu) ?? []).filter(t => t.length >= 3 && !STOP.has(t)))]; }
export function blocks(text: string): string[] {
  const out: string[] = []; let current: string[] = []; let fenced = false;
  const flush = () => { const s = current.join("\n").trim(); if (s) out.push(s); current = []; };
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) { if (!fenced) { flush(); fenced = true; current.push(line); } else { current.push(line); fenced = false; flush(); } }
    else if (fenced) current.push(line);
    else if (!line.trim()) flush();
    else { if (/^#{1,6}\s/.test(line)) flush(); current.push(line); }
  }
  flush(); return out;
}
function cutBlock(text: string, chars: number): string {
  if (text.length <= chars) return text;
  const lines = text.split("\n");
  const code = /^\s*```/.test(lines[0]);
  const end = code ? "\n```" : "";
  const kept: string[] = [];
  for (const line of lines.slice(0, code && /^\s*```/.test(lines.at(-1)!) ? -1 : undefined)) {
    if ([...kept, line].join("\n").length + end.length > chars) break;
    kept.push(line);
  }
  return kept.length ? kept.join("\n") + end : "";
}
export function trimText(text: string, query: string, maxChars: number): string {
  maxChars = Math.max(0, Math.floor(maxChars));
  if (text.length <= maxChars) return text;
  const parts = blocks(text); const terms = queryTerms(query);
  const ranked = parts.map((s, i) => ({i, score: terms.filter(t => s.toLowerCase().includes(t)).length})).sort((a, b) => b.score - a.score || a.i - b.i);
  const selected = new Map<number, string>();
  const render = () => {
    const output: string[] = []; let gap = false;
    for (let i = 0; i < parts.length; i++) { if (selected.has(i)) { if (gap) output.push("[…]"); output.push(selected.get(i)!); gap = false; } else gap = true; }
    if (gap && output.length) output.push("[…]");
    return output.join("\n\n");
  };
  for (const {i} of ranked) {
    selected.set(i, parts[i]);
    if (render().length <= maxChars) continue;
    selected.set(i, "");
    const room = maxChars - render().length;
    const cut = cutBlock(parts[i], room);
    if (cut) selected.set(i, cut); else selected.delete(i);
  }
  const result = render();
  return result.length <= maxChars ? result : "";
}
export function trimResults(texts: string[], query: string, maxChars: number): string[] {
  if (!texts.length) return [];
  const share = Math.floor(maxChars / texts.length);
  const caps = texts.map(t => Math.min(t.length, share));
  let unused = maxChars - caps.reduce((a, b) => a + b, 0);
  const long = texts.map((t, i) => ({t, i})).filter(({t, i}) => t.length > caps[i]);
  for (let n = 0; n < long.length; n++) { const {t, i} = long[n]; const extra = Math.min(t.length - caps[i], Math.floor(unused / (long.length - n))); caps[i] += extra; unused -= extra; }
  return texts.map((t, i) => trimText(t, query, caps[i]));
}
