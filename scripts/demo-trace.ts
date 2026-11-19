#!/usr/bin/env npx tsx
/**
 * Turn-by-turn trace of one demo visitor, including every prompt.
 *   npm run demo:trace -- persona-fall-seller [--live]
 * Writes out/demo-trace/<persona>.json
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { traceConversation } from "../src/lib/demo/trace";

async function main() {
  const id = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "persona-fall-seller";
  const t = await traceConversation(id, { live: process.argv.includes("--live") });
  const dir = path.join(__dirname, "../out/demo-trace");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(t, null, 2));
  for (const turn of t.turns) {
    if (turn.visitor) console.log(`\nTHEM: ${turn.visitor}`);
    console.log(`  facts+ ${JSON.stringify(turn.factsAdded)}`);
    console.log(`  decision: ${turn.decision} → ${turn.phase}  events: ${turn.events.join(", ")}`);
    console.log(`  prompts: ${turn.prompts.map((p) => p.kind).join(", ") || "none"}`);
    console.log(`BOT: ${turn.reply}`);
  }
  console.log(`\nTrace: ${file}`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
