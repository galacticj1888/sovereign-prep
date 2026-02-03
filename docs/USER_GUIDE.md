# Sovereign Prep User Guide

A comprehensive guide to using the Meeting Prep Dossier System.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Quick Start](#quick-start)
3. [Generating Dossiers](#generating-dossiers)
4. [Understanding the Dossier](#understanding-the-dossier)
5. [Using the Scheduler](#using-the-scheduler)
6. [Claude Code Integration](#claude-code-integration)
7. [Customization](#customization)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

Before using Sovereign Prep, ensure you have:

- **Node.js 20+** installed ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- Access to your organization's MCP servers (Fireflies, Slack, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/sovereign-prep.git
cd sovereign-prep

# Run the setup script
./scripts/setup.sh
```

The setup script will:
- Install all dependencies
- Create your `.env` file from the template
- Build the project
- Run tests to verify everything works

### Configuration

Edit your `.env` file with your credentials:

```bash
# Required for Slack notifications
SLACK_CHANNEL=#sales-deals

# Required for Google Drive storage
DRIVE_FOLDER_ID=your-google-drive-folder-id

# Timezone for scheduling
TIMEZONE=America/Chicago
```

---

## Quick Start

### Generate Your First Dossier

The fastest way to test the system:

```bash
# Generate a quick dossier (no API calls required)
npm run generate:quick "Acme Corp"
```

This creates a sample dossier in `tests/e2e/output/` that you can view in your browser.

### View the Output

```bash
# On macOS
open tests/e2e/output/acme_corp_dossier.html

# On Linux
xdg-open tests/e2e/output/acme_corp_dossier.html

# On Windows
start tests/e2e/output/acme_corp_dossier.html
```

---

## Generating Dossiers

### Method 1: Command Line (Recommended)

#### Generate for a Specific Account

```bash
npm run generate:account "Toyota"
```

This will:
1. Search Fireflies for Toyota transcripts
2. Search Slack for Toyota mentions
3. Check calendar for upcoming Toyota meetings
4. Generate a comprehensive dossier
5. Post summary to Slack
6. Upload to Google Drive

#### Generate for Tomorrow's Meetings

```bash
npm run generate
```

Automatically generates dossiers for all external meetings scheduled for tomorrow.

#### Quick Mode (No External APIs)

```bash
npm run generate:quick "Toyota"
```

Creates a dossier template without fetching external data. Useful for:
- Testing the system
- Offline work
- Quick templates

### Method 2: Scheduled Generation

Start the scheduler to automatically generate dossiers every night at 9 PM:

```bash
npm run scheduler
```

The scheduler will:
- Run at 9 PM in your configured timezone
- Generate dossiers for all meetings in the next 24 hours
- Post summaries to Slack
- Upload artifacts to Google Drive

### Method 3: Claude Code Skills

If you're using Claude Code, simply say:

```
"Generate dossier for Toyota"
```

or

```
"Prep me for my Toyota call at 2pm"
```

---

## Understanding the Dossier

### Dossier Sections

Each generated dossier contains:

#### 1. Executive Summary
- **Why This Meeting Matters** - Context for the meeting's importance
- **Top Goals** - 3-5 prioritized objectives for the call
- **Red Flags** - Issues requiring immediate attention

#### 2. Deal Snapshot
- Current stage (Discovery, POC, Negotiation, etc.)
- Deal value
- Days in current stage
- Momentum indicator (accelerating, stable, stalling, at-risk)
- Close date

#### 3. Participants
- **External Attendees** - Customer participants with:
  - Name and title
  - Role (Champion, Blocker, Economic Buyer, etc.)
  - Influence level
  - Communication tips
- **Internal Attendees** - Your team members
- **Missing Stakeholders** - Key people not on the call

#### 4. Engagement Timeline
- Chronological history of interactions
- Call summaries with links to transcripts
- Key milestones and decisions

#### 5. Action Items
- **Their Action Items** - What the customer owes
- **Our Action Items** - What your team owes
- Overdue items highlighted

#### 6. Strategic Insights
- **What's Working** - Positive signals
- **Needs Attention** - Areas of concern
- **Questions to Ask** - Suggested conversation starters
- **Things to Avoid** - Topics to steer clear of

#### 7. Competitive Intelligence
- Competitor mentions detected in conversations
- Sentiment analysis
- Risk assessment
- Differentiators to emphasize

#### 8. Talking Points
- Contextualized conversation starters
- Goal-aligned discussion points
- Follow-up suggestions

---

## Using the Scheduler

### Starting the Scheduler

```bash
npm run scheduler
```

This starts a background process that runs the nightly job.

### Checking Status

```bash
npm run scheduler:status
```

Shows:
- Whether the scheduler is running
- Registered jobs
- Last run time and status
- Success/failure counts

### Stopping the Scheduler

Press `Ctrl+C` in the terminal running the scheduler, or:

```bash
# Find and stop the process
pkill -f "sovereign-prep"
```

### Setting Up as a System Service

For production use, set up the nightly script as a cron job:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 9 PM daily)
0 21 * * * /path/to/sovereign-prep/scripts/run-nightly.sh
```

---

## Claude Code Integration

### Available Skills

#### Generate Dossier

Trigger with:
- "Generate dossier for [account]"
- "Create prep for [account]"
- "Dossier for [company name]"

This runs the full pipeline including:
- Data fetching from all sources
- Intelligence analysis
- HTML generation
- Slack posting
- Drive upload

#### Quick Meeting Prep

Trigger with:
- "Prep me for my [account] meeting"
- "What do I need to know for [meeting]?"
- "Quick prep for [account]"

This provides a focused summary with:
- Meeting details
- Top talking points
- Key watch items

### Example Conversations

```
You: Generate dossier for Toyota

Claude: I'll generate a comprehensive dossier for Toyota...
[Fetches Fireflies transcripts]
[Searches Slack mentions]
[Analyzes data]
[Generates HTML]

Done! Your Toyota dossier is ready:
- HTML: https://drive.google.com/...
- Slack summary posted to #sales-deals
```

```
You: Prep me for my Honda call at 3pm

Claude: Here's your quick prep for Honda:

MEETING: Honda POC Review
TIME: Today at 3:00 PM (30 min)

TOP TALKING POINTS:
1. Follow up on AWS account provisioning (overdue)
2. Confirm Feb 12 deployment date
3. Discuss procurement timeline

WATCH ITEMS:
- Procurement approval pending 5+ days
- Economic buyer not yet engaged
```

---

## Customization

### Changing the Schedule

Edit your `.env` file:

```bash
# Run at 8 PM instead of 9 PM
CRON_SCHEDULE=0 20 * * *

# Run only on weekdays
CRON_SCHEDULE=0 21 * * 1-5
```

### Adjusting History Window

```bash
# Include 60 days of history instead of 30
DAYS_OF_HISTORY=60
```

### Custom Internal Domains

```bash
# Add multiple internal domains
INTERNAL_DOMAINS=runlayer.com,company.com,subsidiary.com
```

### Output Directory

```bash
# Save dossiers to a custom location
OUTPUT_DIR=/path/to/your/folder
```

---

## Troubleshooting

### Common Issues

#### "No meetings found for tomorrow"

This means the calendar search didn't find any external meetings. Check:
- Is your Google Calendar connected?
- Do tomorrow's meetings have external attendees?
- Are the meetings on your primary calendar?

#### "Fireflies fetch failed"

The system couldn't retrieve transcripts. Possible causes:
- API key not configured
- No transcripts match the account name
- Network connectivity issue

The system will continue with other data sources.

#### "Slack posting failed"

Check:
- Is `SLACK_CHANNEL` configured correctly (include the #)?
- Does the Slack app have permission to post to that channel?

#### Dossier shows "No data available"

This happens when:
- The account name doesn't match any records
- External data sources are unavailable
- You're running in quick mode (which skips external fetches)

### Getting Help

1. **Check the logs**: Errors are logged with context
2. **Run E2E tests**: `npm run test:e2e` to verify the system works
3. **Quick mode test**: `npm run generate:quick "Test"` to isolate issues

### Debug Mode

For verbose output, set the log level:

```bash
LOG_LEVEL=debug npm run generate:account "Toyota"
```

---

## Best Practices

### Before Important Meetings

1. Generate the dossier at least 1 hour before
2. Review the red flags section first
3. Check for overdue action items
4. Note any missing stakeholders

### Team Workflow

1. **Morning**: Review Slack summaries for today's meetings
2. **Pre-meeting**: Open full dossier for context
3. **Post-meeting**: Update action items (coming soon)

### Data Hygiene

- Ensure Fireflies is recording customer calls
- Keep Slack discussions in searchable channels
- Maintain consistent account naming across systems

---

## Appendix: Output Locations

| Output Type | Location |
|-------------|----------|
| HTML Dossier | Google Drive: `/Meeting Prep/{date}/{account}/` |
| Slack Summary | Configured channel (e.g., #sales-deals) |
| JSON Data | Google Drive (same folder as HTML) |
| Local Quick Mode | `tests/e2e/output/` |

---

## Support

For issues or feature requests:
1. Check existing documentation
2. Review troubleshooting section
3. Contact your system administrator

---

*Sovereign Prep v1.0.0*
