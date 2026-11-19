#!/usr/bin/env npx tsx
/**
 * End-to-end demo: mock client → chats → bookings → niche report.
 *
 *   npm run demo:e2e            # offline, no keys needed
 *   npm run demo:e2e -- --live  # real Voyage/Claude/Mongo where keys exist
 *   add --traffic to include 20 background visitors in the niche table
 *
 * Output: out/demo-run/report.md (+ briefs/)
 */
import "dotenv/config";
import * as path from "path";
import { runDemo } from "../src/lib/demo/run";

async function main() {
  const live = process.argv.includes("--live");
  const outDir = path.join(__dirname, "../out/demo-run");
  const r = await runDemo({ mode: live ? "live" : "offline", outDir, backgroundTraffic: process.argv.includes("--traffic"), log: console.log });
  console.log("");
  for (const c of r.checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  console.log(`\n${r.pass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}  ·  report: ${r.reportPath}`);
  process.exit(r.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
