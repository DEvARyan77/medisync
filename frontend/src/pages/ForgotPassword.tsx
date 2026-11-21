import { FormEvent, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../components/ProtectedRoute";
import { ErrorText } from "../components/ui";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-start justify-center bg-page p-4 pt-16 sm:items-center sm:p-6 sm:pt-16">
      <ThemeToggle className="absolute top-4 right-4 w-11" />
      <div className="card flex w-full max-w-md animate-pop-in flex-col gap-5 shadow-xl shadow-slate-900/5 sm:p-10">{children}</div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(res.data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Forgot password</h1>
      {sent ? (
        <>
          <p className="animate-pop-in rounded-lg bg-brand-soft px-3 py-3 text-brand">{sent}</p>
          <p className="text-sm text-muted">The link expires in 30 minutes. Check your spam folder if you don't see it.</p>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <p className="text-sm text-muted">Enter your main or alternate email. We'll send a link to choose a new password to both addresses on your account.</p>
          <div>
            <label className="label" htmlFor="email">Main or alternate email</label>
            <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <ErrorText message={error} />
          <button className="btn-primary h-12" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <Link to="/login" className="text-center text-sm font-semibold text-brand">Back to sign in</Link>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The passwords do not match");
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/reset-password", { email, token, password });
      setSession(res.data.user, res.data.token);
      navigate(homeFor[res.data.user.role as keyof typeof homeFor], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token || !email) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Link not valid</h1>
        <p className="text-muted">This reset link is incomplete. Please request a new one.</p>
        <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="text-sm text-muted">For {email}</p>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <label className="label" htmlFor="pw">New password</label>
          <input id="pw" type="password" autoComplete="new-password" minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pw2">Confirm new password</label>
          <input id="pw2" type="password" autoComplete="new-password" minLength={6} className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <ErrorText message={error} />
        <button className="btn-primary h-12" disabled={busy}>{busy ? "Saving…" : "Save and sign in"}</button>
      </form>
      <Link to="/forgot-password" className="text-center text-sm font-semibold text-brand">Request a new link</Link>
    </Shell>
  );
}
