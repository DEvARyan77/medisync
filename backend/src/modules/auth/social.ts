import { OAuth2Client } from "google-auth-library";
import { ApiError } from "../../utils/ApiError";

export interface SocialProfile {
  provider: "google" | "facebook";
  providerId: string;
  email: string;
  name: string;
}

const googleClientId = () => process.env.GOOGLE_CLIENT_ID ?? "";
let googleClient: OAuth2Client | null = null;

/** Checks a Google ID token (from "Sign in with Google") and returns the verified profile. */
export async function verifyGoogle(credential: string): Promise<SocialProfile> {
  if (!googleClientId()) throw new ApiError(503, "Google sign-in isn't set up on this server");
  googleClient ??= new OAuth2Client(googleClientId());
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId() });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "Google sign-in failed. Please try again.");
  }
  if (!payload?.email || !payload.email_verified) throw new ApiError(400, "Your Google account has no verified email");
  return { provider: "google", providerId: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? payload.email.split("@")[0] };
}

/** Checks a Facebook access token belongs to our app, then reads the user's name and email. */
export async function verifyFacebook(accessToken: string): Promise<SocialProfile> {
  const appId = process.env.FACEBOOK_APP_ID;
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !secret) throw new ApiError(503, "Facebook sign-in isn't set up on this server");
  const graph = "https://graph.facebook.com/v19.0";
  const debug = await fetch(`${graph}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appId}|${secret}`, {
    signal: AbortSignal.timeout(10_000),
  }).then((r) => r.json() as Promise<{ data?: { is_valid?: boolean; app_id?: string; user_id?: string } }>);
  if (!debug.data?.is_valid || debug.data.app_id !== appId) throw new ApiError(401, "Facebook sign-in failed. Please try again.");
  const me = await fetch(`${graph}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`, {
    signal: AbortSignal.timeout(10_000),
  }).then((r) => r.json() as Promise<{ id?: string; name?: string; email?: string }>);
  if (!me.email) throw new ApiError(400, "Facebook didn't share your email. Allow email access, or sign up with your email instead.");
  return { provider: "facebook", providerId: me.id ?? debug.data.user_id!, email: me.email.toLowerCase(), name: me.name ?? me.email.split("@")[0] };
}

/** What the frontend needs to show the buttons (public values only). */
export const socialConfig = () => ({
  google: googleClientId() || null,
  facebook: process.env.FACEBOOK_APP_ID || null,
});
