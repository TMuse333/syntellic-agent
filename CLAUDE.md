# CLAUDE.md

## Source of Truth

These Notion pages are the authoritative specification for the Agent Growth System. **Never contradict them.**

- **System Spec** (HOW it works): https://www.notion.so/3fc08d8fd60281b48ee6ebe632557071
- **Strategy Playbook** (WHY and WHAT): https://www.notion.so/3fc08d8fd6028134a772db2527435128

### Rules

1. **Spec wins over code** — If code and spec disagree, stop and ask before proceeding.
2. **Re-read the Spec Changelog** at the start of each session to catch updates.
3. **Strategy Playbook** defines the model, topics, L-levels, and conversion flow.
4. **System Spec** defines architecture, data models, field names, sync rules, and implementation details.

---

## Chatbot + Content Library (2026-10-22)

```
src/lib/
├── providers/      every outside service, real | mock
│   ├── embedder.ts   Voyage | mock (hashed bag-of-words)
│   ├── store.ts      Mongo (Atlas $vectorSearch) | in-memory
│   ├── llm.ts        Claude (Messages API) | null = templates + rules
│   ├── calendar.ts   mock (Cal.com/Google later)
│   ├── notifier.ts   file | Resend
│   └── index.ts      createProviders("offline" | "live")
├── content/
│   ├── kinds.ts      content kinds registry (post, listing, guide, faq, blog, video)
│   └── ingest.ts     upsert + embed only changed text; derives rootTopicId/branchId
├── search/match.ts topic/branch + post match; listings = exact filters, then similarity
├── chat/
│   ├── engine.ts     state machine: open → explore → offer → capture → book → booked
│   │                 (not ready → nurture; out of area → ended)
│   ├── prompts.ts    ALL prompts: reply (1), extract (2), brief (3), simulated visitor (4)
│   ├── extract.ts    rule-based facts/signals + Claude JSON merged on top
│   ├── specificity.ts when the question is specific enough to offer a meeting
│   ├── writer.ts     Action → words (Claude, or templates offline)
│   ├── brief.ts      Lead (Spec §3) + the brief the agent receives
│   └── service.ts    used by POST /api/chat
├── niche/report.ts per-branch chat signals (stand-in scoring; CT-17 owns the engine)
└── demo/           fixtures loader + end-to-end run
```

Rules the code follows:
- Code decides every step; Claude only words it and extracts facts. Keeps the flow testable.
- `content_library` is general: flat docs with core fields (`kind`, `title`, `isPublic`, `topicId`,
  `rootTopicId`, `branchId`, `answers`) plus the kind's own fields. Post fields keep exact Spec names.
  The chatbot only ever serves `isPublic: true` (posts: Status = Posted; listings: active/pending).
- Client-specific behaviour lives in `Account.agent` (name, region, service areas, timezone,
  notify email, meeting length). New client = config + data, not code.
- Demo accounts never email anyone.

Commands:
- `npm test` — includes the offline end-to-end demo test
- `npm run demo:e2e` — writes `out/demo-run/report.md` (add `--traffic` for background visitors,
  `--live` to use real Voyage/Claude/Mongo where keys exist)
- `npm run seed:demo` — seed the demo client into Mongo
- `/demo/chat?post=post-demo-001` — try the chat as a visitor

Env: `MONGODB_URI`, `MONGODB_DB`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `CHAT_MODEL` (optional),
`RESEND_API_KEY` + `LEADS_FROM_EMAIL` (optional), `MATCH_MIN_SCORE` (optional), `CHAT_ALLOWED_ORIGIN`.

Vector indexes: create both definitions in `src/lib/db/indexes.ts` (type "vectorSearch").
