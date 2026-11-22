import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { User } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) return existing.dataset.loaded ? Promise.resolve() : new Promise((r) => existing.addEventListener("load", () => r()));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Couldn't load the sign-in script"));
    document.head.appendChild(s);
  });
}

/**
 * "Continue with Google / Facebook": signs in, or creates a patient account (no email code needed,
 * because Google/Facebook have already confirmed the email). Shown only when the server has the keys.
 */
export function SocialButtons({ onSignedIn, onError }: { onSignedIn: (u: User, created: boolean) => void; onError: (m: string) => void }) {
  const { setSession } = useAuth();
  const [config, setConfig] = useState<{ google: string | null; facebook: string | null } | null>(null);
  const [busy, setBusy] = useState<"google" | "facebook" | null>(null);
  const googleBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/auth/social-config").then((r) => setConfig(r.data)).catch(() => setConfig({ google: null, facebook: null }));
  }, []);

  const finish = (data: { token: string; user: User; created: boolean }) => {
    setSession(data.user, data.token);
    onSignedIn(data.user, data.created);
  };

  // Re-draw Google's button when the light/dark theme changes, so it always matches the page
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const watch = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, []);

  // Google draws its own button (required by Google's branding rules)
  useEffect(() => {
    if (!config?.google || !googleBox.current) return;
    let cancelled = false;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: config.google,
          callback: async (resp: { credential: string }) => {
            setBusy("google");
            try {
              finish((await api.post("/auth/google", { credential: resp.credential })).data);
            } catch (err) {
              onError(errorMessage(err));
            } finally {
              setBusy(null);
            }
          },
        });
        const width = Math.min(googleBox.current!.offsetWidth || 320, 400);
        googleBox.current!.innerHTML = "";
        window.google.accounts.id.renderButton(googleBox.current, { theme: dark ? "filled_black" : "outline", size: "large", text: "continue_with", shape: "pill", width });
      })
      .catch((e) => onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [config?.google, dark]); // eslint-disable-line react-hooks/exhaustive-deps

  async function facebook() {
    if (!config?.facebook) return;
    setBusy("facebook");
    try {
      if (!window.FB) {
        await loadScript("https://connect.facebook.net/en_US/sdk.js");
        window.FB.init({ appId: config.facebook, cookie: false, xfbml: false, version: "v19.0" });
      }
      const response: any = await new Promise((resolve) => window.FB.login(resolve, { scope: "email,public_profile" }));
      if (!response?.authResponse?.accessToken) {
        setBusy(null);
        return; // closed the pop-up
      }
      finish((await api.post("/auth/facebook", { accessToken: response.authResponse.accessToken })).data);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!config || (!config.google && !config.facebook)) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs font-semibold text-muted uppercase">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      {config.google && <div ref={googleBox} style={{ colorScheme: "light" }} className={`flex min-h-11 justify-center ${busy === "google" ? "pointer-events-none opacity-60" : ""}`} />}
      {config.facebook && (
        <button
          type="button"
          onClick={facebook}
          disabled={busy !== null}
          className="btn mx-auto w-full max-w-[400px] rounded-full bg-[#1877F2] text-white hover:bg-[#166fe5] hover:shadow-lg hover:shadow-[#1877F2]/25"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.09 24 12.07z" />
          </svg>
          {busy === "facebook" ? "Connecting…" : "Continue with Facebook"}
        </button>
      )}
    </div>
  );
}
