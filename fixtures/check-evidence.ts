import {readFile, readdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const fixtures = dirname(fileURLToPath(import.meta.url));
const quotes: {id:string;url:string;text:string}[] = [];
for (const entry of await readdir(fixtures,{withFileTypes:true})) {
  if (!entry.isDirectory() || !/^(oc|rv)-/.test(entry.name)) continue;
  let url = '';
  for (const line of (await readFile(join(fixtures,entry.name,'EVIDENCE.md'),'utf8')).split('\n')) {
    if (/^https:\/\//.test(line)) url = line.split(/\s/)[0];
    if (line.startsWith('> ')) {
      if (!url) throw new Error(`Missing source for ${entry.name} quote`);
      quotes.push({id:entry.name,url,text:line.slice(2).replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replaceAll('`','')});
    }
  }
}

function textFromHtml(html: string): string {
  const entities: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<[^>]+>/g,'')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original,entity:string) => {
      if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2),16));
      if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
      return entities[entity] ?? original;
    }).replace(/\s+/g,' ').trim();
}

const pages = new Map<string,string>();
await Promise.all([...new Set(quotes.map(quote=>quote.url))].map(async url=>{
  const response = await fetch(url,{signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  pages.set(url,textFromHtml(await response.text()));
}));
const failures = quotes.filter(quote=>!pages.get(quote.url)!.includes(quote.text.replace(/\s+/g,' ').trim()));
for (const failure of failures) console.error(`${failure.id}: quote not found at ${failure.url}: ${failure.text}`);
if (failures.length) throw new Error(`${failures.length}/${quotes.length} primary-source quotes did not match`);
console.log(`Verified ${quotes.length} verbatim quotes across ${pages.size} primary-source URLs for 8 fixtures.`);
