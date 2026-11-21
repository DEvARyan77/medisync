// Sends email through Brevo's HTTP API (https://api.brevo.com/v3/smtp/email).
// HTTP is used instead of SMTP because Render's free plan blocks SMTP ports (25, 465, 587).
//
// Env vars:
//   BREVO_API_KEY  - from Brevo > SMTP & API > API Keys. Without it, emails are only logged.
//   EMAIL_FROM     - a sender address verified in Brevo (e.g. your Gmail)
//   EMAIL_FROM_NAME - shown as the sender name (default "MediSync")

export interface EmailMessage {
  to: string;
  name?: string;
  /** The user's alternate email: gets a copy of every notification. */
  cc?: string | null;
  subject: string;
  html: string;
  text: string;
}

// Demo accounts use this made-up domain; never try to deliver to it.
const SKIP_DOMAINS = ["medisync.dev", "deleted.invalid"];

export function emailEnabled(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

const deliverable = (addr?: string | null): addr is string => {
  const domain = addr?.split("@")[1]?.toLowerCase();
  return !!domain && !SKIP_DOMAINS.includes(domain);
};

async function deliver(msg: EmailMessage): Promise<void> {
  const cc = deliverable(msg.cc) && msg.cc.toLowerCase() !== msg.to.toLowerCase() ? msg.cc : undefined;
  if (!deliverable(msg.to)) {
    if (cc) return deliver({ ...msg, to: cc, cc: undefined }); // demo primary, real alternate

    console.log(`[email] skipped demo address ${msg.to}: ${msg.subject}`);
    return;
  }
  if (!emailEnabled()) {
    console.log(`[email] (not configured) to=${msg.to}${cc ? ` cc=${cc}` : ""} subject="${msg.subject}"`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME ?? "MediSync" },
      to: [{ email: msg.to, name: msg.name }],
      ...(cc && { cc: [{ email: cc, name: msg.name }] }),
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(`[email] sent to ${msg.to}${cc ? ` (+ ${cc})` : ""}: ${msg.subject}`);
}

/**
 * Fire-and-forget: never blocks or fails the API request that triggered it.
 * Use sendEmailAndWait when the caller must know it went out.
 */
export function sendEmail(msg: EmailMessage): void {
  deliver(msg).catch((err) => console.error(`[email] failed to ${msg.to}:`, err.message));
}

export const sendEmailAndWait = deliver;
