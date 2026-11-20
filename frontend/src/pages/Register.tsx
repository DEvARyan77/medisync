import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import { ErrorText } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", gender: "male", dateOfBirth: "", allergies: "" });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await register({
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
        allergies: form.allergies.split(",").map((a) => a.trim()).filter(Boolean),
      });
      navigate("/patient");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <form onSubmit={onSubmit} className="card grid w-full max-w-xl gap-4 p-10 sm:grid-cols-2">
        <h1 className="text-2xl font-bold sm:col-span-2">Create patient account</h1>
        <div className="sm:col-span-2"><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={form.name} onChange={set("name")} required /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={form.email} onChange={set("email")} required /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" minLength={6} className="input" value={form.password} onChange={set("password")} required /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" className="input" value={form.phone} onChange={set("phone")} /></div>
        <div><label className="label" htmlFor="dob">Date of birth</label><input id="dob" type="date" className="input" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></div>
        <div>
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" className="input" value={form.gender} onChange={set("gender")}>
            <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </div>
        <div><label className="label" htmlFor="allergies">Allergies (comma separated)</label><input id="allergies" className="input" value={form.allergies} onChange={set("allergies")} /></div>
        <div className="sm:col-span-2"><ErrorText message={error} /></div>
        <button className="btn-primary sm:col-span-2">Create account</button>
        <p className="text-center text-sm text-muted sm:col-span-2">Already registered? <Link to="/login" className="font-semibold text-brand">Sign in</Link></p>
      </form>
    </div>
  );
}
