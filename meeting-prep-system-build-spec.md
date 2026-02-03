# Meeting Prep Dossier System
## Complete Build Specification for Claude Code

---

# PART I: VISION & ARCHITECTURE

## 1. Executive Summary

**Product Name:** Meeting Prep Dossier System (Codename: "Sovereign Prep")

**One-Line Vision:** Automatically generate world-class preparation packets before every customer meeting, transforming scattered intelligence into actionable briefings.

**The Problem:** Sales teams waste hours manually researching accounts, re-reading transcripts, and piecing together context. The data exists—scattered across Fireflies, Slack, CRM, and the web—but aggregating it is tedious, inconsistent, and often skipped.

**The Solution:** A local server that runs nightly (or on-demand), identifies upcoming customer meetings, aggregates all relevant intelligence via MCP integrations, and generates comprehensive dossiers. The output is a professional PDF and/or web artifact.

**The Outcome:** Every customer-facing meeting starts with full context. No more "who's on this call?" moments. Deals move faster because nothing falls through the cracks.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SOVEREIGN PREP SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                        SCHEDULER / TRIGGER LAYER                          │  │
│   │                                                                           │  │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                   │  │
│   │   │   Cron Job  │   │  On-Demand  │   │   Webhook   │                   │  │
│   │   │  (Nightly)  │   │    (CLI)    │   │  (Future)   │                   │  │
│   │   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                   │  │
│   │          └─────────────────┼─────────────────┘                           │  │
│   └────────────────────────────┼─────────────────────────────────────────────┘  │
│                                ▼                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                     DATA AGGREGATION LAYER (MCP)                          │  │
│   │                                                                           │  │
│   │   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐              │  │
│   │   │  Google   │ │ Fireflies │ │   Slack   │ │  HubSpot  │              │  │
│   │   │ Calendar  │ │    MCP    │ │    MCP    │ │    MCP    │              │  │
│   │   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘              │  │
│   │         │             │             │             │                      │  │
│   │   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐              │  │
│   │   │ Firecrawl │ │    Exa    │ │  Google   │ │ Playwright│              │  │
│   │   │    MCP    │ │  Websets  │ │  Sheets   │ │    MCP    │              │  │
│   │   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘              │  │
│   │         └─────────────┴─────────────┴─────────────┘                      │  │
│   └────────────────────────────────────────────────────────────────────────-─┘  │
│                                ▼                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                     INTELLIGENCE ENGINE (CORE)                            │  │
│   │                                                                           │  │
│   │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │  │
│   │   │  Data Merger &  │──▶│  Account State  │──▶│  Risk & Gap     │       │  │
│   │   │   Normalizer    │   │    Analyzer     │   │   Detector      │       │  │
│   │   └─────────────────┘   └─────────────────┘   └─────────────────┘       │  │
│   │                                                                           │  │
│   │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │  │
│   │   │   Participant   │   │  Goal & Talking │   │   Competitive   │       │  │
│   │   │    Profiler     │   │ Point Generator │   │ Intel Extractor │       │  │
│   │   └─────────────────┘   └─────────────────┘   └─────────────────┘       │  │
│   └────────────────────────────────────────────────────────────────────────-─┘  │
│                                ▼                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                        OUTPUT GENERATION LAYER                            │  │
│   │                                                                           │  │
│   │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │  │
│   │   │   PDF    │   │   HTML   │   │  Slack   │   │  Google  │            │  │
│   │   │ Dossier  │   │ Artifact │   │  Summary │   │  Drive   │            │  │
│   │   └──────────┘   └──────────┘   └──────────┘   └──────────┘            │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MCP Integration Map

| MCP Server | Purpose | Data Retrieved | Actions |
|------------|---------|----------------|---------|
| **Google Calendar** | Meeting discovery | Events, attendees, times | Read upcoming meetings |
| **Fireflies** | Call intelligence | Transcripts, action items, summaries | Search by account/participant |
| **Slack** | Internal context | Channel mentions, discussions, sentiment | Search messages, get threads |
| **HubSpot** (via Runlayer) | CRM data | Deal stage, value, contacts, activity | Read deal records |
| **Firecrawl** | Web research | LinkedIn profiles, company news | Scrape and extract |
| **Exa Websets** | Structured data | Company info, people data | Query websets, create monitors |
| **Google Sheets** | Config & output | Account mapping, output logs | Read/write spreadsheets |
| **Playwright** | Verification | Screenshots, E2E tests | Automated browser checks |

---

## 4. Data Model

### 4.1 Core Entities

```typescript
// Meeting (from Calendar)
interface Meeting {
  id: string;
  title: string;
  datetime: Date;
  duration: number;
  attendees: Attendee[];
  meetingLink?: string;
  accountId?: string; // Derived from attendee domains
}

// Account (aggregated)
interface Account {
  id: string;
  name: string;
  domain: string;
  dealStage: string;
  dealValue: number;
  closeDate?: Date;
  daysInStage: number;
  lastContactDate: Date;
  momentum: 'accelerating' | 'stable' | 'stalling' | 'at-risk';
  contacts: Contact[];
  timeline: TimelineEvent[];
  openActionItems: ActionItem[];
  risks: Risk[];
}

// Participant (enriched)
interface Participant {
  email: string;
  name: string;
  company: string;
  title: string;
  role: 'champion' | 'blocker' | 'economic-buyer' | 'technical-evaluator' | 'unknown';
  influence: 'high' | 'medium' | 'low';
  linkedInUrl?: string;
  background?: string;
  previousInteractions: Interaction[];
  communicationNotes?: string;
  whatTheyCareAbout?: string[];
}

// Dossier (output)
interface Dossier {
  meeting: Meeting;
  account: Account;
  participants: Participant[];
  executiveSummary: {
    whyThisMeetingMatters: string;
    topGoals: string[];
    redFlags: string[];
  };
  talkingPoints: string[];
  questionsToAsk: string[];
  competitiveIntel?: string;
  generatedAt: Date;
}
```

### 4.2 Data Flow

```
Calendar Event
    ↓
Extract attendee domains → Identify Account
    ↓
┌───────────────────────────────────────────────┐
│           PARALLEL DATA FETCH                  │
├───────────────────────────────────────────────┤
│ Fireflies → Transcripts, action items         │
│ Slack → Mentions, discussions                  │
│ HubSpot → Deal data, contacts                  │
│ Firecrawl → LinkedIn profiles                  │
│ Exa → Company news, funding                    │
└───────────────────────────────────────────────┘
    ↓
Merge & Normalize → Account + Participants
    ↓
Intelligence Analysis → Risks, Gaps, Goals
    ↓
Generate Dossier → PDF + HTML + Slack
```

---

# PART II: DOSSIER TEMPLATE

## 5. Output Specification

### Page 1: Executive Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎯 MEETING PREP: [ACCOUNT NAME]                                        │
│  [Meeting Title]                                                         │
│  [Date] [Time] [Duration]                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DEAL SNAPSHOT                                                           │
│  ┌────────────┬────────────┬────────────┬────────────┬────────────┐    │
│  │   Stage    │   Value    │ Close Date │ Days In    │  Momentum  │    │
│  │    POC     │   $250K    │  Mar 15    │  Stage: 21 │  ████░░░░  │    │
│  └────────────┴────────────┴────────────┴────────────┴────────────┘    │
│                                                                          │
│  WHY THIS MEETING MATTERS                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│  [AI-generated summary of meeting context and importance]                │
│                                                                          │
│  TOP 3 GOALS FOR THIS CALL                                               │
│  ─────────────────────────────────────────────────────────────────────  │
│  1. [Goal with rationale]                                                │
│  2. [Goal with rationale]                                                │
│  3. [Goal with rationale]                                                │
│                                                                          │
│  ⚠️  RED FLAGS / WATCH ITEMS                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  • [Risk 1 with context]                                                 │
│  • [Risk 2 with context]                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Page 2: Participant Profiles

```
┌─────────────────────────────────────────────────────────────────────────┐
│  👥 WHO'S ON THE CALL                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  EXTERNAL ATTENDEES                                                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  [Photo]  MUHAMMAD IKRAM                              🏆 Champion  │ │
│  │           Sr. Engineering Manager, Cloud Native Solutions          │ │
│  │           Influence: HIGH                                          │ │
│  │                                                                    │ │
│  │  Background: 8 years at Toyota, previously AWS Solutions Arch.     │ │
│  │  Last interaction: Jan 29 - POC check-in call                      │ │
│  │  What they care about: Security, compliance, team velocity         │ │
│  │                                                                    │ │
│  │  💡 Talking to Muhammad: Lead with technical depth. He values      │ │
│  │     specifics over hand-waving. Come prepared with architecture.   │ │
│  │                                                                    │ │
│  │  [LinkedIn] muhammad.ikram@toyota.com                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [Additional participant cards...]                                       │
│                                                                          │
│  INTERNAL ATTENDEES                                                      │
│  • Andy Berman — Deal owner, primary relationship                       │
│  • Matthew Walters — Technical lead, deployment specialist              │
│                                                                          │
│  ❓ WHO'S MISSING?                                                       │
│  • Economic buyer (Will Hares) has not been on any calls yet            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Page 3: Account Timeline & Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📅 ENGAGEMENT TIMELINE                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Jan 5   ●━━━ Initial follow-up call (58 min)                           │
│               ✓ Agreed to start POC                                      │
│               📎 transcript attached                                     │
│                                                                          │
│  Jan 12  ●━━━ POC scoping meeting (48 min)                              │
│               ✓ Defined success criteria                                 │
│               ✓ Scheduled deployment for Jan 26                          │
│               📎 transcript attached                                     │
│                                                                          │
│  Jan 26  ●━━━ Deployment prep                                           │
│               ⚠️ Slipped — rescheduled to Feb 12                         │
│                                                                          │
│  Jan 29  ●━━━ POC check-in (20 min)                                     │
│               ✓ Confirmed Feb 12 kickoff                                 │
│               📎 transcript attached                                     │
│                                                                          │
│  Feb 3   ●━━━ TODAY: 11:30 AM CT check-in                               │
│               ↓                                                          │
│  Feb 12  ○    On-site POC deployment (Plano, TX)                        │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  📋 OPEN ACTION ITEMS                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  THEIRS (Toyota):                                                        │
│  □ Umar: Send AWS account IDs (pending since Jan 29) — ⚠️ OVERDUE       │
│  □ Procurement approval (was "1-2 days" on Jan 29) — ⚠️ 5 DAYS LATE     │
│  □ Create Toyota IDs for Runlayer engineers                             │
│                                                                          │
│  OURS:                                                                   │
│  ☑ Andy: POC document feedback — DONE                                   │
│  ☑ Matthew: IAM role documentation — SENT                               │
│  □ Andy: Schedule on-site for week of Feb 17                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Page 4: Insights & Recommendations

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🧠 STRATEGIC INSIGHTS                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ✅ WHAT'S WORKING                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Strong multi-threading: 6+ stakeholders actively engaged             │
│  • High commitment signals: dedicated AWS account, Toyota IDs           │
│  • Technical champion (Muhammad) is driving internally                  │
│                                                                          │
│  ⚠️ WHAT NEEDS ATTENTION                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Procurement timeline slipping (5 days past "1-2 days" estimate)      │
│  • Economic buyers (Will, Gabe, Josh) not yet engaged                   │
│  • IP ownership terms need resolution before deployment in VPC          │
│                                                                          │
│  ❓ QUESTIONS TO ASK THIS CALL                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│  1. "What's the current status on procurement approval?"                │
│  2. "Has Umar been able to provision the AWS account IDs?"              │
│  3. "Can we get 30 min with Will or Gabe during the Feb 12 on-site?"    │
│                                                                          │
│  🚫 THINGS TO AVOID                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│  • Don't assume procurement is done — verify explicitly                 │
│  • Don't schedule Feb 12 dependencies without confirmation              │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  🏁 COMPETITIVE INTEL                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  No competitors detected in conversation history.                       │
│  Monitor for: [known competitors in space]                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# PART III: TECHNICAL IMPLEMENTATION

## 6. Project Structure

```
sovereign-prep/
├── README.md
├── CLAUDE.md                    # Project memory (auto-read by Claude Code)
├── .mcp.json                    # MCP server configuration
├── package.json
├── tsconfig.json
├── .env.example
├── .env                         # Local secrets (gitignored)
│
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Configuration management
│   │
│   ├── scheduler/
│   │   ├── cron.ts              # Nightly job scheduler
│   │   └── trigger.ts           # Manual trigger handler
│   │
│   ├── sources/                 # Data source integrations
│   │   ├── calendar.ts          # Google Calendar API
│   │   ├── fireflies.ts         # Fireflies MCP client
│   │   ├── slack.ts             # Slack MCP client
│   │   ├── hubspot.ts           # HubSpot via Runlayer
│   │   ├── firecrawl.ts         # Firecrawl web research
│   │   ├── exa.ts               # Exa websets
│   │   └── sheets.ts            # Google Sheets for config
│   │
│   ├── intelligence/            # Analysis engines
│   │   ├── merger.ts            # Data aggregation & normalization
│   │   ├── accountAnalyzer.ts   # Account state analysis
│   │   ├── participantProfiler.ts # Participant enrichment
│   │   ├── riskDetector.ts      # Risk & gap identification
│   │   ├── goalGenerator.ts     # Goal & talking point generation
│   │   └── competitiveIntel.ts  # Competitor detection
│   │
│   ├── output/                  # Output generators
│   │   ├── dossierBuilder.ts    # Core dossier assembly
│   │   ├── pdfGenerator.ts      # PDF export (using skill)
│   │   ├── htmlGenerator.ts     # HTML artifact generation
│   │   ├── slackPoster.ts       # Slack notification
│   │   └── driveUploader.ts     # Google Drive storage
│   │
│   ├── types/                   # TypeScript interfaces
│   │   ├── meeting.ts
│   │   ├── account.ts
│   │   ├── participant.ts
│   │   └── dossier.ts
│   │
│   └── utils/
│       ├── logger.ts
│       ├── dateUtils.ts
│       └── textUtils.ts
│
├── templates/
│   ├── dossier.html             # HTML template (Tailwind)
│   └── dossier.css              # Custom styles
│
├── skills/                      # Claude Code skills
│   ├── generate-dossier/
│   │   └── SKILL.md
│   ├── prep-for-meeting/
│   │   └── SKILL.md
│   └── weekly-pipeline-review/
│       └── SKILL.md
│
├── scripts/
│   ├── setup.sh                 # Initial setup script
│   ├── run-nightly.sh           # Cron job script
│   └── test-single.sh           # Test with single meeting
│
└── tests/
    ├── sources/
    ├── intelligence/
    └── output/
```

---

## 7. Configuration Files

### 7.1 CLAUDE.md (Project Memory)

```markdown
# Sovereign Prep — Meeting Dossier System

## Project Overview
Automated meeting preparation system that generates comprehensive dossiers
before customer meetings by aggregating data from Fireflies, Slack, HubSpot,
and web research.

## Tech Stack
- **Runtime:** Node.js 20+ with TypeScript
- **Build:** tsx for development, tsc for production
- **Scheduler:** node-cron for nightly jobs
- **PDF Generation:** Use the pdf skill in .skills/
- **Styling:** Tailwind CSS for HTML artifacts

## Commands
```bash
npm run dev          # Run in development mode
npm run build        # Compile TypeScript
npm run start        # Run production build
npm run generate     # Generate dossiers for tomorrow's meetings
npm run generate:account "Toyota"  # Generate for specific account
npm test             # Run test suite
```

## Architecture Principles
1. **Parallel data fetching** — All MCP calls should be parallelized where possible
2. **Graceful degradation** — If one data source fails, continue with others
3. **Caching** — Cache participant LinkedIn data for 7 days
4. **Idempotency** — Running twice for same meeting should not create duplicates

## Code Conventions
- Use functional programming patterns
- Strict TypeScript (no `any`)
- All async functions must have error handling
- Use Zod for runtime validation of external data
- Prefer early returns over nested conditionals

## MCP Usage
- Fireflies: Use `fireflies_search` with account name, then `fireflies_get_transcript` for details
- Slack: Use `search` with account name, limit to 30 days
- Firecrawl: Use `firecrawl_scrape` for LinkedIn profiles
- Exa: Use `firecrawl_agent` for company research

## Git Workflow
- Branch naming: `feat/description` or `fix/description`
- Commit messages: Conventional commits format
- Always run tests before committing

## Known Issues
- [Track any issues discovered during development]

## Decisions Log
- [Agent should append architectural decisions here]
```

### 7.2 .mcp.json (MCP Configuration)

```json
{
  "mcpServers": {
    "fireflies": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-fireflies"],
      "env": {
        "FIREFLIES_API_KEY": "${FIREFLIES_API_KEY}"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    },
    "google-sheets": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-google-sheets"],
      "env": {
        "GOOGLE_CREDENTIALS": "${GOOGLE_CREDENTIALS}"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-firecrawl"],
      "env": {
        "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
      }
    },
    "exa": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-exa"],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright"]
    }
  }
}
```

### 7.3 Skills

#### skills/generate-dossier/SKILL.md

```yaml
---
name: generate-dossier
description: Generate a meeting prep dossier for a specific account or meeting
---

# Generate Dossier Skill

## Trigger
User says: "Generate dossier for [account]" or "Prep me for [meeting]"

## Protocol

### Step 1: Identify Meeting
- If account name provided, search calendar for upcoming meetings with that domain
- If meeting ID provided, fetch meeting details directly
- Confirm meeting details with user before proceeding

### Step 2: Parallel Data Fetch
Execute these in parallel:
1. **Fireflies**: `fireflies_search` with account name → get transcript IDs → `fireflies_get_transcript` for each
2. **Slack**: `slack_search` for account mentions in last 30 days
3. **HubSpot**: Query deal data via Runlayer plugin
4. **Firecrawl**: For each external attendee, scrape LinkedIn profile
5. **Exa**: `firecrawl_agent` to find recent company news

### Step 3: Merge & Analyze
- Normalize all data into Account and Participant models
- Run risk detection (look for: timeline slippage, missing stakeholders, stale communication)
- Generate goals based on deal stage and recent activity
- Extract action items from transcripts

### Step 4: Generate Output
- Build dossier object
- Generate PDF using pdf skill
- Generate HTML artifact for web viewing
- Save to Google Drive: `/Meeting Prep/{date}/{account}/`
- Post summary to Slack channel

### Step 5: Verify
- Use Playwright to open the HTML artifact and screenshot
- Confirm PDF is valid and readable
- Report completion with links

## Error Handling
- If Fireflies returns no results, note "No call history" in dossier
- If LinkedIn scrape fails, continue without profile enrichment
- If any critical error, notify user before aborting
```

---

## 8. Execution Plan

### Phase 1: Foundation (Days 1-2)
**Goal:** Project scaffold and data source connections

**Tasks:**
1. [ ] Initialize project with TypeScript, ESLint, Prettier
2. [ ] Set up environment configuration (dotenv)
3. [ ] Create type definitions (Meeting, Account, Participant, Dossier)
4. [ ] Implement Fireflies client (search + fetch transcript)
5. [ ] Implement Slack client (search messages)
6. [ ] Write integration tests for each source

**Verification:**
- [ ] Can fetch Fireflies transcripts for "Toyota"
- [ ] Can search Slack for "Toyota" mentions
- [ ] All tests pass

### Phase 2: Data Aggregation (Days 3-4)
**Goal:** Merge data from multiple sources into unified model

**Tasks:**
1. [ ] Implement Google Calendar integration (upcoming meetings)
2. [ ] Implement data merger (normalize across sources)
3. [ ] Implement participant profiler (Firecrawl LinkedIn)
4. [ ] Implement company research (Exa/Firecrawl)
5. [ ] Build account state analyzer

**Verification:**
- [ ] Can pull tomorrow's meetings from calendar
- [ ] Can merge Fireflies + Slack data for single account
- [ ] LinkedIn profiles successfully scraped

### Phase 3: Intelligence Engine (Days 5-6)
**Goal:** Generate insights from aggregated data

**Tasks:**
1. [ ] Implement risk detector
2. [ ] Implement goal generator
3. [ ] Implement talking point generator
4. [ ] Implement competitive intel extractor
5. [ ] Build timeline constructor from events

**Verification:**
- [ ] Risks correctly identified for Toyota (procurement delay)
- [ ] Goals make sense for current deal stage
- [ ] Timeline accurately reflects engagement history

### Phase 4: Output Generation (Days 7-8)
**Goal:** Produce professional dossier artifacts

**Tasks:**
1. [ ] Design HTML template (Tailwind CSS)
2. [ ] Implement HTML generator
3. [ ] Implement PDF generator (using skill)
4. [ ] Implement Slack summary poster
5. [ ] Implement Google Drive uploader

**Verification:**
- [ ] PDF renders correctly with all sections
- [ ] HTML artifact displays properly in browser
- [ ] Slack summary posts to correct channel
- [ ] Files appear in Google Drive

### Phase 5: Automation (Days 9-10)
**Goal:** Scheduled execution and reliability

**Tasks:**
1. [ ] Implement cron scheduler (9 PM nightly)
2. [ ] Add error handling and retry logic
3. [ ] Implement logging and monitoring
4. [ ] Build on-demand CLI trigger
5. [ ] Write SKILL.md files for Claude Code

**Verification:**
- [ ] Cron job executes at scheduled time
- [ ] Failures logged with context
- [ ] Manual trigger works via CLI

### Phase 6: Polish & Launch (Days 11-12)
**Goal:** Production readiness

**Tasks:**
1. [ ] End-to-end test with Playwright verification
2. [ ] Performance optimization (parallel fetches)
3. [ ] Documentation (README, setup guide)
4. [ ] Team onboarding materials
5. [ ] Deploy and monitor first week

**Verification:**
- [ ] Full flow works for 5 different accounts
- [ ] Dossiers generated in < 60 seconds
- [ ] Team successfully uses system for real meetings

---

# PART IV: WORKFLOW ORCHESTRATION

## 9. Claude Code Operating Principles

*From the Sovereign Builder research and workflow guidelines:*

### 9.1 Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Write detailed specs upfront to reduce ambiguity

### 9.2 Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### 9.3 Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"

### 9.4 Self-Improvement Loop
- After ANY correction, update lessons.md with the pattern
- Write rules that prevent the same mistake
- Review lessons at session start

### 9.5 Demand Elegance (Balanced)
- For non-trivial changes, pause and ask "is there a more elegant way?"
- If a fix feels hacky, implement the elegant solution
- Skip this for simple, obvious fixes

---

## 10. Quality Gates

Each phase must pass these gates before proceeding:

| Gate | Criteria |
|------|----------|
| **Code Quality** | TypeScript strict mode passes, no `any` types |
| **Test Coverage** | Unit tests for all core functions |
| **Integration Test** | End-to-end flow works for at least one account |
| **Documentation** | Functions have JSDoc comments |
| **Security** | No hardcoded secrets, env vars used |
| **Performance** | Response time < 60 seconds for full dossier |

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Coverage** | 100% of customer meetings have dossiers | Count dossiers / meetings |
| **Accuracy** | 90%+ of data points are correct | Manual review sample |
| **Timeliness** | Dossiers ready 12+ hours before meeting | Timestamp check |
| **Adoption** | Team uses dossiers for 80%+ of calls | Self-reported |
| **Velocity** | Prep time reduced by 80% | Before/after comparison |

---

# PART V: APPENDIX

## A. Sample API Responses

### Fireflies Transcript Search
```json
{
  "results": [
    {
      "id": "01KG15APPNMB0D1KQ25TTMQXRE",
      "title": "Runlayer / Toyota - POC Check In",
      "date": "2026-01-29T15:30:00.000Z",
      "duration": 19.8,
      "participants": ["muhammad.ikram@toyota.com", "andy@runlayer.com"],
      "summary": "Scheduled deployment for Feb 12..."
    }
  ]
}
```

### Slack Search
```json
{
  "matches": [
    {
      "channel": "sales-deals",
      "user": "Andy Berman",
      "text": "Toyota POC update: deployment scheduled for Feb 12",
      "timestamp": "2026-01-29T16:00:00.000Z",
      "permalink": "https://slack.com/..."
    }
  ]
}
```

## B. Environment Variables

```bash
# .env.example
FIREFLIES_API_KEY=
SLACK_TOKEN=
GOOGLE_CREDENTIALS=
FIRECRAWL_API_KEY=
EXA_API_KEY=
HUBSPOT_API_KEY=
OPENAI_API_KEY=        # For embeddings if needed
OUTPUT_DIR=/path/to/google/drive/Meeting Prep
SLACK_CHANNEL=#sales-deals
```

## C. Cron Schedule

```bash
# Run nightly at 9 PM local time
0 21 * * * cd /path/to/sovereign-prep && npm run generate >> /var/log/sovereign-prep.log 2>&1
```

---

*Build Specification v1.0*
*Generated: February 3, 2026*
*System: Sovereign Prep — Meeting Dossier System*
