import { FormEvent, useState } from "react";
import { Select } from "../../components/Select";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { ErrorText, PageTitle } from "../../components/ui";
import type { User } from "../../types";

const blank = { name: "", email: "", alternateEmail: "", password: "", role: "doctor", phone: "", department: "", specialization: "", vehicleNumber: "", vehicleType: "basic" };

export default function AdminUsers() {
  const users = usePolling(async () => (await api.get("/users")).data.users as User[], 30000);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    // Send only the fields that matter for this role.
    const body: Record<string, string> = { name: form.name, email: form.email, password: form.password, role: form.role };
    if (form.alternateEmail.trim()) body.alternateEmail = form.alternateEmail.trim();
    if (form.phone) body.phone = form.phone;
    if (form.role === "doctor") Object.assign(body, { department: form.department, specialization: form.specialization });
    if (form.role === "driver") Object.assign(body, { vehicleNumber: form.vehicleNumber, vehicleType: form.vehicleType });
    try {
      await api.post("/auth/staff", body);
      setMsg(`${form.name} added as ${form.role}`);
      setForm(blank);
      users.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageTitle>Users</PageTitle>
      <form onSubmit={submit} className="card mb-6 grid gap-4 md:grid-cols-3">
        <h2 className="text-lg font-semibold md:col-span-3">Add staff member</h2>
        <div><label className="label" htmlFor="role">Role</label>
          <Select id="role" value={form.role} onChange={(v) => setForm({ ...form, role: v })}
            options={[{ value: "doctor", label: "Doctor" }, { value: "receptionist", label: "Receptionist" }, { value: "pharmacist", label: "Pharmacist" }, { value: "driver", label: "Ambulance driver" }, { value: "admin", label: "Admin" }]} />
        </div>
        <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" value={form.name} onChange={set("name")} required /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={form.email} onChange={set("email")} required /></div>
        <div><label className="label" htmlFor="altEmail">Alternate email <span className="font-normal text-muted">(optional)</span></label><input id="altEmail" type="email" className="input" value={form.alternateEmail} onChange={set("alternateEmail")} /></div>
        <div><label className="label" htmlFor="pw">Temporary password</label><input id="pw" minLength={6} className="input" value={form.password} onChange={set("password")} required /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" className="input" value={form.phone} onChange={set("phone")} /></div>
        {form.role === "doctor" && (
          <>
            <div><label className="label" htmlFor="dept">Department</label><input id="dept" className="input" value={form.department} onChange={set("department")} required /></div>
            <div><label className="label" htmlFor="spec">Specialization</label><input id="spec" className="input" value={form.specialization} onChange={set("specialization")} /></div>
          </>
        )}
        {form.role === "driver" && (
          <>
            <div><label className="label" htmlFor="veh">Vehicle number</label><input id="veh" className="input" value={form.vehicleNumber} onChange={set("vehicleNumber")} required /></div>
            <div><label className="label" htmlFor="vt">Ambulance type</label>
              <Select id="vt" value={form.vehicleType} onChange={(v) => setForm({ ...form, vehicleType: v })}
                options={[{ value: "basic", label: "Basic life support" }, { value: "advanced", label: "Advanced life support" }]} />
            </div>
          </>
        )}
        <div className="flex items-end"><button className="btn-primary w-full">Add user</button></div>
        <div className="md:col-span-3"><ErrorText message={error} />{msg && <p className="text-sm text-brand">{msg}</p>}</div>
      </form>

      <ul className="stagger flex flex-col gap-2 md:hidden">
        {users.data?.map((u) => (
          <li key={u._id} className="card p-3">
            <div className="flex justify-between gap-2">
              <b>{u.name}</b>
              <span className="text-sm text-muted capitalize">{u.role}</span>
            </div>
            <div className="text-sm break-all text-muted">{u.email}</div>
            {(u.department ?? u.vehicleNumber) && <div className="text-sm text-muted">{u.department ?? u.vehicleNumber}</div>}
          </li>
        ))}
      </ul>
      <section className="card hidden overflow-x-auto p-0 md:block sm:p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted uppercase"><tr><th className="px-6 py-4">Name</th><th>Email</th><th>Role</th><th>Details</th></tr></thead>
          <tbody className="stagger">
            {users.data?.map((u) => (
              <tr key={u._id} className="border-t border-line">
                <td className="px-6 py-3 font-semibold">{u.name}</td>
                <td>{u.email}</td>
                <td className="capitalize">{u.role}</td>
                <td className="text-muted">{u.department ?? u.vehicleNumber ?? u.phone ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
