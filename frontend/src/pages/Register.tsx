import { FormEvent, useEffect, useRef, useState } from "react";
import { Select } from "../components/Select";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage } from "../api/client";
import { ErrorText } from "../components/ui";
import { DatePicker, localToday } from "../components/DatePicker";
import { SocialButtons } from "../components/SocialButtons";

/**
 * Patient sign-up in two steps: fill in the details, then enter the 6-digit code we email.
 * No account exists until the code is right, so nobody can sign up with someone else's email.
 */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", alternateEmail: "", password: "", phone: "", gender: "male", dateOfBirth: "", allergies: "" });
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Use at least 6 characters for your password.");
    setBusy(true);
    try {
      const r = await api.post("/auth/register/send-code", { email: form.email.trim() });
      setInfo(r.data.message);
      setStep("code");
      setCode("");
      setCooldown(60);
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      await register({
        ...form,
        email: form.email.trim(),
        otp: code,
        dateOfBirth: form.dateOfBirth || undefined,
        allergies: form.allergies.split(",").map((a) => a.trim()).filter(Boolean),
      });
      navigate("/patient");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-page p-4 sm:items-center sm:p-6">
      {step === "details" ? (
        <form onSubmit={sendCode} className="card grid w-full max-w-xl animate-pop-in gap-4 shadow-xl shadow-slate-900/5 sm:grid-cols-2 sm:p-10">
          <div className="sm:col-span-2">
            <h1 className="text-2xl font-bold">Create patient account</h1>
            <p className="mt-1 text-sm text-muted">We'll email you a code to confirm it's your address.</p>
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={form.name} onChange={set("name")} required minLength={2} /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="input" value={form.email} onChange={set("email")} required /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" autoComplete="new-password" minLength={6} className="input" value={form.password} onChange={set("password")} required /></div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="altEmail">Alternate email <span className="font-normal text-muted">(optional)</span></label>
            <input id="altEmail" type="email" className="input" value={form.alternateEmail} onChange={set("alternateEmail")} aria-describedby="alt-note" />
            <p id="alt-note" className="mt-1 text-xs text-muted">Gets a copy of every notification, and can be used to reset your password.</p>
          </div>
          <div><label className="label" htmlFor="phone">Phone</label><input id="phone" type="tel" className="input" value={form.phone} onChange={set("phone")} /></div>
          <div>
            <label className="label" htmlFor="gender">Gender</label>
            <Select id="gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })}
              options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
          </div>
          <div>
            <label className="label" htmlFor="dob">Date of birth</label>
            <DatePicker id="dob" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} min="1900-01-01" max={localToday()} yearPicker clearable placeholder="Select date of birth" />
          </div>
          <div><label className="label" htmlFor="allergies">Allergies (comma separated)</label><input id="allergies" className="input" value={form.allergies} onChange={set("allergies")} /></div>
          <div className="sm:col-span-2"><ErrorText message={error} /></div>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "Sending code…" : "Continue"}</button>
          <div className="sm:col-span-2">
            <SocialButtons onSignedIn={() => navigate("/patient")} onError={setError} />
          </div>
          <p className="text-center text-sm text-muted sm:col-span-2">Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link></p>
        </form>
      ) : (
        <form onSubmit={create} className="card flex w-full max-w-md animate-pop-in flex-col gap-5 shadow-xl shadow-slate-900/5 sm:p-10">
          <div>
            <div className="mb-3 flex h-14 w-14 animate-pop items-center justify-center rounded-2xl bg-brand-soft text-2xl" aria-hidden="true">✉️</div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="mt-1 text-sm text-muted">{info}</p>
          </div>
          <div>
            <label className="label" htmlFor="otp">6-digit code</label>
            <input
              ref={codeInput}
              id="otp"
              className="input h-14 text-center font-display text-2xl tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <ErrorText message={error} />
          <button className="btn-primary h-12" disabled={busy || code.length !== 6}>{busy ? "Creating your account…" : "Confirm and create account"}</button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" className="font-semibold text-brand" onClick={() => { setStep("details"); setError(""); }}>← Change details</button>
            <button type="button" className="font-semibold text-brand disabled:text-muted" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
