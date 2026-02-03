#!/bin/bash
# Sovereign Prep - Initial Setup Script
# Run this script after cloning the repository

set -e

echo "========================================"
echo "  Sovereign Prep - Setup Script"
echo "========================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "ERROR: Node.js 20+ is required. Current version: $(node -v)"
    echo "Please install Node.js 20 or later and try again."
    exit 1
fi
echo "  Node.js version: $(node -v) ✓"

# Check npm
echo "Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi
echo "  npm version: $(npm -v) ✓"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Create output directory
echo ""
echo "Creating output directories..."
mkdir -p output
mkdir -p tests/e2e/output

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "  Created .env file"
    echo "  ⚠️  Please edit .env with your configuration"
else
    echo ""
    echo ".env file already exists, skipping..."
fi

# Build the project
echo ""
echo "Building project..."
npm run build

# Run type check
echo ""
echo "Running type check..."
npm run typecheck

# Run linter
echo ""
echo "Running linter..."
npm run lint

# Run tests
echo ""
echo "Running tests..."
npm test

# Run E2E tests
echo ""
echo "Running E2E tests..."
npm run test:e2e

# Success
echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys and configuration"
echo "  2. Run 'npm run generate:quick \"Account\"' to test"
echo "  3. Run 'npm run scheduler' to start the nightly job"
echo ""
echo "Commands:"
echo "  npm run generate              - Generate for tomorrow's meetings"
echo "  npm run generate:account X    - Generate for specific account"
echo "  npm run scheduler             - Start the scheduler daemon"
echo ""
