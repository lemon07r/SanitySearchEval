let secrets: string[] = [];
export function setSecrets(values: string[]) { secrets = [...new Set(values.filter(v => typeof v === "string" && v.length >= 12))].sort((a, b) => b.length - a.length); }
function redactString(text: string): string {
  for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/\bBearer\s+[^\s"'<>;,}]+/gi, "Bearer [REDACTED]")
    .replace(/(x-api-key["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi, "$1[REDACTED]")
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, "[REDACTED]")
    .replace(/([?&](?:key|token|api_key|apikey|access_token)=)[^&#\s"']*/gi, "$1[REDACTED]");
}
export function redact(text: string): string {
  // Redact decoded JSON strings only: a numeric-looking key must never corrupt a
  // JSON number, and formatting / primitives remain byte-identical when unchanged.
  try {
    JSON.parse(text);
    return text.replace(/"(?:\\.|[^"\\])*"/g, encoded => {
      const decoded = JSON.parse(encoded) as string;
      const redacted = redactString(decoded);
      return redacted === decoded ? encoded : JSON.stringify(redacted);
    });
  } catch { return redactString(text); }
}
export function sanitized<T>(value: T): T { return JSON.parse(redact(JSON.stringify(value))); }
export function log(value: unknown) { console.log(redact(typeof value === "string" ? value : JSON.stringify(value, null, 2))); }
