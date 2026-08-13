export function normalizePath(p: string): string {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function canonicalPathKey(p: string): string {
  return normalizePath(p).toLowerCase();
}
