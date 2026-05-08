import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { API_URL, ApiError, getApiKey, setApiKey, subscribeApiKey } from "../api";

type Props = { children: ReactNode };

export default function ApiKeyGate({ children }: Props) {
  const [apiKey, setLocalKey] = useState<string | null>(() => getApiKey());

  useEffect(() => subscribeApiKey(setLocalKey), []);

  if (!apiKey) return <KeyPrompt />;
  return <>{children}</>;
}

function KeyPrompt() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Paste your API key first.");
      return;
    }
    if (!/^da_[0-9a-f]{6,}/.test(trimmed)) {
      setError(
        "That doesn't look like a key. Expected something like da_<32 hex chars> — make sure you copied only the value after key:",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Validate the candidate WITHOUT committing it to localStorage first
      // so we don't briefly flash the dashboard on bad input.
      const res = await fetch(`${API_URL}/api/collections`, {
        headers: { "X-API-Key": trimmed },
      });
      if (res.status === 401) {
        // Distinguish nginx Basic Auth 401 (HTML, WWW-Authenticate: Basic) from
        // the API's JSON 401 so we don't blame the API key for a stale
        // browser auth cache.
        const wwwAuth = res.headers.get("www-authenticate") ?? "";
        if (/basic/i.test(wwwAuth)) {
          setError(
            "The dashboard's HTTP basic auth challenged this request. Refresh the page and re-enter the basic auth credentials, then try again.",
          );
          return;
        }
        // Try to surface the API's own error message.
        let body: { error?: string; message?: string } | null = null;
        try {
          body = await res.clone().json();
        } catch {
          // not JSON — fall through to generic message
        }
        setError(
          body?.message
            ? `Rejected: ${body.message}`
            : "Key is invalid or revoked. If you set BOOTSTRAP_API_KEY in your env panel after the first deploy, that value is only honoured after redeploying — until then, the auto-generated key in the server logs is the only one that works.",
        );
        return;
      }
      if (!res.ok) {
        setError(`API responded ${res.status}.`);
        return;
      }
      // Only persist after the candidate successfully authenticates.
      setApiKey(trimmed);
    } catch (e) {
      setLocalErrorFromException(e, setError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg p-6 text-text">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-2 text-accent ring-1 ring-border">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold">API key required</h1>
            <p className="text-xs text-muted">
              Every request to <code className="text-text/80">/api</code> must
              carry a valid <code>X-API-Key</code> header.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-medium text-muted">
            API key
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="password"
            autoFocus
            spellCheck={false}
            placeholder="da_…"
            className="w-full rounded-md border border-border bg-panel-2 px-3 py-2 font-mono text-sm outline-none placeholder:text-muted focus:ring-1 focus:ring-accent/50"
          />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg hover:bg-accent-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save & continue
          </button>
        </form>

        <p className="mt-5 text-[11px] leading-relaxed text-muted">
          First time? The server logs a one-time bootstrap key on startup —
          look for <code>BOOTSTRAP API KEY</code> in{" "}
          <code>docker compose logs app</code>. After logging in you can
          create labelled keys and revoke the bootstrap one.
        </p>
      </div>
    </div>
  );
}

function setLocalErrorFromException(
  e: unknown,
  setError: (s: string) => void,
) {
  if (e instanceof ApiError) {
    if (e.status === 401) setError("Key is invalid or revoked.");
    else if (e.status === 0 || e.message.toLowerCase().includes("failed"))
      setError("Cannot reach the API.");
    else setError(e.message);
  } else if (e instanceof Error) {
    setError(e.message);
  } else {
    setError("Something went wrong.");
  }
}
