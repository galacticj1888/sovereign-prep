---
name: generate-dossier
description: Generate a meeting prep dossier for a specific account or meeting
---

# Generate Dossier Skill

Generate comprehensive meeting preparation dossiers by aggregating data from Fireflies, Slack, and other sources.

## Trigger

Use this skill when the user says:
- "Generate dossier for [account]"
- "Create prep for [account]"
- "Dossier for [account name]"
- "Meeting prep for [company]"

## Protocol

### Step 1: Identify Target

- Extract account name from user request
- Optionally identify specific meeting if mentioned
- Confirm account name with user if ambiguous

### Step 2: Parallel Data Fetch

Execute these MCP calls in parallel:

1. **Fireflies Transcripts**
   ```
   fireflies__fireflies_search: query="[account name]"
   ```
   Then for each result:
   ```
   fireflies__fireflies_get_transcript: id="[transcript_id]"
   fireflies__fireflies_get_summary: id="[transcript_id]"
   ```

2. **Slack Mentions**
   ```
   slack_search: query="[account name] after:[30 days ago]"
   ```
   For important threads:
   ```
   slack_get_thread_messages: channel="[channel]" thread_ts="[ts]"
   ```

3. **Google Calendar** (if meeting not specified)
   ```
   mcp__google-calendar-2__list_events: query="[account name]"
   ```

### Step 3: Generate Dossier

Run the CLI command:
```bash
npm run generate:account "[account name]"
```

Or for quick mode (no external data):
```bash
npm run generate:quick "[account name]"
```

### Step 4: Upload & Notify

1. **Upload to Google Drive**
   ```
   mcp__rl-google-drive__create_folder: name="Meeting Prep/[date]/[account]"
   mcp__rl-google-drive__create_file: name="[filename].html" content="[html]"
   ```

2. **Post to Slack** (if configured)
   ```
   slack_post_message: channel="#sales-deals" text="[summary]" blocks="[blocks]"
   ```

### Step 5: Report

Provide the user with:
- Link to the dossier in Google Drive
- Summary of key insights
- Any warnings about missing data

## Error Handling

- If Fireflies returns no results: Note "No call history found" in dossier
- If Slack search fails: Continue without internal context
- If Drive upload fails: Save locally and report path
- If any critical error: Show detailed error and suggest retry

## Example Usage

```
User: Generate dossier for Toyota