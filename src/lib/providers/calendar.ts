import type { Calendar, Slot, Booking } from "./types";
import type { Account } from "../db/schemas";

/**
 * Mock calendar: offers the next weekday slots at 10am, 2pm and 6pm in the
 * agent's timezone. Real version (Cal.com / Google) plugs in behind the same
 * interface once we know which calendar the agent uses.
 */
export class MockCalendar implements Calendar {
  readonly name = "mock";
  booked: Booking[] = [];
  constructor(private now: () => Date = () => new Date()) {}

  async getSlots(account: Account, count: number): Promise<Slot[]> {
    const tz = account.agent?.timezone ?? "America/Halifax";
    const minutes = account.agent?.meeting.minutes ?? 15;
    const slots: Slot[] = [];
    const d = new Date(this.now());
    d.setUTCHours(12, 0, 0, 0);
    while (slots.length < count) {
      d.setUTCDate(d.getUTCDate() + 1);
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      for (const hour of [10, 14, 18]) {
        if (slots.length >= count) break;
        const start = zonedTime(d, hour, tz);
        if (this.booked.some((b) => b.start === start.toISOString())) continue;
        const end = new Date(start.getTime() + minutes * 60_000);
        slots.push({ start: start.toISOString(), end: end.toISOString(), label: formatSlot(start, tz) });
      }
    }
    return slots;
  }

  async book(_account: Account, slot: Slot, attendee: { kind: "call" | "showing" }): Promise<Booking> {
    const b: Booking = { ...slot, kind: attendee.kind, bookingId: `bk_${this.booked.length + 1}_${Date.parse(slot.start)}` };
    this.booked.push(b);
    return b;
  }
}

/** Date (UTC midnight-ish day) + local hour in tz → absolute Date. */
function zonedTime(day: Date, hour: number, tz: string): Date {
  const guess = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour));
  const local = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (utc.getTime() - local.getTime()));
}

export function formatSlot(d: Date, tz: string): string {
  return d.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
