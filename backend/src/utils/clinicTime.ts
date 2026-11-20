// All OPD dates and slot times are in the clinic's local time zone,
// never the server's (Render servers run in UTC).
export const CLINIC_TZ = process.env.CLINIC_TZ ?? "Asia/Kolkata";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Current clinic date ("YYYY-MM-DD") and minutes since midnight. */
export function clinicNow(at: Date = new Date()): { date: string; minutes: number } {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const clinicToday = () => clinicNow().date;

/** "10:30" -> 630 */
export const slotMinutes = (slot: string) => {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
};

/** Add whole days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True if this slot on this date has already started (clinic time). */
export function isPastSlot(date: string, slot: string, now = clinicNow()): boolean {
  if (date < now.date) return true;
  if (date > now.date) return false;
  return slotMinutes(slot) <= now.minutes;
}

/** A real Date for a clinic-local date + time, e.g. for demo timestamps. */
export function clinicDateTime(date: string, time: string): Date {
  // Asia/Kolkata has no daylight saving, so a fixed offset is safe here.
  const offset = CLINIC_TZ === "Asia/Kolkata" ? "+05:30" : "Z";
  return new Date(`${date}T${time}:00${offset}`);
}
