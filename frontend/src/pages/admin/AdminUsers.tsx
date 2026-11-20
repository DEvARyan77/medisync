import { FormEvent, useState } from "react";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { ErrorText, PageTitle } from "../../components/ui";
import type { User } from "../../types";

const blank = { name: "", email: "", password: "", role: "doctor", phone: "", department: "", specialization: "", vehicleNumber: "", vehicleType: "basic" };

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
          <select id="role" className="input" value={form.role} onChange={set("role")}>
            <option value="doctor">Doctor</option><option value="receptionist">Receptionist</option><option value="pharmacist">Pharmacist</option><option value="driver">Ambulance driver</option><option value="admin">Admin</option>
          </select>
        </div>
        <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" value={form.name} onChange={set("name")} required /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={form.email} onChange={set("email")} required /></div>
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
              <select id="vt" className="input" value={form.vehicleType} onChange={set("vehicleType")}><option value="basic">Basic life support</option><option value="advanced">Advanced life support</option></select>
            </div>
          </>
        )}
        <div className="flex items-end"><button className="btn-primary w-full">Add user</button></div>
        <div className="md:col-span-3"><ErrorText message={error} />{msg && <p className="text-sm text-brand">{msg}</p>}</div>
      </form>

      <section className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted uppercase"><tr><th className="px-6 py-4">Name</th><th>Email</th><th>Role</th><th>Details</th></tr></thead>
          <tbody>
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
