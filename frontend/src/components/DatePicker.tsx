import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

// Dates are plain "YYYY-MM-DD" strings everywhere in the app, so no time-zone surprises.
// Internally they're turned into UTC-midnight Date objects just for calendar maths.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const toStr = (d: Date) => d.toISOString().slice(0, 10);
export const localToday = () => new Date().toLocaleDateString("en-CA");
export const addDaysStr = (s: string, n: number) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
};
const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
const addMonths = (s: string, n: number) => {
  const d = toDate(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toStr(d);
};

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  return s ? toDate(s).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" }) : "";
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Show month + year dropdowns (handy for birth dates far in the past). */
  yearPicker?: boolean;
  /** Allow clearing the value. */
  clearable?: boolean;
  /** Extra reason a date can't be picked. */
  isDisabled?: (date: string) => boolean;
  ariaDescribedBy?: string;
  /** Open the calendar aligned to the right edge (for pickers near the right of the screen). */
  alignRight?: boolean;
}

export function DatePicker({ id, value, onChange, min, max, placeholder = "Select a date", yearPicker, clearable, isDisabled, ariaDescribedBy, alignRight }: Props) {
  const [open, setOpen] = useState(false);
  const today = localToday();
  const start = value || (max && today > max ? max : min && today < min ? min : today);
  const [view, setView] = useState(monthStart(start)); // first day of the month being shown
  const [focus, setFocus] = useState(start); // day with keyboard focus
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const disabled = (d: string) => (min !== undefined && d < min) || (max !== undefined && d > max) || !!isDisabled?.(d);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep keyboard focus on the focused day.
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, focus, view]);

  function openPicker() {
    const s = value || start;
    setView(monthStart(s));
    setFocus(s);
    setOpen(true);
  }

  function pick(d: string) {
    if (disabled(d)) return;
    onChange(d);
    setOpen(false);
    wrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function moveFocus(d: string) {
    setFocus(d);
    if (d.slice(0, 7) !== view.slice(0, 7)) setView(monthStart(d));
  }

  function onGridKey(e: KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[e.key] !== undefined) {
      e.preventDefault();
      moveFocus(addDaysStr(focus, moves[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      moveFocus(addMonths(focus, e.key === "PageUp" ? -1 : 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focus);
    }
  }

  // 6 weeks x 7 days, starting on the Sunday before the 1st.
  const first = toDate(view);
  const gridStart = addDaysStr(view, -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDaysStr(gridStart, i));
  const viewYear = first.getUTCFullYear();
  const viewMonth = first.getUTCMonth();

  const minYear = min ? Number(min.slice(0, 4)) : viewYear - 100;
  const maxYear = max ? Number(max.slice(0, 4)) : viewYear + 5;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const prevDisabled = min !== undefined && addMonths(view, 0) <= monthStart(min);
  const nextDisabled = max !== undefined && addMonths(view, 1) > max;

  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => e.key === "Escape" && open && (e.stopPropagation(), setOpen(false))}>
      <button
        id={id}
        type="button"
        className={`input flex items-center justify-between gap-2 text-left ${open ? "border-brand ring-4 ring-brand/15" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={ariaDescribedBy}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className={value ? "" : "text-muted"}>{value ? formatDate(value) : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brand" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={`absolute z-[1100] mt-2 w-[min(20rem,calc(100vw-2rem))] animate-drop-in ${alignRight ? "left-0 origin-top-left sm:right-0 sm:left-auto sm:origin-top-right" : "left-0 origin-top-left"} rounded-2xl border border-line bg-white p-3 shadow-2xl shadow-slate-900/15`}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <NavButton label="Previous month" disabled={prevDisabled} onClick={() => setView(addMonths(view, -1))} dir="left" />
            {yearPicker ? (
              <div className="flex gap-1">
                <label className="sr-only" htmlFor={`${id}-m`}>Month</label>
                <select
                  id={`${id}-m`}
                  className="mini-select"
                  value={viewMonth}
                  onChange={(e) => setView(`${viewYear}-${String(Number(e.target.value) + 1).padStart(2, "0")}-01`)}
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m.slice(0, 3)}</option>)}
                </select>
                <label className="sr-only" htmlFor={`${id}-y`}>Year</label>
                <select
                  id={`${id}-y`}
                  className="mini-select"
                  value={viewYear}
                  onChange={(e) => setView(`${e.target.value}-${String(viewMonth + 1).padStart(2, "0")}-01`)}
                >
                  {years.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            ) : null}
            <span id={titleId} className={yearPicker ? "sr-only" : "font-display text-base font-bold"} aria-live="polite">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <NavButton label="Next month" disabled={nextDisabled} onClick={() => setView(addMonths(view, 1))} dir="right" />
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted" aria-hidden="true">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>

          <div ref={grid} role="grid" aria-labelledby={titleId} className="grid grid-cols-7 gap-0.5" onKeyDown={onGridKey}>
            {days.map((d) => {
              const inMonth = d.slice(0, 7) === view.slice(0, 7);
              const isSel = d === value;
              const isToday = d === today;
              const off = disabled(d);
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  data-date={d}
                  tabIndex={d === focus ? 0 : -1}
                  aria-selected={isSel}
                  aria-disabled={off}
                  aria-label={`${formatDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${isToday ? ", today" : ""}${off ? ", not available" : ""}`}
                  onClick={() => pick(d)}
                  className={[
                    "relative flex h-10 items-center justify-center rounded-xl text-sm transition-[transform,background-color,color] duration-300 ease-(--ease-spring)",
                    off ? "cursor-not-allowed text-slate-300 line-through decoration-slate-300" : "hover:scale-110 hover:bg-brand-soft active:scale-90",
                    !inMonth && !off ? "text-slate-400" : "",
                    isSel ? "animate-pop bg-brand font-bold text-white shadow-md shadow-brand/30 hover:bg-brand" : "",
                    isToday && !isSel ? "font-bold text-brand ring-2 ring-brand/40 ring-inset" : "",
                  ].join(" ")}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-brand transition-transform duration-300 ease-(--ease-spring) hover:bg-brand-soft active:scale-95 disabled:opacity-40"
              disabled={disabled(today)}
              onClick={() => pick(today)}
            >
              Today
            </button>
            {clearable && value && (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-transform duration-300 ease-(--ease-spring) hover:bg-page active:scale-95"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, disabled, dir }: { label: string; onClick: () => void; disabled?: boolean; dir: "left" | "right" }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-(--ease-spring) hover:scale-110 hover:bg-brand-soft active:scale-90 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

/**
 * Quick-pick strip of upcoming days for booking (like the date row in a ticket app),
 * with the full calendar behind "More dates".
 */
export function DateStrip({ value, onChange, min, max, days = 14, id }: { value: string; onChange: (v: string) => void; min: string; max?: string; days?: number; id: string }) {
  const list = Array.from({ length: days }, (_, i) => addDaysStr(min, i)).filter((d) => !max || d <= max);
  const inStrip = list.includes(value);
  const strip = useRef<HTMLDivElement>(null);

  // Keep the chosen day in view when it changes.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-date="${value}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={strip} className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2" role="listbox" aria-label="Choose a date">
        {list.map((d, i) => {
          const sel = d === value;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={sel}
              data-date={d}
              onClick={() => onChange(d)}
              style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
              className={[
                "flex w-16 shrink-0 animate-pop-in snap-start flex-col items-center rounded-2xl border py-2 transition-[transform,background-color,box-shadow,border-color] duration-300 ease-(--ease-spring)",
                sel ? "scale-105 border-brand bg-brand text-white shadow-lg shadow-brand/30" : "border-line bg-white hover:-translate-y-1 hover:border-brand/50 hover:shadow-md active:scale-95",
              ].join(" ")}
            >
              <span className={`text-[11px] font-semibold uppercase ${sel ? "text-brand-soft" : "text-muted"}`}>
                {i === 0 && d === localToday() ? "Today" : formatDate(d, { weekday: "short" })}
              </span>
              <span className="font-display text-xl leading-tight font-bold">{Number(d.slice(8))}</span>
              <span className={`text-[11px] ${sel ? "text-brand-soft" : "text-muted"}`}>{formatDate(d, { month: "short" })}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <label className="sr-only" htmlFor={id}>Pick any date</label>
          <DatePicker id={id} value={inStrip ? "" : value} onChange={onChange} min={min} max={max} placeholder="More dates…" />
        </div>
        {value && <span className="text-sm text-muted">Selected: <b className="text-slate-900">{formatDate(value)}</b></span>}
      </div>
    </div>
  );
}
