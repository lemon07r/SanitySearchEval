import { test, expect } from "bun:test";
import { isBlockedAddress, checkURL, checkRedirect, extractDocument } from "../src/web-read";
import { setSecrets, redact, sanitized } from "../src/redact";
import { normalizeQuote } from "../src/truth-check";
import { secretValues } from "../src/env";
test("only long suffix-named env secrets redact; JSON primitives and short strings are byte-identical",()=>{
  const key="K".repeat(40);
  const selected=secretValues({SERVICE_API_KEY:key,IGNORED_KEY_WARNINGS:"true",SHORT_TOKEN:"short",FLAG_SECRET:"false",LONG_NOT_SECRET_VALUE:"unrelated-long-value"});
  expect(selected).toEqual([key]); setSecrets([...selected,"true","false","7","short"]);
  const primitives=JSON.stringify({count:42,ok:true,disabled:false,label:"short",date:1792394253000},null,2);
  expect(redact(primitives)).toBe(primitives);
  const saved=redact(JSON.stringify({key,ok:true,count:42,label:"short"},null,2));
  expect(saved).not.toContain(key); expect(JSON.parse(saved)).toEqual({key:"[REDACTED]",ok:true,count:42,label:"short"});
  setSecrets(["12345678901234567890"]);
  expect(redact('{"number":12345678901234567890,"text":"12345678901234567890"}')).toBe('{"number":12345678901234567890,"text":"[REDACTED]"}');
});
test("redaction handles nested objects, exact values, bearer, headers, query keys",()=>{
  setSecrets(["super-secret-value"]);
  const result=sanitized({nested:["super-secret-value",{text:'Bearer abc.def.ghi x-api-key: top-secret sk-12345678 https://example.com?api_key=query-secret&token=token-secret'}]});
  const text=JSON.stringify(result);for(const secret of ["super-secret-value","abc.def.ghi","top-secret","sk-12345678","query-secret","token-secret"])expect(text).not.toContain(secret);expect(redact("ordinary documentation")).toBe("ordinary documentation");
});
test("public address classifier blocks private, link-local, CGNAT, multicast, mapped IPv6",()=>{
  for(const address of ["127.0.0.1","0.0.0.0","10.0.0.1","172.16.0.1","172.31.255.1","192.168.1.1","169.254.169.254","100.64.0.1","100.127.255.1","224.0.0.1","255.255.255.255","::","::1","fe80::1","fc00::1","fdab::1","ff02::1","::ffff:127.0.0.1","::ffff:7f00:1","::ffff:808:808","invalid"])expect(isBlockedAddress(address)).toBe(true);
  for(const address of ["1.1.1.1","8.8.8.8","100.128.0.1","172.32.0.1","2606:4700:4700::1111"])expect(isBlockedAddress(address)).toBe(false);
});
test("URLs and every redirect hop recheck scheme, DNS and mixed answers without network",async()=>{
  const publicDNS=async()=>[{address:"1.1.1.1",family:4}]; const privateDNS=async()=>[{address:"127.0.0.1",family:4}];
  await expect(checkURL("http://example.com",publicDNS)).rejects.toThrow("HTTPS");
  await expect(checkURL("https://u:p@example.com",publicDNS)).rejects.toThrow("credentials");
  await expect(checkRedirect("https://example.com","https://internal.example",privateDNS)).rejects.toThrow("non-public");
  await expect(checkRedirect("https://example.com","http://example.com",publicDNS)).rejects.toThrow("HTTPS");
  await expect(checkURL("https://example.com",async()=>[...await publicDNS(),...await privateDNS()])).rejects.toThrow("non-public");
  expect((await checkRedirect("https://example.com/a","/b",publicDNS)).url.href).toBe("https://example.com/b");
});
test("HTML reader keeps headings and fenced code, plain text unchanged",()=>{
  const html=`<html><head><title>API</title></head><body><article><h1>Version 2</h1><p>${"This explains the library contract. ".repeat(50)}</p><pre><code>library.validate()</code></pre></article></body></html>`;
  const doc=extractDocument(html,"text/html","https://example.com");expect(doc.text).toContain("library.validate()");expect(doc.text).toContain("```");expect(doc.text).toContain("# Version 2");expect(extractDocument("plain","text/plain","https://example.com").text).toBe("plain");
});
test("truth quote normalization",()=>{expect(normalizeQuote('  “API”\n\tworks `well` [x](y)')).toBe('api works well x y');});
