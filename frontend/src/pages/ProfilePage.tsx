import { FormEvent, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ErrorText, PageTitle } from "../components/ui";
import type { User } from "../types";
import { DatePicker, localToday } from "../components/DatePicker";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageTitle>My profile</PageTitle>
      <div className="stagger grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </>
  );
}

function Saved({ text }: { text: string }) {
  if (!text) return null;
  return <p key={text} className="animate-pop-in rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{text}</p>;
}

function ProfileForm({ user }: { user: User }) {
  const { setSession } = useAuth();
  const isPatient = user.role === "patient";
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? "",
    alternateEmail: user.alternateEmail ?? "",
    gender: user.gender ?? "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    bloodGroup: user.bloodGroup ?? "",
    allergies: (user.allergies ?? []).join(", "),
    address: user.address ?? "",
    ecName: user.emergencyContact?.name ?? "",
    ecPhone: user.emergencyContact?.phone ?? "",
    ecRelation: user.emergencyContact?.relation ?? "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Send only the fields this role may change (the API rejects anything else).
    const body: Record<string, unknown> = { name: form.name, phone: form.phone, alternateEmail: form.alternateEmail.trim() };
    if (isPatient) {
      Object.assign(body, {
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth || null,
        bloodGroup: form.bloodGroup || null,
        allergies: form.allergies.split(",").map((a) => a.trim()).filter(Boolean),
        address: form.address,
        emergencyContact: { name: form.ecName, phone: form.ecPhone, relation: form.ecRelation },
      });
    }
    try {
      const res = await api.patch("/users/me", body);
      setSession(res.data.user);
      setSaved("Profile saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Personal details</h2>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={form.name} onChange={set("name")} required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input bg-page text-muted" value={user.email} readOnly aria-describedby="email-note" />
          <p id="email-note" className="mt-1 text-xs text-muted">Used to sign in. Contact the clinic to change it.</p>
        </div>
        <div>
          <label className="label" htmlFor="altEmail">Alternate email <span className="font-normal text-muted">(optional)</span></label>
          <input id="altEmail" type="email" className="input" placeholder="e.g. work or family email" value={form.alternateEmail} onChange={set("alternateEmail")} aria-describedby="alt-note" />
          <p id="alt-note" className="mt-1 text-xs text-muted">Gets a copy of every email, and works for "Forgot password".</p>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" type="tel" inputMode="tel" className="input" value={form.phone} onChange={set("phone")} />
        </div>
        {isPatient && (
          <>
            <div>
              <label className="label" htmlFor="dob">Date of birth</label>
              <DatePicker
                id="dob"
                value={form.dateOfBirth}
                onChange={(v) => { setForm({ ...form, dateOfBirth: v }); setSaved(""); }}
                min="1900-01-01"
                max={localToday()}
                yearPicker
                clearable
                placeholder="Select date of birth"
              />
            </div>
            <div>
              <label className="label" htmlFor="gender">Gender</label>
              <select id="gender" className="input" value={form.gender} onChange={set("gender")}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address">Address</label>
              <textarea id="address" rows={2} className="w-full rounded-lg border border-line p-3" value={form.address} onChange={set("address")} />
            </div>
          </>
        )}
      </section>

      {isPatient && (
        <>
          <section className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">Medical details</h2>
            <div>
              <label className="label" htmlFor="blood">Blood group</label>
              <select id="blood" className="input" value={form.bloodGroup} onChange={set("bloodGroup")}>
                <option value="">Not known</option>
                {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="allergies">Allergies</label>
              <input id="allergies" className="input" placeholder="e.g. Penicillin, Peanuts" value={form.allergies} onChange={set("allergies")} aria-describedby="allergy-note" />
              <p id="allergy-note" className="mt-1 text-xs text-muted">Separate with commas. Doctors and the pharmacy see this.</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <h2 className="text-lg font-semibold sm:col-span-3">Emergency contact</h2>
            <div>
              <label className="label" htmlFor="ecName">Name</label>
              <input id="ecName" className="input" value={form.ecName} onChange={set("ecName")} />
            </div>
            <div>
              <label className="label" htmlFor="ecRelation">Relation</label>
              <input id="ecRelation" className="input" placeholder="e.g. Father" value={form.ecRelation} onChange={set("ecRelation")} />
            </div>
            <div>
              <label className="label" htmlFor="ecPhone">Phone</label>
              <input id="ecPhone" type="tel" inputMode="tel" className="input" value={form.ecPhone} onChange={set("ecPhone")} />
            </div>
          </section>
        </>
      )}

      <ErrorText message={error} />
      <Saved text={saved} />
      <button className="btn-primary w-full sm:w-auto sm:self-start" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved("");
    if (form.newPassword !== form.confirm) return setError("The new passwords do not match");
    try {
      await api.patch("/users/me/password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setSaved("Password changed. We emailed you a confirmation.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="card flex h-fit flex-col gap-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      <div>
        <label className="label" htmlFor="cur">Current password</label>
        <input id="cur" type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="new">New password</label>
        <input id="new" type="password" autoComplete="new-password" minLength={6} className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" type="password" autoComplete="new-password" minLength={6} className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
      </div>
      <ErrorText message={error} />
      <Saved text={saved} />
      <button className="btn-outline w-full">Change password</button>
    </form>
  );
}
