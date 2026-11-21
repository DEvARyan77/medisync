import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
  hint?: string; // smaller grey text, e.g. a department
}

/**
 * A designed dropdown that replaces the browser's <select>: a button that opens an animated list.
 * Works with the keyboard (arrows, Enter, Escape, type a letter to jump) and screen readers (listbox).
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const listId = `${buttonId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (o: Option) => {
    onChange(o.value);
    setOpen(false);
    document.getElementById(buttonId)?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      return openList();
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        id={buttonId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={`input flex items-center justify-between gap-2 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99] ${open ? "border-brand ring-4 ring-brand/15" : ""} ${invalid ? "border-danger" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : placeholder}
          {selected?.hint && <span className="text-muted"> · {selected.hint}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className={`shrink-0 text-muted transition-transform duration-300 ease-(--ease-spring) ${open ? "rotate-180 text-brand" : ""}`}>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute z-50 mt-2 max-h-64 w-full origin-top animate-drop-in overflow-y-auto overscroll-contain rounded-xl border border-line bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nothing to choose</li>}
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value || "__empty"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${i === active ? "bg-brand-soft" : ""} ${isSel ? "font-semibold text-brand" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
                </span>
                {isSel && (
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 animate-pop">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
