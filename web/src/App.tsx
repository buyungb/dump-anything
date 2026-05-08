import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DocumentsTable from "./components/DocumentsTable";
import IngestModal from "./components/IngestModal";
import JsonDrawer from "./components/JsonDrawer";
import ApiKeyGate from "./components/ApiKeyGate";
import ApiKeysModal from "./components/ApiKeysModal";
import type { DocumentItem } from "./api";

export default function App() {
  return (
    <ApiKeyGate>
      <Dashboard />
    </ApiKeyGate>
  );
}

function Dashboard() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [drawerDoc, setDrawerDoc] = useState<DocumentItem | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  const refresh = () => setRefetchKey((k) => k + 1);

  return (
    <div className="flex h-[100dvh] bg-bg text-text">
      <Sidebar
        selected={selectedCollection}
        onSelect={(name) => {
          setSelectedCollection(name);
          setNavOpen(false);
        }}
        refetchKey={refetchKey}
        mobileOpen={navOpen}
        onMobileClose={() => setNavOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar
          collection={selectedCollection}
          onNewIngest={() => setIngestOpen(true)}
          onOpenKeys={() => setKeysOpen(true)}
          onOpenNav={() => setNavOpen(true)}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedCollection ? (
            <DocumentsTable
              collection={selectedCollection}
              refetchKey={refetchKey}
              onRowClick={setDrawerDoc}
              onChanged={refresh}
            />
          ) : (
            <EmptyState onIngest={() => setIngestOpen(true)} />
          )}
        </div>
      </main>

      <IngestModal
        open={ingestOpen}
        onClose={() => setIngestOpen(false)}
        defaultCollection={selectedCollection ?? ""}
        onIngested={(name) => {
          setSelectedCollection(name);
          setIngestOpen(false);
          refresh();
        }}
      />

      <JsonDrawer
        doc={drawerDoc}
        collection={selectedCollection}
        onClose={() => setDrawerDoc(null)}
        onDeleted={() => {
          setDrawerDoc(null);
          refresh();
        }}
      />

      <ApiKeysModal open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}

function EmptyState({ onIngest }: { onIngest: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-panel-2 text-accent ring-1 ring-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14a9 3 0 0 0 18 0V5" />
            <path d="M3 12a9 3 0 0 0 18 0" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">No collection selected</h2>
        <p className="mt-2 text-sm text-muted">
          Pick a collection from the sidebar, or dump some JSON to create one.
          Collections are created automatically on first write.
        </p>
        <button
          onClick={onIngest}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-2"
        >
          Dump JSON
        </button>
      </div>
    </div>
  );
}
