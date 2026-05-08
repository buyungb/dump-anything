import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowDownUp, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { api, extractId, type DocumentItem } from "../api";
import FilterInput from "./FilterInput";
import { collectFields, mergeFields, type FieldInfo } from "../lib/fieldPaths";

type Props = {
  collection: string;
  refetchKey: number;
  onRowClick: (doc: DocumentItem) => void;
  onChanged: () => void;
};

const PAGE_SIZES = [25, 50, 100, 200];

export default function DocumentsTable({
  collection,
  refetchKey,
  onRowClick,
  onChanged,
}: Props) {
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(50);
  const [sort, setSort] = useState("-_id");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [knownFields, setKnownFields] = useState<FieldInfo[]>([]);

  useEffect(() => {
    setSkip(0);
    setSort("-_id");
    setQ("");
    setFilter("");
    setKnownFields([]);
  }, [collection]);

  const docsQ = useQuery({
    queryKey: ["documents", collection, skip, limit, sort, filter, refetchKey],
    queryFn: () => api.listDocuments(collection, { skip, limit, sort, q: filter || undefined }),
  });

  const items = docsQ.data?.items ?? [];
  const total = docsQ.data?.total ?? 0;

  const columns = useMemo(() => buildColumns(items), [items]);

  useEffect(() => {
    if (items.length === 0) return;
    setKnownFields((prev) => mergeFields(prev, collectFields(items)));
  }, [items]);

  const page = Math.floor(skip / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2.5 md:px-5">
        <FilterInput
          value={q}
          onChange={setQ}
          onCommit={(v) => {
            setSkip(0);
            setFilter(v);
          }}
          fields={knownFields}
          placeholder='Filter (Mongo JSON, e.g. {"name":"alice"})'
          className="min-w-0 flex-[1_1_220px]"
        />
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-panel-2 px-2 py-1 text-xs">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted" />
          <input
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            placeholder="-_id"
            className="w-24 bg-transparent font-mono text-xs outline-none placeholder:text-muted"
          />
        </div>
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setSkip(0);
          }}
          className="rounded-md border border-border bg-panel-2 px-2 py-1 text-xs"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}/page
            </option>
          ))}
        </select>
        <button
          onClick={() => docsQ.refetch()}
          className="rounded-md border border-border bg-panel-2 p-1.5 text-muted hover:text-text"
          title="Refresh"
        >
          <RefreshCw
            className={clsx("h-3.5 w-3.5", docsQ.isFetching && "animate-spin")}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {docsQ.isError && (
          <div className="p-6 text-sm text-danger">
            Failed to load documents: {(docsQ.error as Error).message}
          </div>
        )}
        {!docsQ.isError && items.length === 0 && !docsQ.isLoading && (
          <div className="p-6 text-sm text-muted">No documents in this collection yet.</div>
        )}
        {items.length > 0 && (
          <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className={clsx(
                      "border-b border-border px-3 py-2 text-left font-semibold text-muted",
                      col === "_id" ? "w-[120px]" : "",
                      col === "_ingestedAt" ? "w-[180px]" : "",
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const id = extractId(row._id) ?? `row-${i}`;
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick(row)}
                    className="cursor-pointer transition hover:bg-panel-2"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="truncate border-b border-border px-3 py-2 align-top"
                        title={previewTitle(row[col])}
                      >
                        <CellValue value={row[col]} field={col} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-panel px-3 py-2 text-xs text-muted md:px-5">
        <div>
          {items.length > 0 ? (
            <>
              Showing <span className="text-text">{skip + 1}</span>–
              <span className="text-text">{skip + items.length}</span> of{" "}
              <span className="text-text">{total.toLocaleString()}</span>
            </>
          ) : (
            <>{total.toLocaleString()} documents</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page <span className="text-text">{page}</span> / {pages}
          </span>
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="rounded-md border border-border bg-panel-2 p-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
            className="rounded-md border border-border bg-panel-2 p-1 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <DangerZone collection={collection} onChanged={onChanged} />
    </div>
  );
}

function buildColumns(items: DocumentItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const ordered: string[] = [];
  if (counts.has("_id")) ordered.push("_id");
  if (counts.has("_ingestedAt")) ordered.push("_ingestedAt");
  for (const [k] of sorted) {
    if (k !== "_id" && k !== "_ingestedAt" && ordered.length < 8) ordered.push(k);
  }
  return ordered;
}

function previewTitle(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function CellValue({ value, field }: { value: unknown; field: string }) {
  if (value == null) return <span className="text-muted">—</span>;

  if (field === "_id") {
    const id = extractId(value);
    if (id) {
      return <span className="font-mono text-[11px] text-accent">{id.slice(-8)}</span>;
    }
  }

  if (field === "_ingestedAt" && typeof value === "object" && value && "$date" in (value as Record<string, unknown>)) {
    const d = (value as Record<string, unknown>).$date;
    if (typeof d === "string") {
      return <span className="font-mono text-[11px]">{new Date(d).toLocaleString()}</span>;
    }
  }

  if (typeof value === "string") return <span className="truncate">{value}</span>;
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
        [{value.length}]
      </span>
    );
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return (
      <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
        {"{"}
        {keys.length}
        {"}"}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

function DangerZone({
  collection,
  onChanged,
}: {
  collection: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-end border-t border-border bg-panel px-3 py-1.5 text-[11px] text-muted md:px-5">
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Drop collection "${collection}"? This cannot be undone.`)) return;
          setBusy(true);
          try {
            await api.dropCollection(collection);
            onChanged();
          } catch (e) {
            alert((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-red-500/10 hover:text-danger disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Drop collection
      </button>
    </div>
  );
}
