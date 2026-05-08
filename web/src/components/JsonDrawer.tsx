import { useState } from "react";
import JsonView from "@uiw/react-json-view";
import { Copy, Trash2, X } from "lucide-react";
import { api, extractId, type DocumentItem } from "../api";

type Props = {
  doc: DocumentItem | null;
  collection: string | null;
  onClose: () => void;
  onDeleted: () => void;
};

export default function JsonDrawer({ doc, collection, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  if (!doc) return null;
  const id = extractId(doc._id);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted">Document</div>
            <div className="truncate font-mono text-xs text-accent">{id ?? "(no id)"}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(doc, null, 2))}
              className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-text"
              title="Copy JSON"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              disabled={!id || !collection || busy}
              onClick={async () => {
                if (!id || !collection) return;
                if (!confirm("Delete this document?")) return;
                setBusy(true);
                try {
                  await api.deleteDocument(collection, id);
                  onDeleted();
                } catch (e) {
                  alert((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-danger disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-muted hover:bg-panel-2 hover:text-text"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <JsonView
            value={doc as object}
            collapsed={2}
            displayDataTypes={false}
            enableClipboard={false}
            style={{
              backgroundColor: "transparent",
              fontSize: "12.5px",
              // CSS var names below are for @uiw/react-json-view ≥ 2.0
              // (the v1 ones, e.g. --w-rjv-color-string, are no-ops here).
              // Palette matches the dashboard tokens defined in
              // tailwind.config.js (emerald accent on a zinc-ish base).
              ["--w-rjv-color" as string]: "#e6e8ee",
              ["--w-rjv-key-string" as string]: "#e6e8ee",
              ["--w-rjv-key-number" as string]: "#e6e8ee",
              ["--w-rjv-type-string-color" as string]: "#6ee7b7",
              ["--w-rjv-type-int-color" as string]: "#7dd3fc",
              ["--w-rjv-type-float-color" as string]: "#7dd3fc",
              ["--w-rjv-type-bigint-color" as string]: "#7dd3fc",
              ["--w-rjv-type-boolean-color" as string]: "#fbbf24",
              ["--w-rjv-type-date-color" as string]: "#67e8f9",
              ["--w-rjv-type-url-color" as string]: "#7dd3fc",
              ["--w-rjv-type-null-color" as string]: "#c4b5fd",
              ["--w-rjv-type-nan-color" as string]: "#c4b5fd",
              ["--w-rjv-type-undefined-color" as string]: "#c4b5fd",
              ["--w-rjv-quotes-color" as string]: "#8a93a6",
              ["--w-rjv-quotes-string-color" as string]: "#8a93a6",
              ["--w-rjv-curlybraces-color" as string]: "#8a93a6",
              ["--w-rjv-brackets-color" as string]: "#8a93a6",
              ["--w-rjv-colon-color" as string]: "#8a93a6",
              ["--w-rjv-ellipsis-color" as string]: "#8a93a6",
              ["--w-rjv-arrow-color" as string]: "#8a93a6",
              ["--w-rjv-info-color" as string]: "#8a93a64d",
              ["--w-rjv-line-color" as string]: "#232838",
              ["--w-rjv-update-color" as string]: "#10b98133",
              ["--w-rjv-copied-color" as string]: "#34d399",
              ["--w-rjv-copied-success-color" as string]: "#10b981",
              ["--w-rjv-edit-color" as string]: "#e6e8ee",
            }}
          />
        </div>
      </div>
    </div>
  );
}
