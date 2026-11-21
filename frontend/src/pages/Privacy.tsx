import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";

/** Public privacy policy (also linked from Google's sign-in screen). */
export default function Privacy() {
  return (
    <div className="relative min-h-screen bg-page p-4 pt-16 sm:p-10">
      <ThemeToggle className="absolute top-4 right-4 w-11" />
      <article className="card mx-auto flex max-w-3xl animate-pop-in flex-col gap-4 leading-relaxed sm:p-10">
        <Link to="/login" className="font-display text-2xl font-bold text-brand">MediSync</Link>
        <h1 className="text-2xl font-bold sm:text-3xl">Privacy policy</h1>
        <p className="text-sm text-muted">Last updated: 21 November 2026</p>
        <p>
          MediSync is a portfolio project that demonstrates an OPD (outpatient) system: appointments, token queue, consultations,
          e-prescriptions, pharmacy and ambulance requests. This page explains what it stores and why.
        </p>
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc pl-6">
          <li>Account details: name, email, optional alternate email, phone, and a hashed password.</li>
          <li>Details you add to your profile: gender, date of birth, blood group, allergies, address and emergency contact.</li>
          <li>Visit records: appointments, tokens, vitals, diagnoses, prescriptions and ambulance requests.</li>
          <li>If you use an ambulance request with "Use my location", the location you share for that trip.</li>
        </ul>
        <h2 className="text-lg font-semibold">Sign in with Google or Facebook</h2>
        <p>
          If you choose Google or Facebook, we receive only your name and email address to create or open your account. We don't
          get your password, contacts or any other data, and we don't post anything on your behalf.
        </p>
        <h2 className="text-lg font-semibold">How it is used</h2>
        <p>
          Only to run the app: showing your appointments and records to you and to the clinic staff treating you, and sending
          emails about your account and visits (with a copy to your alternate email if you add one). We don't sell or share your
          data, and we don't use it for advertising.
        </p>
        <h2 className="text-lg font-semibold">Where it is stored</h2>
        <p>On MongoDB Atlas and Render (the hosting service). Emails are sent through Brevo.</p>
        <h2 className="text-lg font-semibold">Deleting your data</h2>
        <p>
          You can delete your account at any time from <b>My profile → Delete account</b>. Your name, email and phone are removed and
          you can no longer sign in. Please don't enter real medical information: this is a demonstration project.
        </p>
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>Questions: <a className="font-semibold text-brand" href="mailto:devaryan7766@gmail.com">devaryan7766@gmail.com</a></p>
      </article>
    </div>
  );
}
