# Meeting Prep Dossier System

## Project Vision

**One sentence:** Automatically generate world-class preparation packets before every customer meeting, so every rep walks in sharp with full context on the account, the people, and the path forward.

**The problem:** Sales teams spend hours manually researching accounts, re-reading transcripts, and piecing together context before important meetings. Most of that context already exists—scattered across Fireflies, Slack, CRM, email, and the web. The prep work is tedious, inconsistent, and often skipped entirely.

**The solution:** A system that runs nightly (or on-demand), identifies upcoming customer meetings, aggregates all relevant intelligence, and generates a comprehensive dossier for each meeting. The output is a single artifact (PDF, web page, or Slack message) that contains everything you need to know.

**The outcome:** Every customer-facing meeting starts with the team fully prepared. No more "who's on this call again?" or "where did we leave off?" moments. Deals move faster because nothing falls through the cracks.

---

## Core Capabilities

### 1. Meeting Discovery
- Pull upcoming calendar events (next 24-48 hours)
- Filter to customer/prospect meetings (by domain, tag, or meeting title pattern)
- Extract attendee list and meeting metadata

### 2. Account Intelligence
- Identify the account (company) associated with the meeting
- Pull CRM data: deal stage, value, close date, owner, activity history
- Pull internal comms: Slack mentions, sentiment, recent discussions
- Pull conversation history: Fireflies transcripts, action items, key moments
- Compute engagement metrics: days since last contact, response rates, momentum

### 3. Participant Research
- For each external attendee:
  - LinkedIn profile: role, tenure, background, mutual connections
  - Previous interactions: calls they've been on, emails exchanged
  - Inferred persona: champion, blocker, economic buyer, technical evaluator
  - Communication style notes (if available from transcripts)
- For internal attendees:
  - Role on the deal
  - Their last touchpoint with this account

### 4. Company Research
- Recent news and press (via Firecrawl/Exa)
- Funding rounds, acquisitions, leadership changes
- Org structure and reporting lines (if discoverable)
- Competitive landscape: who else might be in the deal

### 5. Dossier Generation
- Compile all data into a structured, readable format
- Generate insights: risks, gaps, recommended actions
- Produce output: PDF, HTML, or Slack summary
- Save to central location (Google Drive, Notion, or CRM)

### 6. Post-Meeting Feedback Loop
- After the meeting, prompt for outcomes
- Update action items and deal status
- Feed learnings back into the system for future prep

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MEETING PREP SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────┐     │
│  │  SCHEDULER  │    │              DATA AGGREGATION LAYER              │     │
│  │             │    │                                                  │     │
│  │  - Cron     │───▶│  ┌─────────┐ ┌──────────┐ ┌─────────┐          │     │
│  │  - Manual   │    │  │Calendar │ │ Fireflies│ │  Slack  │          │     │
│  │  - Webhook  │    │  │  API    │ │   MCP    │ │   MCP   │          │     │
│  └─────────────┘    │  └────┬────┘ └────┬─────┘ └────┬────┘          │     │
│                     │       │           │            │                │     │
│                     │       ▼           ▼            ▼                │     │
│                     │  ┌─────────┐ ┌──────────┐ ┌─────────┐          │     │
│                     │  │ HubSpot │ │ Firecrawl│ │   Exa   │          │     │
│                     │  │   MCP   │ │   MCP    │ │ Websets │          │     │
│                     │  └────┬────┘ └────┬─────┘ └────┬────┘          │     │
│                     │       │           │            │                │     │
│                     │       └───────────┼────────────┘                │     │
│                     │                   ▼                             │     │
│                     │         ┌─────────────────┐                     │     │
│                     │         │  DATA MERGER &  │                     │     │
│                     │         │   NORMALIZER    │                     │     │
│                     │         └────────┬────────┘                     │     │
│                     └──────────────────┼────────────────────────────-─┘     │
│                                        │                                     │
│                                        ▼                                     │
│                     ┌──────────────────────────────────────────────────┐    │
│                     │            INTELLIGENCE ENGINE                    │    │
│                     │                                                   │    │
│                     │  - Account state analysis                         │    │
│                     │  - Participant profiling                          │    │
│                     │  - Risk/gap detection                             │    │
│                     │  - Goal recommendation                            │    │
│                     │  - Talking point generation                       │    │
│                     └────────────────────┬─────────────────────────────┘    │
│                                          │                                   │
│                                          ▼                                   │
│                     ┌──────────────────────────────────────────────────┐    │
│                     │            OUTPUT GENERATION                      │    │
│                     │                                                   │    │
│                     │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │    │
│                     │  │  PDF   │  │  HTML  │  │ Slack  │  │ GDrive │ │    │
│                     │  │ Export │  │  View  │  │  Post  │  │  Save  │ │    │
│                     │  └────────┘  └────────┘  └────────┘  └────────┘ │    │
│                     └──────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources & Integrations

| Source | Purpose | Integration Method |
|--------|---------|-------------------|
| **Google Calendar** | Meeting discovery, attendee list | Google API or Chrome MCP |
| **Fireflies** | Call transcripts, action items, conversation history | Fireflies MCP |
| **Slack** | Internal discussions, account mentions, sentiment | Slack MCP |
| **HubSpot** | Deal data, stage, value, activity log, contacts | HubSpot MCP (via Runlayer) |
| **Firecrawl** | LinkedIn profiles, company research, news | Firecrawl MCP |
| **Exa Websets** | Structured company/people data, monitoring | Exa MCP |
| **Google Sheets** | Config, account mapping, output logging | Google Sheets MCP |
| **Google Drive** | Dossier storage, team access | Google Drive API |

---

## Dossier Template

### Page 1: Executive Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  MEETING PREP: [Account Name]                                   │
│  [Meeting Title] | [Date] [Time]                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DEAL SNAPSHOT                                                   │
│  ┌────────────┬────────────┬────────────┬────────────┐         │
│  │   Stage    │   Value    │ Close Date │  Days In   │         │
│  │    POC     │   $250K    │  Mar 15    │   Stage: 21│         │
│  └────────────┴────────────┴────────────┴────────────┘         │
│                                                                  │
│  MOMENTUM: ████████░░ Healthy (last contact: 2 days ago)        │
│                                                                  │
│  WHY THIS MEETING MATTERS                                        │
│  POC kickoff check-in. Need to confirm procurement approved     │
│  and AWS access provisioned before Feb 12 deployment.           │
│                                                                  │
│  TOP 3 GOALS FOR THIS CALL                                       │
│  1. Confirm procurement status (blocker if not approved)        │
│  2. Verify AWS account IDs received by Matthew                  │
│  3. Get commitment on leadership meeting during on-site         │
│                                                                  │
│  RED FLAGS / WATCH ITEMS                                         │
│  ⚠️  Procurement was "1-2 days" on Jan 29 — now 5 days later   │
│  ⚠️  Economic buyer (Will Hares) not yet engaged                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Page 2: Participant Profiles

```
┌─────────────────────────────────────────────────────────────────┐
│  WHO'S ON THE CALL                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EXTERNAL (Toyota)                                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Muhammad Ikram                                           │  │
│  │  Sr. Engineering Manager, Cloud Native Solutions          │  │
│  │  Role: Technical Champion | Influence: High               │  │
│  │                                                           │  │
│  │  Background: 8 years at Toyota, previously AWS            │  │
│  │  Last interaction: Jan 29 POC check-in call               │  │
│  │  What he cares about: Security, compliance, team velocity │  │
│  │                                                           │  │
│  │  [LinkedIn] muhammad.ikram@toyota.com                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Umar Lateef                                              │  │
│  │  Sr. Staff Engineer                                       │  │
│  │  Role: Technical Evaluator | Influence: Medium            │  │
│  │                                                           │  │
│  │  Background: Cloud infrastructure specialist              │  │
│  │  Last interaction: Jan 29 POC check-in call               │  │
│  │  Action item: Send AWS account IDs (pending)              │  │
│  │                                                           │  │
│  │  [LinkedIn] umar.lateef@toyota.com                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  INTERNAL (Runlayer)                                            │
│  • Andy Berman — Deal owner, primary relationship              │
│  • Matthew Walters — Technical lead, deployment                │
│  • Tal Peretz — Product/technical support                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Page 3: Account History & Context

```
┌─────────────────────────────────────────────────────────────────┐
│  ENGAGEMENT TIMELINE                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Jan 5   ●━━━ Initial follow-up call (58 min)                   │
│               Agreed to start POC                                │
│                                                                  │
│  Jan 12  ●━━━ POC scoping meeting (48 min)                      │
│               Defined success criteria, deployment plan          │
│                                                                  │
│  Jan 22  ●━━━ Check-in scheduled (did it happen?)               │
│                                                                  │
│  Jan 26  ●━━━ Teams channel setup, deployment prep              │
│                                                                  │
│  Jan 29  ●━━━ POC check-in (20 min)                             │
│               Scheduled Feb 12 kickoff                           │
│                                                                  │
│  Feb 3   ●━━━ TODAY: 11:30 AM CT check-in                       │
│               ↓                                                  │
│  Feb 12  ○    On-site POC deployment (Plano, TX)                │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  OPEN ACTION ITEMS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  THEIRS:                                                         │
│  □ Umar: Send AWS account IDs (pending since Jan 29)            │
│  □ Procurement approval (was "1-2 days" — now overdue?)         │
│  □ Create Toyota IDs for Runlayer engineers                     │
│                                                                  │
│  OURS:                                                           │
│  ☑ Andy: POC document feedback (done?)                          │
│  ☑ Matthew: IAM role documentation sent                         │
│  □ Andy: Schedule on-site for week of Feb 17                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Page 4: Insights & Recommendations

```
┌─────────────────────────────────────────────────────────────────┐
│  STRATEGIC INSIGHTS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHAT'S WORKING                                                  │
│  ✓ Strong multi-threading (6+ stakeholders engaged)             │
│  ✓ High commitment: dedicated AWS account, Toyota IDs           │
│  ✓ Technical champion (Muhammad) is actively driving            │
│                                                                  │
│  WHAT NEEDS ATTENTION                                            │
│  ⚠ Procurement timeline slipping (5 days past "1-2 days")       │
│  ⚠ Economic buyers not yet engaged (Will, Gabe, Josh)           │
│  ⚠ IP ownership terms need resolution before deployment         │
│                                                                  │
│  QUESTIONS TO ASK THIS CALL                                      │
│  1. "What's the current status on procurement approval?"        │
│  2. "Has Umar been able to provision the AWS account IDs?"      │
│  3. "Can we get 30 min with Will or Gabe during the Feb 12      │
│      on-site to share the POC roadmap?"                         │
│                                                                  │
│  THINGS TO AVOID                                                 │
│  ✗ Don't assume procurement is done — verify explicitly         │
│  ✗ Don't schedule Feb 12 without confirming dependencies        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  COMPETITIVE INTEL                                              │
├─────────────────────────────────────────────────────────────────┤
│  No competitors detected in conversation history.               │
│  Monitor for: [list any known competitors]                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Execution Modes

### Mode 1: Nightly Batch Job
```
Schedule: Every day at 9 PM local time
Scope: All customer meetings in the next 24 hours
Output: PDFs saved to Google Drive, summary posted to Slack
```

### Mode 2: On-Demand Generation
```
Trigger: User request ("prep me for my Toyota call")
Scope: Single meeting or account
Output: Real-time generation, immediate delivery
```

### Mode 3: Weekly Pipeline Review
```
Schedule: Every Sunday at 6 PM
Scope: All active deals with meetings in the coming week
Output: Pipeline summary with per-account dossiers
```

---

## Technical Implementation Options

### Option A: Local Python Server

```
/meeting-prep-system/
├── main.py                 # Entry point, scheduler
├── config.yaml             # API keys, settings
├── sources/
│   ├── calendar.py         # Google Calendar integration
│   ├── fireflies.py        # Fireflies MCP client
│   ├── slack.py            # Slack MCP client
│   ├── hubspot.py          # HubSpot MCP client
│   ├── firecrawl.py        # Web research
│   └── exa.py              # Company/people data
├── intelligence/
│   ├── merger.py           # Data aggregation
│   ├── analyzer.py         # Risk/gap detection
│   └── recommender.py      # Goal/talking point generation
├── output/
│   ├── pdf_generator.py    # PDF export
│   ├── html_generator.py   # Web view
│   └── slack_poster.py     # Slack integration
└── templates/
    ├── dossier.html        # HTML template
    └── dossier.css         # Styling
```

**Run locally with cron:**
```bash
# Every night at 9 PM
0 21 * * * cd /path/to/meeting-prep-system && python main.py
```

### Option B: Runlayer Skill

Build as a Runlayer plugin that:
1. Connects to: Fireflies, Slack, HubSpot, Firecrawl, Exa
2. Exposes tools: `generate_dossier`, `prep_for_meeting`, `weekly_pipeline_review`
3. Uses dynamic tools mode for flexibility
4. Outputs to Google Drive or Slack

**Advantages:**
- Shareable with team
- Governed and auditable
- No local infrastructure

### Option C: Hybrid (Recommended for MVP)

1. **Exa Monitor** — Runs nightly, updates a webset with company/people data
2. **Local script** — Pulls calendar, queries MCPs, generates dossiers
3. **Google Drive** — Stores output PDFs in `/Meeting Prep/{date}/`
4. **Slack notification** — Posts summary with links to dossiers

---

## Phased Rollout

### Phase 1: Prove the Data (Week 1)
- [ ] Build script to pull calendar events
- [ ] Connect to Fireflies, Slack, HubSpot
- [ ] Merge data for a single account (Toyota as test case)
- [ ] Generate raw JSON output

### Phase 2: Intelligence Layer (Week 2)
- [ ] Build participant profiling (Firecrawl LinkedIn scraping)
- [ ] Add company research (Exa websets, news)
- [ ] Implement risk/gap detection logic
- [ ] Generate goal recommendations

### Phase 3: Output Generation (Week 3)
- [ ] Design PDF/HTML template
- [ ] Build generator from merged data
- [ ] Save to Google Drive
- [ ] Post to Slack

### Phase 4: Automation (Week 4)
- [ ] Set up cron job / scheduler
- [ ] Add error handling, logging
- [ ] Build on-demand trigger (Slack command or CLI)
- [ ] Team rollout

### Phase 5: Feedback Loop (Future)
- [ ] Post-meeting capture flow
- [ ] Action item tracking
- [ ] Historical pattern analysis
- [ ] Confidence scoring

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Dossier generation rate | 100% of customer meetings covered |
| Prep time reduction | 80% less manual research |
| Meeting quality score | Self-reported improvement |
| Deal velocity | Faster stage progression |
| Action item completion | Higher follow-through rate |

---

## Open Questions

1. **Calendar access** — Google Calendar API vs. Chrome extension vs. something else?
2. **Meeting classification** — How do we distinguish customer meetings from internal meetings?
3. **Participant matching** — How do we link attendees to CRM contacts?
4. **Sensitive data** — Any concerns about storing dossiers in Google Drive?
5. **Team access** — Should dossiers be per-rep or shared?

---

## Next Steps

1. **Validate data access** — Confirm we can pull from all sources (Calendar, Fireflies, Slack, HubSpot, Firecrawl, Exa)
2. **Build Toyota proof-of-concept** — Generate a full dossier for an upcoming Toyota meeting
3. **Design output template** — Decide PDF vs. HTML vs. both
4. **Choose execution model** — Local script vs. Runlayer skill vs. hybrid
5. **Set up automation** — Cron job or scheduled trigger

---

*Document generated: February 3, 2026*
*System: Meeting Prep Dossier v0.1*
