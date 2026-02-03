#!/bin/bash
# Sovereign Prep - Nightly Cron Job Script
# Add this to crontab: 0 21 * * * /path/to/sovereign-prep/scripts/run-nightly.sh

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set up logging
LOG_DIR="${LOG_DIR:-/var/log/sovereign-prep}"
LOG_FILE="$LOG_DIR/nightly-$(date +%Y-%m-%d).log"

# Create log directory if needed
mkdir -p "$LOG_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start
log "========================================="
log "Sovereign Prep - Nightly Job Starting"
log "========================================="

# Check if another instance is running
LOCK_FILE="/tmp/sovereign-prep-nightly.lock"
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        log "ERROR: Another instance is running (PID: $PID)"
        exit 1
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

# Run the generation
log "Starting dossier generation..."
START_TIME=$(date +%s)

if npm run generate >> "$LOG_FILE" 2>&1; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log "Generation complete (${DURATION}s)"
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log "ERROR: Generation failed after ${DURATION}s"

    # Send alert if SLACK_WEBHOOK is configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Sovereign Prep nightly job failed. Check logs: $LOG_FILE\"}" \
            "$SLACK_WEBHOOK"
    fi

    exit 1
fi

log "========================================="
log "Nightly Job Complete"
log "========================================="

# Clean up old logs (keep 30 days)
find "$LOG_DIR" -name "nightly-*.log" -mtime +30 -delete 2>/dev/null || true

exit 0
