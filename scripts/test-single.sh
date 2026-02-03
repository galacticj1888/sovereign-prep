#!/bin/bash
# Sovereign Prep - Test Single Account Script
# Usage: ./scripts/test-single.sh "AccountName"

set -e

ACCOUNT_NAME="${1:-Toyota}"

echo "========================================"
echo "  Testing: $ACCOUNT_NAME"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Quick test (no external APIs)
echo "1. Quick mode test (no API calls)..."
npm run generate:quick "$ACCOUNT_NAME"
echo ""

# Check if output was created
OUTPUT_DIR="tests/e2e/output"
if ls "$OUTPUT_DIR"/*.html 1> /dev/null 2>&1; then
    echo "   ✓ HTML files generated"
    ls -la "$OUTPUT_DIR"/*.html
else
    echo "   ✗ No HTML files found"
fi

echo ""
echo "========================================"
echo "  Test Complete"
echo "========================================"
echo ""
echo "To view the dossier:"
echo "  open $OUTPUT_DIR/*.html"
echo ""
