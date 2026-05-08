import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { FieldInfo } from "../lib/fieldPaths";
import { OPERATORS, getQueryContext } from "../lib/operators";

const TOKEN_REGEX = /[A-Za-z0-9_.\-$]*$/;
const MAX_SUGGESTIONS = 12;
const EMPTY: FieldInfo[] = [];

type Props = {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  fields: FieldInfo[];
  placeholder?: string;
  className?: string;
};

export default function FilterInput({
  value,
  onChange,
  onCommit,
  fields,
  placeholder,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [highlight, setHighlight] = useState(0);

  const { token, tokenStart } = useMemo(() => {
    const before = value.slice(0, cursor);
    const m = before.match(TOKEN_REGEX);
    const t = m?.[0] ?? "";
    return { token: t, tokenStart: cursor - t.length };
  }, [value, cursor]);

  const ctx = useMemo(() => getQueryContext(value, cursor), [value, cursor]);

  const mode: "field" | "operator" | "value" =
    token.startsWith("$") ? "operator" : ctx;

  const source =
    mode === "operator" ? OPERATORS : mode === "field" ? fields : EMPTY;

  const suggestions = useMemo(() => {
    const t = token.toLowerCase();
    if (!t) return source.slice(0, MAX_SUGGESTIONS);
    const prefix: FieldInfo[] = [];
    const sub: FieldInfo[] = [];
    for (const f of source) {
      const lower = f.path.toLowerCase();
      if (lower.startsWith(t)) prefix.push(f);
      else if (lower.includes(t)) sub.push(f);
    }
    return [...prefix, ...sub].slice(0, MAX_SUGGESTIONS);
  }, [source, token]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handleFocus = () => setFocused(true);
    const handleBlur = () => {
      window.setTimeout(() => setFocused(false), 100);
    };
    el.addEventListener("focus", handleFocus);
    el.addEventListener("blur", handleBlur);
    return () => {
      el.removeEventListener("focus", handleFocus);
      el.removeEventListener("blur", handleBlur);
    };
  }, []);

  const showDropdown =
    focused && mode !== "value" && suggestions.length > 0;

  const headerLabel = mode === "operator" ? "Operators" : "Fields";
  const headerSuffix = token
    ? ` matching "${token}"`
    : mode === "field"
      ? " in this collection"
      : "";

  const insertField = (field: string) => {
    const before = value.slice(0, tokenStart);
    const after = value.slice(cursor);
    const next = before + field + after;
    onChange(next);
    requestAnimationFrame(() => {
      const newPos = (before + field).length;
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newPos, newPos);
        setCursor(newPos);
      }
    });
  };

  return (
    <div className={clsx("relative", className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart ?? e.target.value.length);
          setFocused(true);
        }}
        onClick={(e) => {
          setCursor(e.currentTarget.selectionStart ?? 0);
          setFocused(true);
        }}
        onSelect={(e) => {
          setCursor(e.currentTarget.selectionStart ?? 0);
          setFocused(true);
        }}
        onBlur={() => {
          onCommit(value);
        }}
        onKeyDown={(e) => {
          setFocused(true);
          if (showDropdown) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight(
                (h) => (h - 1 + suggestions.length) % suggestions.length,
              );
              return;
            }
            if (e.key === "Tab" && suggestions[highlight]) {
              e.preventDefault();
              insertField(suggestions[highlight].path);
              return;
            }
            if (e.key === "Enter" && token && suggestions[highlight]) {
              e.preventDefault();
              insertField(suggestions[highlight].path);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setFocused(false);
              return;
            }
          }
          if (e.key === "Enter") onCommit(value);
          if (e.key === "Escape") {
            onChange("");
            onCommit("");
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-panel-2 px-2.5 py-1.5 font-mono text-xs outline-none placeholder:text-muted focus:ring-1 focus:ring-accent/50"
      />
      {showDropdown && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-panel shadow-2xl"
        >
          <div className="border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
            {headerLabel}
            {headerSuffix}
            <span className="ml-1 normal-case tracking-normal text-muted/70">
              · Tab/Enter to insert
            </span>
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s.path}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertField(s.path);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx(
                "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-mono text-xs",
                i === highlight
                  ? "bg-panel-2 text-text"
                  : "text-text/80 hover:bg-panel-2",
              )}
            >
              <span className="truncate">{highlightMatch(s.path, token)}</span>
              <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">
                {s.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function highlightMatch(path: string, token: string) {
  if (!token) return <>{path}</>;
  const lower = path.toLowerCase();
  const idx = lower.indexOf(token.toLowerCase());
  if (idx < 0) return <>{path}</>;
  return (
    <>
      <span>{path.slice(0, idx)}</span>
      <span className="text-accent">{path.slice(idx, idx + token.length)}</span>
      <span>{path.slice(idx + token.length)}</span>
    </>
  );
}
