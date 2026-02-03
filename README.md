# Sovereign Prep

**Meeting Prep Dossier System** - Automatically generate world-class preparation packets before every customer meeting.

## Overview

Sovereign Prep aggregates data from multiple sources (Fireflies, Slack, Google Calendar, web research) to produce comprehensive meeting dossiers. The system runs nightly at 9 PM to prepare dossiers for the next day's meetings, or can be triggered on-demand for specific accounts.

### Key Features

- **Automated Dossier Generation** - Comprehensive meeting prep packets
- **Multi-Source Intelligence** - Fireflies transcripts, Slack mentions, calendar events
- **Professional Output** - HTML dossiers with Tailwind CSS styling
- **Slack Integration** - Summary notifications via Slack Block Kit
- **Google Drive Storage** - Organized folder structure for artifacts
- **Scheduled Execution** - Nightly cron job at 9 PM
- **On-Demand Generation** - CLI for manual dossier creation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOVEREIGN PREP SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     SCHEDULER / TRIGGER LAYER                        │   │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │   │
│   │   │   Cron Job  │   │  On-Demand  │   │     CLI     │               │   │
│   │   │  (Nightly)  │   │   Trigger   │   │  Commands   │               │   │
│   │   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘               │   │
│   └──────────┼─────────────────┼─────────────────┼───────────────────────┘   │
│              └─────────────────┼─────────────────┘                           │
│                                ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  DATA AGGREGATION LAYER (MCP)                        │   │
│   │   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │   │
│   │   │ Fireflies │ │   Slack   │ │  Calendar │ │    Exa    │           │   │
│   │   │Transcripts│ │  Mentions │ │   Events  │ │  Research │           │   │
│   │   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘           │   │
│   └─────────┼─────────────┼─────────────┼─────────────┼──────────────────┘   │
│             └─────────────┴──────┬──────┴─────────────┘                      │
│                                  ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    INTELLIGENCE ENGINE (CORE)                        │   │
│   │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │   │
│   │   │   Data Merger   │ │ Account Analyzer│ │  Risk Detector  │       │   │
│   │   └────────┬────────┘ └────────┬────────┘ └────────┬────────┘       │   │
│   │            │                   │                   │                 │   │
│   │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │   │
│   │   │  Goal Generator │ │ Talking Points  │ │Competitive Intel│       │   │
│   │   └────────┬────────┘ └────────┬────────┘ └────────┬────────┘       │   │
│   └────────────┼───────────────────┼───────────────────┼─────────────────┘   │
│                └───────────────────┼───────────────────┘                     │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      OUTPUT GENERATION LAYER                         │   │
│   │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │   │
│   │   │   HTML   │   │  Slack   │   │  Google  │   │   JSON   │         │   │
│   │   │ Dossier  │   │ Summary  │   │   Drive  │   │  Export  │         │   │
│   │   └──────────┘   └──────────┘   └──────────┘   └──────────┘         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Node.js 20+
- npm or yarn
- MCP server access (Fireflies, Slack, Google Calendar)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd sovereign-prep

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# (see Configuration section)

# Build the project
npm run build

# Run tests to verify setup
npm test
```

## Configuration

Create a `.env` file with the following variables:

```bash
# Slack Configuration
SLACK_CHANNEL=#sales-deals

# Google Drive Configuration
DRIVE_FOLDER_ID=your-folder-id

# Output Configuration
OUTPUT_DIR=./output

# Timezone for scheduler
TIMEZONE=America/Chicago
```

## Usage

### CLI Commands

```bash
# Generate dossiers for tomorrow's meetings
npm run generate

# Generate dossier for specific account
npm run generate:account "Toyota"

# Quick dossier (no external data fetch)
npm run generate:quick "Toyota"

# Start the scheduler daemon
npm run scheduler

# Check scheduler status
npm run scheduler:status
```

### Programmatic Usage

```typescript
import { triggerDossierGeneration } from './scheduler/trigger.js';

const result = await triggerDossierGeneration({
  accountName: 'Toyota',
  accountDomain: 'toyota.com',
  slackChannel: '#sales-deals',
});

if (result.success) {
  console.log('Dossier generated:', result.dossier);
  console.log('HTML:', result.htmlContent);
}
```

### Claude Code Skills

Use the built-in skills for interactive dossier generation:

```
# Generate full dossier
"Generate dossier for Toyota"

# Quick meeting prep
"Prep me for my Toyota call at 11:30"
```

## Dossier Contents

Each generated dossier includes:

1. **Executive Summary**
   - Why this meeting matters
   - Top 3 goals for the call
   - Red flags / watch items

2. **Deal Snapshot**
   - Stage, value, momentum
   - Days in stage
   - Close date

3. **Participant Profiles**
   - External attendees with roles
   - Internal team members
   - Missing stakeholders

4. **Engagement Timeline**
   - Historical interactions
   - Key milestones
   - Upcoming events

5. **Action Items**
   - Open items (theirs and ours)
   - Overdue tracking

6. **Strategic Insights**
   - What's working
   - Needs attention
   - Questions to ask
   - Things to avoid

7. **Competitive Intel**
   - Competitor mentions
   - Risks and differentiators

8. **Talking Points**
   - Contextualized conversation starters
   - Goal-aligned discussion points

## Development

### Project Structure

```
sovereign-prep/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── scheduler/          # Cron and trigger handlers
│   ├── sources/            # Data source integrations
│   ├── intelligence/       # Analysis engines
│   ├── output/             # Output generators
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utilities
├── tests/
│   ├── sources/            # Source tests
│   ├── intelligence/       # Intelligence tests
│   ├── output/             # Output tests
│   ├── scheduler/          # Scheduler tests
│   └── e2e/                # End-to-end tests
├── skills/                 # Claude Code skills
├── scripts/                # Setup and deployment
└── templates/              # HTML templates
```

### Commands

```bash
npm run dev          # Development mode with watch
npm run build        # Build TypeScript
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run typecheck    # Type check without emit
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run end-to-end tests
```

### Testing

```bash
# Run all tests
npm test

# Run tests for specific module
npm test -- --filter="intelligence"

# Run E2E tests
npm run test:e2e
```

## Deployment

### Manual Cron Setup

Add to crontab for nightly execution:

```bash
# Run nightly at 9 PM
0 21 * * * cd /path/to/sovereign-prep && npm run generate >> /var/log/sovereign-prep.log 2>&1
```

### Using Built-in Scheduler

```bash
# Start the scheduler daemon
npm run scheduler

# The scheduler runs at 9 PM in the configured timezone
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/cli.js", "scheduler:start"]
```

## MCP Integration

Sovereign Prep uses MCP (Model Context Protocol) for data source integration:

| MCP Server | Purpose |
|------------|---------|
| Fireflies | Call transcripts and summaries |
| Slack | Message search and threads |
| Google Calendar | Meeting discovery |
| Google Drive | File storage |
| Exa | Web research |

## Performance

- Dossier generation: < 100ms (quick mode)
- Full pipeline with data fetch: < 60s target
- Parallel data fetching for optimal throughput
- Graceful degradation when sources fail

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `npm test && npm run lint`
5. Submit a pull request
