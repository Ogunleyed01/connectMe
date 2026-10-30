# SPEC.md — 2027 Internship Tracker & Daily Digest Telegram Bot

## 1. System Overview
A stateful, \$0-cost Telegram bot that scrapes, filters, scores, and dispatches up to 20 daily internship opportunities tailored to the user's university course of study (starting with Computer Science) for the 2027 SIWES / Industrial Training (IT) and Summer intake periods.

### Core Value Loop
1. **Ingest & Normalize:** Scheduled scrapers pull raw job listings from Nigerian and global sources, passing them through Gemini 2.5 Flash to extract structured metadata (`requires_national_id`, `has_stipend`, `course_tags`, `location_category`, `deadline`).
2. **Score & Prioritize:** Listings that do **not** require a foreign/local National ID upfront and offer a **stipend** receive the highest priority score.
3. **Daily 20 Rollover Queue:** Every morning at 08:00 WAT, the bot sends up to 20 listings:
   - First, it resends previously dispatched listings (`status = 'sent'`) that the user has not acted on yet (if the deadline has not passed).
   - Second, it fills the remaining slots up to 20 with new `queued` listings ordered by `priority_score DESC`.
4. **Interactive State Machine:** Each Telegram message has inline buttons (`Applied`, `Not Eligible`, `Skip for Tomorrow`).
5. **Automated Follow-Ups:** Roles marked as `applied` trigger automated follow-up check-ins 7 days after application and 3 days before the deadline/start date.

---

## 2. Tech Stack & Constraints (\$0 Budget)
- **Runtime & Language:** Node.js (v20+) with TypeScript (Strict Mode)
- **Telegram Framework:** `grammY` (lightweight, serverless-ready, native inline keyboard plugins)
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js`
- **LLM Structured Extraction:** Google Gemini API (`@google/genai`, model: `gemini-2.5-flash`)
- **Cron & Scraping Host:** GitHub Actions (`.github/workflows/daily_pipeline.yml`)
- **Webhook Host (24/7 Button Listener):** Cloudflare Workers or Vercel Serverless Functions

---

## 3. Directory Structure
```text
intern-tracker-bot/
├── SPEC.md
├── supabase/
│   └── schema.sql          # Complete PostgreSQL schema, indexes, and views
├── src/
│   ├── config/
│   │   ├── env.ts          # Validated environment variables
│   │   └── taxonomy.ts     # Course-of-study to role/keyword mappings
│   ├── db/
│   │   ├── client.ts       # Supabase singleton client
│   │   └── queries.ts      # Queue, rollover, state transition, and follow-up queries
│   ├── ingest/
│   │   ├── sources/        # Modular scrapers (GitHub 2027 repos, Greenhouse, Lever, Workable)
│   │   ├── geminiParser.ts # Structured JSON extraction using Gemini 2.5 Flash
│   │   └── scorer.ts       # Deterministic priority score calculator
│   ├── bot/
│   │   ├── index.ts        # grammY bot instance & command handlers (/start, /stats, /filter)
│   │   ├── keyboards.ts    # Inline keyboard builders and callback_data parsers
│   │   └── formatter.ts    # Telegram HTML/MarkdownV2 card templates
│   └── jobs/
│       ├── runIngest.ts    # CLI entrypoint for scraping & parsing
│       ├── sendDigest.ts   # CLI entrypoint for the 08:00 WAT Daily 20 dispatch
│       └── sendFollowup.ts # CLI entrypoint for 7-day post-application check-ins
├── api/
│   └── webhook.ts          # Serverless webhook endpoint for Telegram button clicks
└── package.json
```

## 4. Deterministic Priority Scoring (src/ingest/scorer.ts)
# Every ingested internship receives a priority_score (0–100) computed before DB insertion:

- **No National ID Required (requires_national_id === false): +35 pts
- **Stipend Confirmed (has_stipend === true): +25 pts
- **2027 Intake Match (target_year === 2027): +20 pts
- **Location Accessibility:

nigeria (Onsite/Hybrid/Remote) or overseas_remote (Open to Africa/Global): +15 pts

overseas_relocate (Visa sponsorship stated): +10 pts

- **Urgency Bonus: Deadline within 14 days: +5 pts