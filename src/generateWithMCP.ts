#!/usr/bin/env npx tsx
/**
 * Generate Dossier with MCP Data
 *
 * This script accepts pre-fetched MCP data and generates a dossier.
 * Designed to be called from Claude Code after MCP data has been fetched.
 *
 * Usage:
 *   npx tsx src/generateWithMCP.ts <account> <domain> <output-path> < mcp-data.json
 *   npx tsx src/generateWithMCP.ts <account> <domain> <output-path> --data='{"fireflies":...}'
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { triggerDossierGeneration, type MCPData } from './scheduler/index.js';
import { logger } from './utils/logger.js';

interface GenerateArgs {
  accountName: string;
  accountDomain: string;
  outputPath: string;
  mcpData: MCPData;
}

async function parseArgs(): Promise<GenerateArgs> {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: npx tsx src/generateWithMCP.ts <account> <domain> <output-path> [--data=JSON]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx src/generateWithMCP.ts "Notion" "makenotion.com" "output/notion.html" --data=\'{"fireflies":{"transcripts":[...]}}\'');
    console.error('  cat mcp-data.json | npx tsx src/generateWithMCP.ts "Notion" "makenotion.com" "output/notion.html"');
    process.exit(1);
  }

  const accountName = args[0] as string;
  const accountDomain = args[1] as string;
  const outputPath = args[2] as string;

  // Check for --data flag
  const dataArg = args.find(a => a.startsWith('--data='));
  let mcpData: MCPData = {};

  if (dataArg) {
    // Data passed via command line
    const jsonStr = dataArg.slice('--data='.length);
    try {
      mcpData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse --data JSON:', e);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    // Data passed via stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    if (input.trim()) {
      try {
        mcpData = JSON.parse(input);
      } catch (e) {
        console.error('Failed to parse stdin JSON:', e);
        process.exit(1);
      }
    }
  }

  return { accountName, accountDomain, outputPath, mcpData };
}

async function main() {
  const log = logger.child('generate-mcp');
  const { accountName, accountDomain, outputPath, mcpData } = await parseArgs();

  log.info(`Generating dossier for ${accountName} with MCP data`);

  // Log data summary
  const transcriptCount = mcpData.fireflies?.transcripts?.length ?? 0;
  const messageCount = mcpData.slack?.messages?.length ?? 0;
  const eventCount = mcpData.calendar?.events?.length ?? 0;
  log.info(`MCP data: ${transcriptCount} transcripts, ${messageCount} messages, ${eventCount} events`);

  // Generate dossier
  const result = await triggerDossierGeneration({
    accountName,
    accountDomain,
    mcpData,
    skipSlack: true,
    skipDrive: true,
  });

  if (!result.success) {
    console.error('Dossier generation failed:', result.errors.join(', '));
    process.exit(1);
  }

  // Write output
  if (result.htmlContent) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.htmlContent);
    console.log(`✓ Dossier saved to: ${outputPath}`);
    console.log(`  Account: ${accountName}`);
    console.log(`  Size: ${result.htmlContent.length} bytes`);
    console.log(`  Duration: ${result.timing.durationMs}ms`);

    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
