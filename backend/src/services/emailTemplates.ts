// Email templates. Each returns { subject, html, text }. Inline styles only, because
// most email apps ignore <style> blocks.

const APP_URL = () => (process.env.CLIENT_URL ?? "http://localhost:5173").split(",")[0];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Row {
  label: string;
  value: string;
}

function layout(opts: { title: string; intro: string; rows?: Row[]; button?: { label: string; url: string }; footer?: string }) {
  const rows = (opts.rows ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#5a6270;font-size:14px;width:140px;vertical-align:top">${esc(r.label)}</td>` +
        `<td style="padding:6px 0;color:#1f2328;font-size:14px;font-weight:600">${esc(r.value)}</td></tr>`
    )
    .join("");
  const button = opts.button
    ? `<p style="margin:24px 0 0"><a href="${opts.button.url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">${esc(opts.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d0d4da;border-radius:12px">
<tr><td style="background:#0f766e;padding:18px 24px;border-radius:12px 12px 0 0;color:#ffffff;font-size:20px;font-weight:700">MediSync</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;color:#1f2328">${esc(opts.title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1f2328">${esc(opts.intro)}</p>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
${button}
<p style="margin:24px 0 0;font-size:12px;color:#5a6270">${esc(opts.footer ?? "This is an automated message from MediSync. Please do not reply.")}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    opts.title,
    "",
    opts.intro,
    ...(opts.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    opts.button ? `\n${opts.button.label}: ${opts.button.url}` : "",
    "",
    opts.footer ?? "This is an automated message from MediSync.",
  ].join("\n");

  return { html, text };
}

const prettyDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function welcomeEmail(name: string) {
  return {
    subject: "Welcome to MediSync",
    ...layout({
      title: `Welcome, ${name}!`,
      intro: "Your patient account is ready. You can now book OPD appointments, see your prescriptions and request an ambulance.",
      button: { label: "Book an appointment", url: `${APP_URL()}/patient` },
    }),
  };
}

export function staffWelcomeEmail(name: string, role: string) {
  return {
    subject: "Your MediSync staff account",
    ...layout({
      title: `Hello ${name}`,
      intro: `An administrator created a MediSync account for you as ${role}. Sign in with the temporary password they gave you, then change it under My profile.`,
      button: { label: "Sign in", url: `${APP_URL()}/login` },
    }),
  };
}

export function appointmentBookedEmail(p: { name: string; doctor: string; department?: string; date: string; slot: string }) {
  return {
    subject: `Appointment confirmed: ${prettyDate(p.date)}, ${p.slot}`,
    ...layout({
      title: "Your appointment is booked",
      intro: `Hi ${p.name}, here are your appointment details. Please check in at reception on the day to get your token.`,
      rows: [
        { label: "Doctor", value: p.doctor },
        ...(p.department ? [{ label: "Department", value: p.department }] : []),
        { label: "Date", value: prettyDate(p.date) },
        { label: "Time", value: p.slot },
      ],
      button: { label: "View my appointments", url: `${APP_URL()}/patient` },
    }),
  };
}

export function appointmentCancelledEmail(p: { name: string; doctor: string; date: string; slot: string; byClinic: boolean }) {
  return {
    subject: `Appointment cancelled: ${prettyDate(p.date)}, ${p.slot}`,
    ...layout({
      title: "Your appointment was cancelled",
      intro: p.byClinic
        ? `Hi ${p.name}, the clinic cancelled your appointment below. You can book a new slot any time.`
        : `Hi ${p.name}, your appointment below has been cancelled as requested.`,
      rows: [
        { label: "Doctor", value: p.doctor },
        { label: "Date", value: prettyDate(p.date) },
        { label: "Time", value: p.slot },
      ],
      button: { label: "Book again", url: `${APP_URL()}/patient` },
    }),
  };
}

export function checkedInEmail(p: { name: string; token: string; doctor: string }) {
  return {
    subject: `Your token is ${p.token}`,
    ...layout({
      title: `Token ${p.token}`,
      intro: `Hi ${p.name}, you are checked in. Please wait near the OPD; you will be called by token number.`,
      rows: [
        { label: "Token", value: p.token },
        { label: "Doctor", value: p.doctor },
      ],
      button: { label: "Track the queue", url: `${APP_URL()}/patient` },
    }),
  };
}

export function prescriptionEmail(p: {
  name: string;
  doctor: string;
  diagnosis: string;
  medicines: { medicine: string; dose: string; frequency: string; days: number; instructions?: string }[];
}) {
  return {
    subject: "Your visit summary and prescription",
    ...layout({
      title: "Visit summary",
      intro: `Hi ${p.name}, thank you for visiting. ${p.medicines.length ? "Your prescription has been sent to the MediSync pharmacy." : "No medicines were prescribed."}`,
      rows: [
        { label: "Doctor", value: p.doctor },
        { label: "Diagnosis", value: p.diagnosis },
        ...p.medicines.map((m, i) => ({
          label: i === 0 ? "Medicines" : "",
          value: `${m.medicine} ${m.dose} · ${m.frequency} · ${m.days} days${m.instructions ? ` · ${m.instructions}` : ""}`,
        })),
      ],
      button: { label: "View health timeline", url: `${APP_URL()}/patient/history` },
      footer: "Take medicines exactly as prescribed. Contact your doctor if symptoms get worse.",
    }),
  };
}

export function dispensedEmail(p: { name: string; count: number }) {
  return {
    subject: "Your medicines have been handed over",
    ...layout({
      title: "Medicines dispensed",
      intro: `Hi ${p.name}, the pharmacy has handed over ${p.count} ${p.count === 1 ? "medicine" : "medicines"} from your prescription.`,
      button: { label: "View prescription", url: `${APP_URL()}/patient/history` },
    }),
  };
}

export function ambulanceAcceptedEmail(p: { name: string; driver: string; vehicle: string; phone?: string }) {
  return {
    subject: "Ambulance on the way",
    ...layout({
      title: "An ambulance is on the way",
      intro: `Hi ${p.name}, a driver accepted your request. You can track the ambulance live in the app.`,
      rows: [
        { label: "Driver", value: p.driver },
        { label: "Vehicle", value: p.vehicle },
        ...(p.phone ? [{ label: "Driver phone", value: p.phone }] : []),
      ],
      button: { label: "Track live", url: `${APP_URL()}/patient/ambulance` },
    }),
  };
}

export function passwordResetEmail(p: { name: string; url: string; minutes: number }) {
  return {
    subject: "Reset your MediSync password",
    ...layout({
      title: "Reset your password",
      intro: `Hi ${p.name}, we received a request to reset your password. This link works once and expires in ${p.minutes} minutes.`,
      button: { label: "Choose a new password", url: p.url },
      footer: "If you did not ask for this, you can ignore this email; your password will not change.",
    }),
  };
}

export function passwordChangedEmail(name: string) {
  return {
    subject: "Your MediSync password was changed",
    ...layout({
      title: "Password changed",
      intro: `Hi ${name}, your password was just changed. If this was not you, reset your password immediately using "Forgot password" on the sign-in page.`,
      button: { label: "Sign in", url: `${APP_URL()}/login` },
    }),
  };
}
