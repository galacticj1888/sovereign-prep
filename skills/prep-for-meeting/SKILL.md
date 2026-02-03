---
name: prep-for-meeting
description: Quick meeting preparation - generate talking points and context for an upcoming meeting
---

# Prep For Meeting Skill

Quickly prepare for an upcoming meeting with essential context and talking points.

## Trigger

Use this skill when the user says:
- "Prep me for my [account] meeting"
- "What do I need to know for [meeting]?"
- "Quick prep for [account]"
- "Brief me on [account]"
- "Get me ready for [company] call"

## Protocol

### Step 1: Identify Meeting

- Extract account name or meeting details
- Search calendar if needed:
  ```
  mcp__google-calendar-2__list_events: timeMin="[now]" timeMax="[24h from now]"
  ```
- Confirm which meeting if multiple found

### Step 2: Quick Context Gather

Execute in parallel (timeout: 30s each):

1. **Recent Calls**
   ```
   fireflies__fireflies_search: query="[account] from:[7 days ago]"
   ```

2. **Last Slack Activity**
   ```
   slack_search: query="[account] after:[7 days ago]" limit=5
   ```

### Step 3: Generate Quick Brief

Produce a focused summary containing:

1. **Meeting Details**
   - Who's on the call
   - Time and duration
   - Meeting purpose (from title/description)

2. **Last Interaction Summary**
   - When was last call
   - Key outcomes from last call
   - Open action items

3. **Top 3 Talking Points**
   - Based on recent activity
   - Focused on advancing the deal

4. **Watch Items**
   - Any risks or concerns
   - Overdue action items

### Step 4: Present Brief

Format as a concise, scannable summary:

```
MEETING PREP: [Account Name]
[Meeting Title] - [Time]

LAST CALL: [Date] - [Title]
Key outcome: [summary]

TOP TALKING POINTS:
1. [Point with context]
2. [Point with context]
3. [Point with context]

WATCH ITEMS:
- [Risk or concern]
- [Overdue action item]
```

## Quick Mode

If data sources are slow or unavailable, provide what you can:

```bash
npm run generate:quick "[account name]"
```

This generates a minimal dossier without external API calls.

## Error Handling

- Timeout after 30s per data source
- Continue with available data
- Note which sources were unavailable
- Suggest full dossier generation if more context needed

## Example Usage

```
User: Prep me for my Toyota call at 11:30