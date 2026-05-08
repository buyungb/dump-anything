import type { DocumentItem } from "../api";

export type FieldInfo = { path: string; type: string };

const MAX_FIELDS = 200;
const MAX_DEPTH = 3;

export function collectFields(items: DocumentItem[]): FieldInfo[] {
  const out = new Map<string, string>();
  const sample = items.slice(0, 50);

  function walk(value: unknown, prefix: string, depth: number) {
    if (out.size >= MAX_FIELDS) return;
    if (value === null || value === undefined) {
      if (prefix && !out.has(prefix)) out.set(prefix, "null");
      return;
    }
    if (Array.isArray(value)) {
      if (prefix && !out.has(prefix)) out.set(prefix, "array");
      if (depth >= MAX_DEPTH) return;
      const first = value.find(
        (v) => typeof v === "object" && v !== null && !Array.isArray(v),
      );
      if (first) walk(first, prefix, depth + 1);
      return;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value as object);
      const isExtJson =
        keys.length === 1 && keys[0].startsWith("$");
      if (isExtJson) {
        const k = keys[0];
        const friendly =
          k === "$oid" ? "objectId" : k === "$date" ? "date" : k.slice(1);
        if (prefix && !out.has(prefix)) out.set(prefix, friendly);
        return;
      }
      if (prefix && !out.has(prefix)) out.set(prefix, "object");
      if (depth >= MAX_DEPTH) return;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k.startsWith("$")) continue;
        const next = prefix ? `${prefix}.${k}` : k;
        walk(v, next, depth + 1);
      }
      return;
    }
    if (prefix && !out.has(prefix)) out.set(prefix, typeof value);
  }

  for (const item of sample) walk(item, "", 0);
  return sortFields(
    Array.from(out.entries()).map(([path, type]) => ({ path, type })),
  );
}

export function mergeFields(a: FieldInfo[], b: FieldInfo[]): FieldInfo[] {
  const map = new Map<string, string>();
  for (const f of a) map.set(f.path, f.type);
  for (const f of b) map.set(f.path, f.type);
  return sortFields(
    Array.from(map.entries()).map(([path, type]) => ({ path, type })),
  );
}

function sortFields(fields: FieldInfo[]): FieldInfo[] {
  const score = (p: string) =>
    p === "_id" ? 0 : p === "_ingestedAt" ? 1 : 2;
  return [...fields].sort((a, b) => {
    const sa = score(a.path);
    const sb = score(b.path);
    if (sa !== sb) return sa - sb;
    return a.path.localeCompare(b.path);
  });
}
