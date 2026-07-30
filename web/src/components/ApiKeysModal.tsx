import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  api,
  getApiKey,
  setApiKey,
  type ApiKeyAuthType,
  type ApiKeyCreated,
  type ApiKeyView,
} from "../api";

type Props = { open: boolean; onClose: () => void };

export default function ApiKeysModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const keysQ = useQuery({
    queryKey: ["api-keys"],
    queryFn: api.listApiKeys,
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const [label, setLabel] = useState("");
  const [authType, setAuthType] = useState<ApiKeyAuthType>("bearer");
  const [createdPlain, setCreatedPlain] = useState<ApiKeyCreated | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setAuthType("bearer");
      setCreatedPlain(null);
      setError(null);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      api.createApiKey(label.trim() || "dashboard", authType),
    onSuccess: (data) => {
      setCreatedPlain(data);
      setLabel("");
      setAuthType("bearer");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const activeKey = getApiKey();
  const activeKeyPrefix = useMemo(
    () => (activeKey ? activeKey.slice(0, 9) : null),
    [activeKey],
  );

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: (e: Error) => setError(e.message),
  });

  if (!open) return null;

  const keys = keysQ.data?.keys ?? [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">API keys</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-panel-2 hover:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {createdPlain ? (
            <CreatedBanner
              data={createdPlain}
              onUseHere={() => {
                setApiKey(createdPlain.key);
                setCreatedPlain(null);
              }}
              onDismiss={() => setCreatedPlain(null)}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                create.mutate();
              }}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. ci-runner)"
                className="w-full flex-1 rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-accent/50"
              />
              <select
                value={authType}
                onChange={(e) =>
                  setAuthType(e.target.value as ApiKeyAuthType)
                }
                aria-label="Authorization type"
                className="w-full rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent/50 sm:w-auto"
              >
                <option value="bearer">Bearer</option>
                <option value="basic">Basic</option>
              </select>
              <button
                type="submit"
                disabled={create.isPending}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg hover:bg-accent-2 disabled:opacity-50 sm:w-auto"
              >
                {create.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create key
              </button>
            </form>
          )}

          <div className="rounded-lg border border-border bg-panel-2/50">
            <div className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Active &amp; revoked keys
            </div>
            {keysQ.isLoading && (
              <div className="px-4 py-6 text-center text-xs text-muted">
                Loading…
              </div>
            )}
            {keysQ.isError && (
              <div className="px-4 py-6 text-center text-xs text-danger">
                Failed to load keys.
              </div>
            )}
            {!keysQ.isLoading && keys.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-muted">
                No keys yet.
              </div>
            )}
            <ul className="divide-y divide-border">
              {keys.map((k) => (
                <KeyRow
                  key={k.id}
                  k={k}
                  isYou={!!activeKeyPrefix && k.prefix === activeKeyPrefix}
                  onRevoke={() => {
                    if (
                      confirm(
                        `Revoke "${k.label}" (${k.prefix})? This cannot be undone.`,
                      )
                    ) {
                      revoke.mutate(k.id);
                    }
                  }}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  k,
  isYou,
  onRevoke,
}: {
  k: ApiKeyView;
  isYou: boolean;
  onRevoke: () => void;
}) {
  const revoked = !!k.revoked_at;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-xs">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text">{k.label}</span>
          {isYou && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              this session
            </span>
          )}
          <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted ring-1 ring-border">
            {k.auth_type}
          </span>
          {revoked && (
            <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
              revoked
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <span>{k.prefix}…</span>
          <span>created {fmtDate(k.created_at)}</span>
          <span>
            {k.last_used_at ? `used ${fmtDate(k.last_used_at)}` : "unused"}
          </span>
        </div>
      </div>
      <button
        disabled={revoked}
        onClick={onRevoke}
        className={clsx(
          "rounded p-1.5",
          revoked
            ? "cursor-not-allowed text-muted/40"
            : "text-muted hover:bg-danger/10 hover:text-danger",
        )}
        title={revoked ? "Already revoked" : "Revoke key"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function CreatedBanner({
  data,
  onUseHere,
  onDismiss,
}: {
  data: ApiKeyCreated;
  onUseHere: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="text-xs font-semibold text-accent">
        New key created — copy it now, this is the only time it will be shown.
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-panel-2 px-2 py-1.5 font-mono text-xs">
          {data.key}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(data.key).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md bg-panel-2 px-2 py-1.5 text-xs hover:bg-panel-2/70"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="min-w-0">
          Label: <span className="text-text">{data.label}</span> · auth{" "}
          <span className="uppercase text-text">{data.auth_type}</span> ·
          prefix <code>{data.prefix}</code>
        </span>
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            onClick={onUseHere}
            className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-bg hover:bg-accent-2"
          >
            Use in this session
          </button>
          <button
            onClick={onDismiss}
            className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
