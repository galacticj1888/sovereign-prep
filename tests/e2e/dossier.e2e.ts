#!/usr/bin/env tsx
/**
 * End-to-End Test: Dossier Generation
 *
 * This test exercises the full dossier generation pipeline:
 * 1. Creates test data
 * 2. Generates a complete dossier
 * 3. Produces HTML output
 * 4. Validates the output
 *
 * For visual verification with Playwright MCP, the generated HTML
 * can be opened in a browser and screenshot taken.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { triggerDossierGeneration, generateTriggerReport } from '../../src/scheduler/trigger.js';
import { createQuickDossier } from '../../src/intelligence/dossierAssembler.js';
import { generateHtml } from '../../src/output/htmlGenerator.js';
import { generateSlackMessage } from '../../src/output/slackPoster.js';
import type { Meeting } from '../../src/types/meeting.js';

// ============================================================================
// Test Configuration
// ============================================================================

const OUTPUT_DIR = join(process.cwd(), 'tests', 'e2e', 'output');
const TEST_ACCOUNTS = [
  { name: 'Toyota', domain: 'toyota.com', stage: 'POC', value: 250000 },
  { name: 'Honda', domain: 'honda.com', stage: 'Negotiation', value: 500000 },
  { name: 'Ford', domain: 'ford.com', stage: 'Discovery', value: 150000 },
  { name: 'Tesla', domain: 'tesla.com', stage: 'Closed Won', value: 1000000 },
  { name: 'BMW', domain: 'bmw.com', stage: 'Technical Evaluation', value: 350000 },
];

// ============================================================================
// Test Helpers
// ============================================================================

function createTestMeeting(accountName: string): Meeting {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  return {
    id: `meeting-${accountName.toLowerCase()}-${Date.now()}`,
    title: `${accountName} POC Check-in`,
    datetime: tomorrow,
    duration: 30,
    attendees: [
      { email: `contact@${accountName.toLowerCase()}.com`, name: `${accountName} Contact` },
      { email: 'andy@runlayer.com', name: 'Andy Berman' },
    ],
  };
}

function validateHtml(html: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check basic structure
  if (!html.includes('<!DOCTYPE html>')) {
    errors.push('Missing DOCTYPE declaration');
  }
  if (!html.includes('<html')) {
    errors.push('Missing <html> tag');
  }
  if (!html.includes('</html>')) {
    errors.push('Missing closing </html> tag');
  }
  if (!html.includes('<head>') || !html.includes('</head>')) {
    errors.push('Missing or incomplete <head> section');
  }
  if (!html.includes('<body') || !html.includes('</body>')) {
    errors.push('Missing or incomplete <body> section');
  }

  // Check for required content sections
  const requiredSections = [
    'DEAL SNAPSHOT',
    'WHY THIS MEETING MATTERS',
    'TOP GOALS',
    'STRATEGIC INSIGHTS',
  ];

  for (const section of requiredSections) {
    if (!html.includes(section)) {
      errors.push(`Missing section: ${section}`);
    }
  }

  // Check for Tailwind CSS
  if (!html.includes('tailwindcss')) {
    errors.push('Missing Tailwind CSS');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// Test Runner
// ============================================================================

interface TestResult {
  account: string;
  success: boolean;
  durationMs: number;
  htmlSize: number;
  validationErrors: string[];
  outputPath?: string;
}

async function runE2ETests(): Promise<void> {
  console.log('='.repeat(70));
  console.log('SOVEREIGN PREP - END-TO-END TEST SUITE');
  console.log('='.repeat(70));
  console.log('');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Test 1: Quick Dossier Generation for multiple accounts
  console.log('TEST 1: Quick Dossier Generation');
  console.log('-'.repeat(70));

  for (const account of TEST_ACCOUNTS) {
    const testStart = Date.now();
    const result: TestResult = {
      account: account.name,
      success: false,
      durationMs: 0,
      htmlSize: 0,
      validationErrors: [],
    };

    try {
      // Generate dossier
      const meeting = createTestMeeting(account.name);
      const dossier = createQuickDossier(meeting, account.name, account.domain);

      // Override some values for realism
      dossier.account.dealStage = account.stage;
      dossier.account.dealValue = account.value;

      // Generate HTML
      const html = generateHtml(dossier);
      result.htmlSize = html.length;

      // Validate HTML
      const validation = validateHtml(html);
      result.validationErrors = validation.errors;
      result.success = validation.valid;

      // Write output file
      const outputPath = join(OUTPUT_DIR, `${account.name.toLowerCase()}_dossier.html`);
      writeFileSync(outputPath, html);
      result.outputPath = outputPath;

      result.durationMs = Date.now() - testStart;

      const status = result.success ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      console.log(`  ${account.name}: ${status} (${formatDuration(result.durationMs)}, ${(result.htmlSize / 1024).toFixed(1)}KB)`);

      if (!result.success) {
        result.validationErrors.forEach(err => console.log(`    - ${err}`));
      }
    } catch (error) {
      result.durationMs = Date.now() - testStart;
      result.validationErrors.push(error instanceof Error ? error.message : String(error));
      console.log(`  ${account.name}: \x1b[31mERROR\x1b[0m - ${result.validationErrors[0]}`);
    }

    results.push(result);
  }

  console.log('');

  // Test 2: Full Pipeline Trigger
  console.log('TEST 2: Full Pipeline Trigger');
  console.log('-'.repeat(70));

  const pipelineStart = Date.now();
  try {
    const triggerResult = await triggerDossierGeneration({
      accountName: 'TestCorp',
      accountDomain: 'testcorp.com',
      quickMode: true,
      skipSlack: true,
      skipDrive: true,
    });

    const pipelineDuration = Date.now() - pipelineStart;

    if (triggerResult.success && triggerResult.htmlContent) {
      // Write pipeline output
      const pipelinePath = join(OUTPUT_DIR, 'pipeline_test_dossier.html');
      writeFileSync(pipelinePath, triggerResult.htmlContent);

      console.log(`  Pipeline: \x1b[32mPASS\x1b[0m (${formatDuration(pipelineDuration)})`);
      console.log(`  Output: ${pipelinePath}`);

      results.push({
        account: 'Pipeline Test',
        success: true,
        durationMs: pipelineDuration,
        htmlSize: triggerResult.htmlContent.length,
        validationErrors: [],
        outputPath: pipelinePath,
      });
    } else {
      console.log(`  Pipeline: \x1b[31mFAIL\x1b[0m`);
      triggerResult.errors.forEach(err => console.log(`    - ${err}`));

      results.push({
        account: 'Pipeline Test',
        success: false,
        durationMs: pipelineDuration,
        htmlSize: 0,
        validationErrors: triggerResult.errors,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  Pipeline: \x1b[31mERROR\x1b[0m - ${errorMsg}`);
    results.push({
      account: 'Pipeline Test',
      success: false,
      durationMs: Date.now() - pipelineStart,
      htmlSize: 0,
      validationErrors: [errorMsg],
    });
  }

  console.log('');

  // Test 3: Slack Message Generation
  console.log('TEST 3: Slack Message Generation');
  console.log('-'.repeat(70));

  const slackStart = Date.now();
  try {
    const meeting = createTestMeeting('SlackTest');
    const dossier = createQuickDossier(meeting, 'SlackTest', 'slacktest.com');
    const slackMessage = generateSlackMessage(dossier);

    const slackDuration = Date.now() - slackStart;

    if (slackMessage.blocks && slackMessage.blocks.length > 0) {
      // Write Slack message as JSON
      const slackPath = join(OUTPUT_DIR, 'slack_message.json');
      writeFileSync(slackPath, JSON.stringify(slackMessage, null, 2));

      console.log(`  Slack: \x1b[32mPASS\x1b[0m (${formatDuration(slackDuration)}, ${slackMessage.blocks.length} blocks)`);
      console.log(`  Output: ${slackPath}`);

      results.push({
        account: 'Slack Message',
        success: true,
        durationMs: slackDuration,
        htmlSize: JSON.stringify(slackMessage).length,
        validationErrors: [],
        outputPath: slackPath,
      });
    } else {
      console.log(`  Slack: \x1b[31mFAIL\x1b[0m - No blocks generated`);
      results.push({
        account: 'Slack Message',
        success: false,
        durationMs: slackDuration,
        htmlSize: 0,
        validationErrors: ['No blocks generated'],
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  Slack: \x1b[31mERROR\x1b[0m - ${errorMsg}`);
    results.push({
      account: 'Slack Message',
      success: false,
      durationMs: Date.now() - slackStart,
      htmlSize: 0,
      validationErrors: [errorMsg],
    });
  }

  console.log('');

  // Summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`  Failed: \x1b[31m${failed}\x1b[0m`);
  console.log(`  Total Duration: ${formatDuration(totalDuration)}`);
  console.log(`  Output Directory: ${OUTPUT_DIR}`);
  console.log('');

  // Performance check
  const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / results.length;
  if (avgDuration < 1000) {
    console.log(`  Performance: \x1b[32mEXCELLENT\x1b[0m (avg ${formatDuration(avgDuration)} per dossier)`);
  } else if (avgDuration < 5000) {
    console.log(`  Performance: \x1b[33mGOOD\x1b[0m (avg ${formatDuration(avgDuration)} per dossier)`);
  } else {
    console.log(`  Performance: \x1b[31mNEEDS IMPROVEMENT\x1b[0m (avg ${formatDuration(avgDuration)} per dossier)`);
  }

  console.log('');
  console.log('='.repeat(70));

  // Playwright verification instructions
  console.log('');
  console.log('PLAYWRIGHT VERIFICATION:');
  console.log('-'.repeat(70));
  console.log('To verify visually with Playwright MCP, use these commands:');
  console.log('');
  console.log('1. Open a generated dossier:');
  console.log(`   browser_navigate: url="file://${join(OUTPUT_DIR, 'toyota_dossier.html')}"`);
  console.log('');
  console.log('2. Take a screenshot:');
  console.log('   browser_take_screenshot');
  console.log('');
  console.log('3. Check specific elements:');
  console.log('   browser_snapshot');
  console.log('');

  // Exit with appropriate code
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runE2ETests().catch(error => {
  console.error('E2E Test failed:', error);
  process.exit(1);
});
