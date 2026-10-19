export function success(label: string, color: boolean): string {
  return color ? `\u001b[32m${label}\u001b[39m` : label;
}
