#!/usr/bin/env npx tsx
/**
 * Manual trigger script - runs dossier generation for specified accounts
 */

import { triggerDossierGeneration } from '../src/scheduler/trigger.js';
import { writeFile, mkdir } from 'fs/promises';

const meetings = [
  { account: 'FNZ', domain: 'fnz.com' },
  { account: 'Rohde-Schwarz', domain: 'rohde-schwarz.com' },
  { account: 'Ericsson', domain: 'ericsson.com' },
  { account: 'Adobe', domain: 'adobe.com' },
  { account: 'Greenlight', domain: 'greenlight.me' },
  { account: 'Notion', domain: 'makenotion.com' },
];

async function main() {
  const outputDir = 'output/2026-02-04';
  await mkdir(outputDir, { recursive: true });

  console.log('Running dossier generation for 6 accounts...\n');

  for (const m of meetings) {
    console.log(`Generating: ${m.account}`);
    const result = await triggerDossierGeneration({
      accountName: m.account,
      accountDomain: m.domain,
      quickMode: false, // Full mode
      skipSlack: true,
      skipDrive: true,
    });

    if (result.htmlContent) {
      const filename = m.account.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_dossier.html';
      await writeFile(`${outputDir}/${filename}`, result.htmlContent);
      console.log(`  ✓ Saved: ${filename} (${result.htmlContent.length} bytes)`);
    }

    if (result.warnings.length) {
      console.log(`  Warnings: ${result.warnings.join(', ')}`);
    }

    if (!result.success) {
      console.log(`  ✗ Failed: ${result.errors.join(', ')}`);
    }
  }

  console.log('\nDone! Opening dossiers...');
}

main().catch(console.error);
