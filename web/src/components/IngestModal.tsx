import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../api";

type Props = {
  open: boolean;
  defaultCollection?: string;
  onClose: () => void;
  onIngested: (collection: string) => void;
};

const SAMPLE = `{
  "user": "alice",
  "event": "signup",
  "metadata": { "source": "web", "country": "ID" },
  "tags": ["beta", "newsletter"]
}`;

export default function IngestModal({ open, defaultCollection, onClose, onIngested }: Props) {
  const [name, setName] = useState(defaultCollection ?? "");
  const [json, setJson] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultCollection ?? "");
      setError(null);
    }
  }, [open, defaultCollection]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Collection name is required");
      let payload: unknown;
      try {
        payload = JSON.parse(json);
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      const result = await api.insert(trimmedName, payload);
      return { name: trimmedName, result };
    },
    onSuccess: ({ name: ingestedName }) => {
      onIngested(ingestedName);
    },
    onError: (e) => setError((e as Error).message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">Dump JSON into a collection</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-panel-2 hover:text-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          <label className="block text-xs">
            <span className="mb-1 block text-muted">Collection name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="events, users, my-data"
              className="w-full rounded-md border border-border bg-panel-2 px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-accent/50"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Created automatically on first write. Letters, digits, <code>._-</code>, no leading
              digit.
            </span>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              JSON payload — a single object, or an array of objects
            </span>
            <textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
              rows={10}
              className="w-full resize-y rounded-md border border-border bg-panel-2 px-3 py-2 font-mono text-xs leading-5 outline-none focus:ring-1 focus:ring-accent/50 sm:min-h-[14rem]"
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-panel-2 px-4 py-3 sm:px-5">
          <span className="hidden text-[11px] text-muted sm:inline">
            We add an <code>_ingestedAt</code> timestamp automatically.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs hover:bg-panel-2"
            >
              Cancel
            </button>
            <button
              disabled={mutation.isPending}
              onClick={() => {
                setError(null);
                mutation.mutate();
              }}
              className={clsx(
                "rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-bg hover:bg-accent-2",
                mutation.isPending && "opacity-60",
              )}
            >
              {mutation.isPending ? "Ingesting…" : "Ingest"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
