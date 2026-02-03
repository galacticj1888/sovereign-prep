# Sovereign Prep — Meeting Dossier System

## Project Overview
Automated meeting preparation system that generates comprehensive dossiers
before customer meetings by aggregating data from Fireflies, Slack, HubSpot,
and web research.

## Tech Stack
- **Runtime:** Node.js 20+ with TypeScript
- **Build:** tsx for development, tsc for production
- **Scheduler:** node-cron for nightly jobs
- **Testing:** Vitest for unit tests, custom E2E runner
- **Styling:** Tailwind CSS (via CDN) for HTML artifacts

## Commands
```bash
npm run dev          # Run in development mode (watch)
npm run build        # Compile TypeScript
npm run start        # Run production build
npm run cli          # Run CLI directly with tsx
npm run generate     # Generate dossiers for tomorrow's meetings
npm run generate:account "Toyota"  # Generate for specific account
npm run generate:quick "Toyota"    # Quick generation (no API calls)
npm run scheduler    # Start the scheduler daemon
npm run scheduler:status  # Check scheduler status
npm run demo         # Run demo script
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run typecheck    # Type check without emitting
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run end-to-end tests
```

## Project Structure
```
sovereign-prep/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── config.ts           # Configuration management
│   ├── index.ts            # Entry point
│   │
│   ├── scheduler/          # Scheduling & triggers
│   │   ├── cron.ts         # Cron job scheduler
│   │   ├── trigger.ts      # Manual trigger handlers
│   │   └── index.ts
│   │
│   ├── sources/            # Data source integrations (MCP)
│   │   ├── fireflies.ts    # Fireflies transcript client
│   │   ├── slack.ts        # Slack message client
│   │   ├── calendar.ts     # Google Calendar client
│   │   ├── exa.ts          # Exa web research client
│   │   └── index.ts
│   │
│   ├── intelligence/       # Analysis engines
│   │   ├── merger.ts           # Data aggregation
│   │   ├── accountAnalyzer.ts  # Account state analysis
│   │   ├── participantProfiler.ts # Participant enrichment
│   │   ├── goalGenerator.ts    # Goal generation
│   │   ├── talkingPointGenerator.ts # Talking points
│   │   ├── competitiveIntel.ts # Competitor detection
│   │   ├── dossierAssembler.ts # Main orchestrator
│   │   └── index.ts
│   │
│   ├── output/             # Output generators
│   │   ├── htmlGenerator.ts    # HTML dossier generation
│   │   ├── slackPoster.ts      # Slack message formatting
│   │   ├── driveUploader.ts    # Google Drive integration
│   │   └── index.ts
│   │
│   ├── types/              # TypeScript definitions
│   │   ├── meeting.ts      # Meeting types
│   │   ├── account.ts      # Account types
│   │   ├── participant.ts  # Participant types
│   │   ├── dossier.ts      # Dossier types
│   │   └── index.ts
│   │
│   └── utils/              # Utilities
│       ├── logger.ts       # Logging
│       ├── dateUtils.ts    # Date formatting
│       ├── retry.ts        # Retry logic & circuit breaker
│       └── index.ts
│
├── tests/
│   ├── sources/            # Data source tests
│   ├── intelligence/       # Intelligence engine tests
│   ├── output/             # Output generation tests
│   ├── scheduler/          # Scheduler tests
│   ├── utils/              # Utility tests
│   └── e2e/                # End-to-end tests
│
├── skills/                 # Claude Code skills
│   ├── generate-dossier/   # Full dossier generation
│   └── prep-for-meeting/   # Quick meeting prep
│
├── scripts/                # Deployment scripts
│   ├── setup.sh           # Initial setup
│   ├── run-nightly.sh     # Cron job script
│   └── test-single.sh     # Single account test
│
└── templates/              # HTML templates
    └── dossier.html       # Dossier template
```

## Architecture Principles
1. **Parallel data fetching** — All MCP calls parallelized with Promise.allSettled
2. **Graceful degradation** — If one data source fails, continue with others
3. **Retry with backoff** — Exponential backoff for transient failures
4. **Circuit breaker** — Prevent cascade failures from unhealthy services
5. **Idempotency** — Running twice for same meeting won't create duplicates

## Code Conventions
- Functional programming patterns (pure functions where possible)
- Strict TypeScript (no `any` types)
- All async functions must have error handling
- Use Zod for runtime validation of external data
- Prefer early returns over nested conditionals
- No unused variables or imports (TypeScript strict mode)

## MCP Integration
This project uses MCP tools via the `account-intelligence` plugin:

### Fireflies
- `fireflies__fireflies_search` — Search transcripts with query grammar
- `fireflies__fireflies_get_transcript` — Get detailed transcript by ID
- `fireflies__fireflies_get_summary` — Get meeting summary and action items

### Slack
- `slack_search` — Search messages across channels
- `slack_get_thread_messages` — Get thread replies
- `slack_fetch` — Fetch specific message
- `slack_post_message` — Post summary to channel

### Google Drive
- `mcp__rl-google-drive__create_folder` — Create folder structure
- `mcp__rl-google-drive__create_file` — Upload HTML/JSON files
- `mcp__rl-google-drive__search` — Find existing folders

### Google Calendar
- `mcp__google-calendar-2__list_events` — Get upcoming meetings

## Data Flow
```
Calendar Event
    ↓
Extract attendee domains → Identify Account
    ↓
┌─────────────────────────────────────┐
│       PARALLEL DATA FETCH           │
├─────────────────────────────────────┤
│ Fireflies → Transcripts, action items│
│ Slack → Mentions, discussions        │
│ Calendar → Related events            │
│ Exa → Company news (optional)        │
└─────────────────────────────────────┘
    ↓
Merge & Normalize → Account + Participants
    ↓
Intelligence Analysis → Risks, Gaps, Goals
    ↓
Generate Dossier → HTML + Slack + Drive
```

## Git Workflow
- Branch naming: `feat/description` or `fix/description`
- Commit messages: Conventional commits format
- Always run tests before committing

## Test Coverage
- **245 unit tests** across all modules
- **7 E2E tests** for full pipeline verification
- Performance target: < 100ms for dossier generation

## Known Issues
None currently.

## Decisions Log
- 2026-02-03: Using MCP-based integration via account-intelligence plugin
- 2026-02-03: Using Vitest for testing framework
- 2026-02-03: TypeScript strict mode enabled, no `any` types allowed
- 2026-02-03: Tailwind CSS via CDN for HTML styling
- 2026-02-03: node-cron for scheduler (9 PM nightly)
- 2026-02-03: Promise.allSettled for graceful parallel fetching
