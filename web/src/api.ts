export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const API_KEY_STORAGE = "dump-anything-api-key";

export type CollectionInfo = { name: string; count: number };
export type CollectionsResponse = { collections: CollectionInfo[] };

export type DocumentItem = Record<string, unknown> & { _id?: unknown };

export type DocumentsResponse = {
  items: DocumentItem[];
  total: number;
  limit: number;
  skip: number;
};

export type InsertResponse = {
  inserted: number;
  ids: string[];
};

export type HealthResponse = {
  status: "ok" | "degraded";
  database: string;
  mongo: boolean;
};

export type ApiKeyView = {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type ApiKeysResponse = { keys: ApiKeyView[] };

export type ApiKeyCreated = ApiKeyView & {
  /** Plaintext key — shown ONCE on creation, never again. */
  key: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---- API key handling -----------------------------------------------------

type Listener = (key: string | null) => void;
const listeners = new Set<Listener>();

export function getApiKey(): string | null {
  try {
    const raw = window.localStorage.getItem(API_KEY_STORAGE);
    return raw && raw.trim() !== "" ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null): void {
  try {
    if (key && key.trim() !== "") {
      window.localStorage.setItem(API_KEY_STORAGE, key.trim());
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE);
    }
  } catch {
    // ignore — storage may be disabled
  }
  for (const fn of listeners) fn(getApiKey());
}

export function subscribeApiKey(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- core fetch wrapper ---------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const key = getApiKey();
  if (key && path.startsWith("/api/")) {
    headers["X-API-Key"] = key;
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && path.startsWith("/api/")) {
      // Stored key is missing/invalid/revoked — clear it so the gate prompts.
      setApiKey(null);
    }
    throw new ApiError(
      data?.message ?? `Request failed: ${res.status}`,
      res.status,
      data?.error,
    );
  }
  return data as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listCollections: () => request<CollectionsResponse>("/api/collections"),
  dropCollection: (name: string) =>
    request<{ dropped: boolean; name: string }>(
      `/api/collections/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    ),
  listDocuments: (
    name: string,
    opts: { limit?: number; skip?: number; sort?: string; q?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set("limit", String(opts.limit));
    if (opts.skip != null) params.set("skip", String(opts.skip));
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.q) params.set("q", opts.q);
    const qs = params.toString();
    return request<DocumentsResponse>(
      `/api/collections/${encodeURIComponent(name)}/documents${qs ? `?${qs}` : ""}`,
    );
  },
  getDocument: (name: string, id: string) =>
    request<DocumentItem>(
      `/api/collections/${encodeURIComponent(name)}/documents/${encodeURIComponent(id)}`,
    ),
  deleteDocument: (name: string, id: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/collections/${encodeURIComponent(name)}/documents/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  insert: (name: string, payload: unknown) =>
    request<InsertResponse>(
      `/api/collections/${encodeURIComponent(name)}/documents`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  // -------- API key management --------
  listApiKeys: () => request<ApiKeysResponse>("/api/keys"),
  createApiKey: (label: string) =>
    request<ApiKeyCreated>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  revokeApiKey: (id: string) =>
    request<{ revoked: boolean; id: string }>(
      `/api/keys/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
};

export function extractId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "$oid" in (value as Record<string, unknown>)) {
    const oid = (value as Record<string, unknown>).$oid;
    if (typeof oid === "string") return oid;
  }
  return undefined;
}
