import { useEffect, useState } from "react";

const isDark = () => document.documentElement.classList.contains("dark");

/** Light / dark switch. The choice is remembered in this browser. */
export function ThemeToggle({ withLabel = false, className = "" }: { withLabel?: boolean; className?: string }) {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // storage blocked: the theme lasts until reload
    }
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white font-semibold text-slate-700 transition-[transform,background-color,color] duration-300 ease-(--ease-spring) hover:bg-page active:scale-95 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        className="transition-transform duration-500 ease-(--ease-spring)" style={{ transform: dark ? "rotate(-25deg)" : "rotate(0)" }}>
        {dark ? (
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      {withLabel && <span>{dark ? "Dark" : "Light"} theme</span>}
    </button>
  );
}
