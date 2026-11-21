import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import { homeFor } from "../components/ProtectedRoute";
import { ErrorText } from "../components/ui";
import { SocialButtons } from "../components/SocialButtons";

const demoAccounts = [
  ["Patient", "patient@medisync.dev"],
  ["Receptionist", "reception@medisync.dev"],
  ["Doctor", "arjun@medisync.dev"],
  ["Pharmacist", "pharmacy@medisync.dev"],
  ["Driver", "driver@medisync.dev"],
  ["Admin", "admin@medisync.dev"],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const deleted = new URLSearchParams(window.location.search).has("deleted");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor[user.role]} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      navigate(homeFor[u.role]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page md:flex-row">
      {/* Brand panel: tablets and desktops only. Phones get just the form. */}
      <section className="hidden flex-1 flex-col justify-between gap-10 bg-brand p-16 text-white md:flex">
        <Link to="/" className="font-display text-3xl font-bold">MediSync</Link>
        <div className="max-w-lg">
          <h1 className="font-display text-5xl leading-tight font-bold">One platform for the whole OPD visit.</h1>
          <p className="mt-4 text-lg text-brand-soft">
            Appointments, token queue, consultation, e-prescriptions, pharmacy and ambulance service.
          </p>
        </div>
        <div aria-hidden="true" />
      </section>

      <section className="flex flex-1 items-start justify-center p-4 sm:p-6 md:items-center">
        <form onSubmit={onSubmit} className="card flex w-full max-w-md animate-pop-in flex-col gap-5 shadow-xl shadow-slate-900/5 sm:p-10">
          <h2 className="text-2xl font-bold">Sign in</h2>
          {deleted && <p className="animate-pop-in rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">Your account has been deleted. Take care!</p>}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="-mt-3 text-right">
            <Link to="/forgot-password" className="text-sm font-semibold text-brand">Forgot password?</Link>
          </div>
          <ErrorText message={error} />
          <button className="btn-primary h-12" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <SocialButtons onSignedIn={(u) => navigate(homeFor[u.role])} onError={setError} />
          <p className="text-center text-sm text-muted">
            New patient? <Link className="font-semibold text-brand" to="/register">Create an account</Link>
          </p>

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold text-muted uppercase">Demo logins (password123)</p>
            <div className="stagger flex flex-wrap gap-2">
              {demoAccounts.map(([role, mail]) => (
                <button
                  type="button"
                  key={mail}
                  className="rounded-full border border-line px-3 py-1.5 text-sm transition-transform duration-300 ease-(--ease-spring) hover:-translate-y-0.5 hover:border-brand hover:bg-brand-soft active:scale-90"
                  onClick={() => {
                    setEmail(mail);
                    setPassword("password123");
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
