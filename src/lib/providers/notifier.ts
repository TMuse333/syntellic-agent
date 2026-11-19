import * as fs from "fs";
import * as path from "path";
import type { Notifier } from "./types";
import type { Account, Lead } from "../db/schemas";

/** Writes each lead brief to a file (tests, demo). */
export class FileNotifier implements Notifier {
  readonly name = "file";
  sent: { to: string; subject: string; text: string; leadId: string }[] = [];
  constructor(private dir?: string) {}

  async sendLeadBrief(account: Account, lead: Lead & { leadId: string }, brief: { subject: string; text: string }) {
    const to = account.agent?.notifyEmail ?? "(no notify email configured)";
    this.sent.push({ to, ...brief, leadId: lead.leadId });
    if (this.dir) {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, `${lead.leadId}.md`), `To: ${to}\nSubject: ${brief.subject}\n\n${brief.text}\n`);
    }
  }
}

/** Real email via Resend (same service Greg's site already uses). */
export class ResendNotifier implements Notifier {
  readonly name = "resend";
  constructor(private apiKey: string, private from = process.env.LEADS_FROM_EMAIL || "leads@syntellic.ai") {}

  async sendLeadBrief(account: Account, _lead: Lead & { leadId: string }, brief: { subject: string; text: string }) {
    if (!account.agent?.notifyEmail) throw new Error(`No notifyEmail configured for account ${account.slug}`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ from: this.from, to: account.agent.notifyEmail, subject: brief.subject, text: brief.text }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
