import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Database, RefreshCw, X } from "lucide-react";
import { api } from "../api";

type Props = {
  selected: string | null;
  onSelect: (name: string) => void;
  refetchKey: number;
  /** When true, the sidebar slides in as an overlay on mobile (`< md`). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({
  selected,
  onSelect,
  refetchKey,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const collectionsQ = useQuery({
    queryKey: ["collections"],
    queryFn: api.listCollections,
    refetchInterval: 15_000,
  });
  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    collectionsQ.refetch();
  }, [refetchKey]);

  const collections = collectionsQ.data?.collections ?? [];
  const totalDocs = collections.reduce((sum, c) => sum + c.count, 0);

  return (
    <>
      {/* Mobile backdrop — only rendered while the drawer is open */}
      <div
        className={clsx(
          "fixed inset-0 z-30 bg-black/60 transition-opacity duration-200 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={clsx(
          "z-40 flex min-h-0 w-72 flex-col border-r border-border bg-panel",
          // Mobile (< md): fixed slide-over on the left.
          "fixed inset-y-0 left-0 transform transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // ≥ md: static column in the layout, no transform.
          "md:static md:w-[260px] md:translate-x-0 md:transition-none",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-accent ring-1 ring-border">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">Dump Anything</div>
              <div className="truncate text-[11px] text-muted">
                {collections.length} collections · {totalDocs.toLocaleString()} docs
              </div>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="rounded p-1 text-muted hover:bg-panel-2 hover:text-text md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Collections
        </span>
        <button
          onClick={() => collectionsQ.refetch()}
          className="rounded p-1 text-muted hover:bg-panel-2 hover:text-text"
          aria-label="Refresh collections"
          title="Refresh"
        >
          <RefreshCw
            className={clsx("h-3.5 w-3.5", collectionsQ.isFetching && "animate-spin")}
          />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {collectionsQ.isLoading && (
          <div className="px-3 py-2 text-xs text-muted">Loading…</div>
        )}
        {collectionsQ.isError && (
          <div className="px-3 py-2 text-xs text-danger">
            Cannot reach API
            {import.meta.env.VITE_API_URL ? (
              <>
                {" at "}
                <code>{import.meta.env.VITE_API_URL}</code>
              </>
            ) : (
              <> at this origin</>
            )}
          </div>
        )}
        {collections.length === 0 && !collectionsQ.isLoading && !collectionsQ.isError && (
          <div className="px-3 py-2 text-xs text-muted">
            No collections yet. Dump some JSON to get started.
          </div>
        )}
        {collections.map((c) => {
          const active = c.name === selected;
          return (
            <button
              key={c.name}
              onClick={() => onSelect(c.name)}
              className={clsx(
                "group flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition",
                active
                  ? "bg-panel-2 text-text ring-1 ring-border"
                  : "text-muted hover:bg-panel-2 hover:text-text",
              )}
            >
              <span className="truncate font-medium">{c.name}</span>
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-accent/15 text-accent" : "bg-panel text-muted",
                )}
              >
                {c.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <HealthPill ok={healthQ.data?.mongo} />
      </div>
      </aside>
    </>
  );
}

function HealthPill({ ok }: { ok?: boolean }) {
  // Three visual tones, but only two user-facing labels:
  //   - `ok`      → "online"   (green)
  //   - `down`    → "offline"  (red)
  //   - `unknown` → "offline"  (muted, while the first /health probe is in flight)
  // We deliberately hide the database name: the sidebar is space-constrained on
  // mobile and "online/offline" is what users actually want to see at a glance.
  const tone = ok == null ? "unknown" : ok ? "ok" : "down";
  const label = tone === "ok" ? "online" : "offline";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">Status</span>
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
          tone === "ok" && "bg-accent/15 text-accent",
          tone === "down" && "bg-red-500/15 text-danger",
          tone === "unknown" && "bg-panel-2 text-muted",
        )}
      >
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            tone === "ok" && "bg-accent",
            tone === "down" && "bg-danger",
            tone === "unknown" && "bg-muted",
          )}
        />
        {label}
      </span>
    </div>
  );
}
