import crypto from "crypto";
import { ApiError } from "../../utils/ApiError";
import { EmailOtp } from "./emailOtp.model";

export const OTP_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const IP_MAX_PER_HOUR = 15;

const hash = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

// Per-IP limit (in memory: fine for one server instance)
const ipHits = new Map<string, number[]>();
function checkIp(ip: string) {
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= IP_MAX_PER_HOUR) throw new ApiError(429, "Too many codes requested from this network. Please try again in an hour.");
  recent.push(now);
  ipHits.set(ip, recent);
}

/** Creates (or replaces) the code for this email, enforcing the resend and hourly limits. Returns the code to email. */
export async function issueOtp(email: string, ip: string): Promise<string> {
  const now = new Date();
  const existing = await EmailOtp.findOne({ email });
  if (existing) {
    const wait = RESEND_SECONDS - Math.floor((now.getTime() - existing.lastSentAt.getTime()) / 1000);
    if (wait > 0) throw new ApiError(429, `Please wait ${wait} seconds before asking for another code.`);
  }
  const sameWindow = existing && now.getTime() - existing.windowStart.getTime() < 3_600_000;
  const sends = sameWindow ? existing!.sendsInWindow : 0;
  if (sends >= MAX_SENDS_PER_HOUR) throw new ApiError(429, "Too many codes sent to this email. Please try again in an hour.");
  checkIp(ip);

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await EmailOtp.findOneAndUpdate(
    { email },
    {
      email,
      codeHash: hash(code),
      expiresAt: new Date(now.getTime() + OTP_MINUTES * 60_000),
      attempts: 0,
      lastSentAt: now,
      windowStart: sameWindow ? existing!.windowStart : now,
      sendsInWindow: sends + 1,
    },
    { upsert: true }
  );
  return code;
}

/** Throws unless the code is right. The code works once. */
export async function consumeOtp(email: string, code: string): Promise<void> {
  const otp = await EmailOtp.findOne({ email });
  if (!otp || otp.expiresAt < new Date()) throw new ApiError(400, "This code has expired. Please ask for a new one.");
  if (otp.attempts >= MAX_ATTEMPTS) throw new ApiError(400, "Too many wrong codes. Please ask for a new one.");
  const given = Buffer.from(hash(code.trim()));
  if (!crypto.timingSafeEqual(given, Buffer.from(otp.codeHash))) {
    otp.attempts += 1;
    await otp.save();
    const left = MAX_ATTEMPTS - otp.attempts;
    throw new ApiError(400, left > 0 ? `That code is wrong. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Please ask for a new one.");
  }
  await otp.deleteOne();
}
