import { BookOpen, KeyRound, LogOut, Menu, Plus } from "lucide-react";
import { setApiKey } from "../api";

type Props = {
  collection: string | null;
  onNewIngest: () => void;
  onOpenKeys: () => void;
  onOpenNav?: () => void;
};

export default function Topbar({
  collection,
  onNewIngest,
  onOpenKeys,
  onOpenNav,
}: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-3 md:gap-3 md:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpenNav}
          className="-ml-1 rounded-md p-2 text-muted hover:bg-panel-2 hover:text-text md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted">
            Collection
          </div>
          <h1 className="truncate text-sm font-semibold">
            {collection ?? "Select a collection"}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <a
          href="/docs/"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-2 p-2 text-xs font-medium text-muted hover:bg-panel hover:text-text md:px-3 md:py-1.5"
          title="Open the API documentation"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden md:inline">API docs</span>
        </a>
        <button
          onClick={onOpenKeys}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-2 p-2 text-xs font-medium text-muted hover:bg-panel hover:text-text md:px-3 md:py-1.5"
          title="Manage API keys"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span className="hidden md:inline">API keys</span>
        </button>
        <button
          onClick={onNewIngest}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent p-2 text-xs font-medium text-bg hover:bg-accent-2 md:px-3 md:py-1.5"
          aria-label="Dump JSON"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Dump JSON</span>
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                "Sign out of this dashboard session? You'll need to paste an API key again to come back.",
              )
            ) {
              setApiKey(null);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-2 p-2 text-xs font-medium text-muted hover:bg-panel hover:text-text md:px-3 md:py-1.5"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
