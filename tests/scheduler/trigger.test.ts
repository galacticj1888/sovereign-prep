/**
 * Trigger Handler tests
 */

import { describe, it, expect } from 'vitest';
import {
  triggerDossierGeneration,
  triggerBatchGeneration,
  generateTriggerReport,
  generateBatchReport,
} from '../../src/scheduler/trigger.js';
import type { Meeting } from '../../src/types/meeting.js';

describe('Trigger Handler', () => {
  const createTestMeeting = (): Meeting => ({
    id: 'meeting-1',
    title: 'Toyota POC Check-in',
    datetime: new Date('2026-02-04T11:30:00'),
    duration: 30,
    attendees: [
      { email: 'user@toyota.com', name: 'Toyota User' },
    ],
  });

  describe('triggerDossierGeneration', () => {
    it('should generate dossier in quick mode', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.success).toBe(true);
      expect(result.dossier).toBeDefined();
      expect(result.dossier?.account.name).toBe('Toyota');
      expect(result.htmlContent).toBeDefined();
      expect(result.timing.durationMs).toBeGreaterThan(0);
    });

    it('should generate dossier with meeting', async () => {
      const meeting = createTestMeeting();
      const result = await triggerDossierGeneration({
        meeting,
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.success).toBe(true);
      expect(result.dossier?.meeting.title).toBe('Toyota POC Check-in');
    });

    it('should prepare slack output when channel provided', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        slackChannel: '#sales-deals',
        skipDrive: true,
      });

      expect(result.success).toBe(true);
      expect(result.outputs.slack).toBeDefined();
      expect(result.outputs.slack?.channel).toBe('#sales-deals');
    });

    it('should prepare drive output when not skipped', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: false,
      });

      expect(result.success).toBe(true);
      expect(result.outputs.drive).toBeDefined();
    });

    it('should track timing information', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.timing.startTime).toBeInstanceOf(Date);
      expect(result.timing.endTime).toBeInstanceOf(Date);
      expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include warnings in result', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Test',
        accountDomain: 'test.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('triggerBatchGeneration', () => {
    it('should generate dossiers for multiple meetings', async () => {
      const meetings: Meeting[] = [
        createTestMeeting(),
        {
          id: 'meeting-2',
          title: 'Honda Discussion',
          datetime: new Date('2026-02-04T14:00:00'),
          duration: 45,
          attendees: [],
        },
      ];

      const result = await triggerBatchGeneration(meetings, {
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.totalMeetings).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should count successes and failures', async () => {
      const meetings: Meeting[] = [createTestMeeting()];

      const result = await triggerBatchGeneration(meetings, {
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.successfulDossiers).toBe(1);
      expect(result.failedDossiers).toBe(0);
      expect(result.success).toBe(true);
    });

    it('should handle empty meetings array', async () => {
      const result = await triggerBatchGeneration([], {
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalMeetings).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('generateTriggerReport', () => {
    it('should generate report for successful result', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      const report = generateTriggerReport(result);

      expect(report).toContain('DOSSIER GENERATION REPORT');
      expect(report).toContain('Toyota');
      expect(report).toContain('SUCCESS');
      expect(report).toContain('Duration:');
    });

    it('should include outputs section', async () => {
      const result = await triggerDossierGeneration({
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      const report = generateTriggerReport(result);

      expect(report).toContain('Outputs:');
      expect(report).toContain('HTML: Generated');
    });
  });

  describe('generateBatchReport', () => {
    it('should generate batch report', async () => {
      const meetings: Meeting[] = [createTestMeeting()];
      const result = await triggerBatchGeneration(meetings, {
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      const report = generateBatchReport(result);

      expect(report).toContain('BATCH DOSSIER GENERATION REPORT');
      expect(report).toContain('Total Meetings: 1');
      expect(report).toContain('Successful: 1');
      expect(report).toContain('Failed: 0');
      expect(report).toContain('Success Rate: 100%');
    });

    it('should list individual results', async () => {
      const meetings: Meeting[] = [createTestMeeting()];
      const result = await triggerBatchGeneration(meetings, {
        accountName: 'Toyota',
        accountDomain: 'toyota.com',
        quickMode: true,
        skipSlack: true,
        skipDrive: true,
      });

      const report = generateBatchReport(result);

      expect(report).toContain('Individual Results:');
      expect(report).toContain('Toyota');
      expect(report).toContain('OK');
    });
  });
});
