# 2027 Internship Tracker & Daily Digest Telegram Bot

A stateful, \$0-budget Telegram bot that filters, scores, and delivers up to 20 daily internship opportunities tailored for university students targeting the **2027 IT / SIWES & Summer** intake period.

---

## ⚡ Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env` (or edit the existing `.env` file) and provide your Telegram Bot Token:

```env
# Get this from @BotFather on Telegram (Already added)
BOT_TOKEN=your_telegram_bot_token_here

# Optional: Supabase for persistent cloud storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: Gemini API for scraping & extraction
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start the Bot
```bash
# In development mode (hot-reloads on edits)
npm run dev

# Or build & start in production mode
npm run build
npm start
```

---

## 🤖 Telegram Bot Commands

| Command | Description |
|---|---|
| `/start` | Launch the 3-step interactive onboarding flow |
| `/digest` | Receive today's batch of up to 20 matched opportunities immediately |
| `/stats` | View application pipeline metrics (Applied, Interviewing, Offered, etc.) |
| `/settings` or `/filter` | Review or reconfigure your active internship preferences |
| `/help` | Display command guide and daily digest overview |

---

## 🎮 Interactive Features

### 1. Onboarding Flow (`/start`)
- **Step 1: Course of Study** (Computer Science, Electrical Eng, Product Design, Data Science & AI)
- **Step 2: Location Preference** (Nigeria Only, Overseas/Remote Only, Both) + `⬅️ Back`
- **Step 3: Stipend Requirement** (Strict [Paid Only] vs. Preferred [Prioritize Paid]) + `⬅️ Back`
- **Step 4: Confirmation Card** with 1-click `/digest` launcher and settings overview.

### 2. Daily 20 Rollover Queue (`/digest`)
- Dispatches up to 20 listings ordered strictly by:
  1. **Rollover Listings:** Unacted roles previously sent (`status = 'sent'`) that are still open.
  2. **Fresh Matches:** New listings prioritized by **Stipend Confirmed** and **Zero National ID Barrier**.
- Each card displays company, role, location/work mode, stipend amount, national ID status, tech stack, start date, deadline urgency, and key highlights.

### 3. Inline State Machine Buttons
Attached directly under every opportunity card:
- `[ 🔗 Apply on Official Page ]`: Opens direct application URL.
- `[ ✅ Applied ]`: Logs application, removes role from rollover, schedules 7-day follow-up reminder, and updates the card in place.
- `[ ❌ Not Eligible ]`: Permanently archives listing and updates card in place.
- `[ ⏭️ Skip for Tomorrow ]`: Keeps role in queue for tomorrow's rollover.

### 4. Automated 7-Day Follow-Up Check-Ins
- Roles marked as `Applied` trigger check-in messages with 1-click status buttons:
  - `[ 🗣️ Interviewing ]`
  - `[ 🏆 Received Offer ]`
  - `[ ⏳ Still Waiting ]`
  - `[ ❌ Not Selected ]`

---

## 🛠️ CLI Jobs & Pipelines

```bash
# Run scraping, Gemini 2.5 Flash parsing & priority scoring pipeline
npx tsx src/jobs/runIngest.ts

# Trigger 08:00 WAT Daily 20 dispatch job for all active users
npx tsx src/jobs/sendDigest.ts

# Trigger 7-day post-application follow-up check-in scan
npx tsx src/jobs/sendFollowup.ts
```

---

## 🏗️ Project Architecture

```text
connectMe/
├── SPEC.md                 # Technical specification and priority scoring rules
├── supabase/
│   └── schema.sql          # PostgreSQL schema, indexes, and RPC function
├── src/
│   ├── config/
│   │   ├── env.ts          # Zod-validated environment configuration
│   │   └── taxonomy.ts     # Course, location, and stipend definitions
│   ├── db/
│   │   ├── client.ts       # Supabase client singleton with in-memory fallback
│   │   └── queries.ts      # User profile upsert, rollover digest, and state machine
│   ├── ingest/
│   │   ├── sources/        # Real-world 2027 internship feed sources
│   │   ├── geminiParser.ts # Structured JSON extraction using Gemini 2.5 Flash
│   │   └── scorer.ts       # Deterministic priority scorer (0–100)
│   ├── bot/
│   │   ├── index.ts        # grammY bot instance, command & callback query handlers
│   │   ├── keyboards.ts    # Inline keyboards (< 64 bytes callback data)
│   │   └── formatter.ts    # Rich Telegram HTML card templates
│   ├── jobs/
│   │   ├── runIngest.ts    # Ingestion & scoring pipeline CLI
│   │   ├── sendDigest.ts   # 08:00 WAT daily 20 dispatch CLI
│   │   └── sendFollowup.ts # 7-day follow-up check-in CLI
│   └── index.ts            # Entrypoint with startup verification and long-polling
├── test/
│   └── bot.test.ts         # Automated unit test suite (5 comprehensive suites)
├── package.json
└── tsconfig.json
```

---

## 🚀 Production Deployment Guide

### Option 1: Render.com (Free 24/7 Background Worker)
1. Fork or push your code to your GitHub account (`https://github.com/Ogunleyed01/connectMe.git`).
2. Log in to [Render.com](https://render.com) and click **New + -> Background Worker**.
3. Connect your `connectMe` GitHub repository.
4. Render will auto-detect settings from `render.yaml`:
   * **Build Command:** `npm ci && npm run build`
   * **Start Command:** `npm start`
5. In the **Environment Variables** section, add your 4 production keys:
   * `BOT_TOKEN`
   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `GEMINI_API_KEY`
6. Click **Create Background Worker**. Your bot is now permanently online 24/7!

### Option 2: Railway.app (1-Click Worker)
1. Log in to [Railway.app](https://railway.app) and create a **New Project -> Deploy from GitHub repo**.
2. Select `connectMe`. Railway detects the included `Dockerfile` or `Procfile`.
3. Add your environment variables in the Railway dashboard (`Variables` tab).
4. Click **Deploy**. The bot starts automatically.

### Option 3: GitHub Actions Automated Daily Cron (08:00 WAT)
The daily pipeline runs automatically in GitHub Actions for free every day at 08:00 WAT (07:00 UTC):
1. In your GitHub repository, navigate to **Settings** -> **Secrets and variables** -> **Actions**.
2. Under **Repository secrets**, click **New repository secret** and add:
   * `BOT_TOKEN`
   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `GEMINI_API_KEY`
3. Go to the **Actions** tab, select **Daily Internship Scrape & 08:00 WAT Dispatch**, and click **Run workflow** to test it anytime!

