import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import { homeFor } from "../components/ProtectedRoute";
import { ErrorText } from "../components/ui";

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
      <section className="flex flex-1 flex-col justify-between gap-10 bg-brand p-10 text-white md:p-16">
        <div className="font-display text-3xl font-bold">MediSync</div>
        <div className="max-w-lg">
          <h1 className="font-display text-4xl leading-tight font-bold md:text-5xl">One platform for the whole OPD visit.</h1>
          <p className="mt-4 text-lg text-brand-soft">
            Appointments, token queue, consultation, e-prescriptions, pharmacy and ambulance service.
          </p>
        </div>
        <div className="text-sm text-brand-soft">Patient · Receptionist · Doctor · Pharmacist · Driver · Admin</div>
      </section>

      <section className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={onSubmit} className="card flex w-full max-w-md flex-col gap-5 p-10">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <ErrorText message={error} />
          <button className="btn-primary h-12" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-sm text-muted">
            New patient? <Link className="font-semibold text-brand" to="/register">Create an account</Link>
          </p>

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold text-muted uppercase">Demo logins (password123)</p>
            <div className="flex flex-wrap gap-2">
              {demoAccounts.map(([role, mail]) => (
                <button
                  type="button"
                  key={mail}
                  className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-page"
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
