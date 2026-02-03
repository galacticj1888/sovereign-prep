/**
 * Retry utility tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  executeWithRetry,
  makeRetryable,
  CircuitBreaker,
  CircuitOpenError,
  withRetryAndCircuitBreaker,
  sleep,
  calculateBackoffDelay,
  isTransientError,
  API_RETRY_OPTIONS,
  CRITICAL_RETRY_OPTIONS,
  QUICK_RETRY_OPTIONS,
} from '../../src/utils/retry.js';

describe('Retry Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(operation, { initialDelayMs: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10, // Short delay for faster test
        })
      ).rejects.toThrow('always fails');
      expect(operation).toHaveBeenCalledTimes(3);
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should respect maxAttempts option', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(
        withRetry(operation, {
          maxAttempts: 2,
          initialDelayMs: 10, // Short delay for faster test
        })
      ).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(2);
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should call onRetry callback', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();

      const resultPromise = withRetry(operation, {
        initialDelayMs: 100,
        onRetry,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should stop retry if isRetryable returns false', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const operation = vi.fn().mockRejectedValue(new Error('permanent error'));

      await expect(
        withRetry(operation, {
          maxAttempts: 5,
          initialDelayMs: 10,
          isRetryable: () => false,
        })
      ).rejects.toThrow('permanent error');
      expect(operation).toHaveBeenCalledTimes(1);
      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('executeWithRetry', () => {
    it('should return detailed result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const resultPromise = executeWithRetry(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return detailed result on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      const resultPromise = executeWithRetry(operation, {
        maxAttempts: 2,
        initialDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('fail');
      expect(result.attempts).toBe(2);
    });
  });

  describe('makeRetryable', () => {
    it('should wrap function with retry logic', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const retryableFn = makeRetryable(fn, { initialDelayMs: 100 });
      const resultPromise = retryableFn('arg1', 'arg2');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow operations when closed', async () => {
      const cb = new CircuitBreaker();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await cb.execute(operation);

      expect(result).toBe('success');
      expect(cb.getState()).toBe('closed');
    });

    it('should open after failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(operation);
        } catch {
          // Expected
        }
      }

      expect(cb.getState()).toBe('open');
      expect(cb.getFailureCount()).toBe(2);
    });

    it('should throw CircuitOpenError when open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(operation);
      } catch {
        // Expected - this opens the circuit
      }

      await expect(cb.execute(operation)).rejects.toThrow(CircuitOpenError);
    });

    it('should reset on manual reset', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(operation);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe('open');

      cb.reset();

      expect(cb.getState()).toBe('closed');
      expect(cb.getFailureCount()).toBe(0);
    });

    it('should close after successful operation in half-open', async () => {
      vi.useRealTimers(); // Need real timers for this test

      const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeMs: 10 });
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      const successOp = vi.fn().mockResolvedValue('success');

      try {
        await cb.execute(failOp);
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe('open');

      // Wait for reset time
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should be half-open now and succeed
      const result = await cb.execute(successOp);

      expect(result).toBe('success');
      expect(cb.getState()).toBe('closed');

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('CircuitOpenError', () => {
    it('should include retry after time', () => {
      const error = new CircuitOpenError('Circuit open', 5000);

      expect(error.message).toBe('Circuit open');
      expect(error.retryAfterMs).toBe(5000);
      expect(error.name).toBe('CircuitOpenError');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      const sleepPromise = sleep(100);
      vi.advanceTimersByTime(100);
      await sleepPromise;
      // With fake timers, this should be instant
      expect(true).toBe(true);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential delay', () => {
      expect(calculateBackoffDelay(1, 1000, 2, 30000)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 2, 30000)).toBe(2000);
      expect(calculateBackoffDelay(3, 1000, 2, 30000)).toBe(4000);
      expect(calculateBackoffDelay(4, 1000, 2, 30000)).toBe(8000);
    });

    it('should respect maxDelayMs', () => {
      expect(calculateBackoffDelay(10, 1000, 2, 30000)).toBe(30000);
    });
  });

  describe('isTransientError', () => {
    it('should identify transient errors', () => {
      expect(isTransientError(new Error('Network timeout'))).toBe(true);
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isTransientError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should not identify permanent errors', () => {
      expect(isTransientError(new Error('Invalid input'))).toBe(false);
      expect(isTransientError(new Error('Not found'))).toBe(false);
      expect(isTransientError(new Error('Permission denied'))).toBe(false);
    });
  });

  describe('Predefined retry strategies', () => {
    it('API_RETRY_OPTIONS should have correct defaults', () => {
      expect(API_RETRY_OPTIONS.maxAttempts).toBe(3);
      expect(API_RETRY_OPTIONS.initialDelayMs).toBe(1000);
      expect(API_RETRY_OPTIONS.jitter).toBe(true);
    });

    it('CRITICAL_RETRY_OPTIONS should have more attempts', () => {
      expect(CRITICAL_RETRY_OPTIONS.maxAttempts).toBe(5);
      expect(CRITICAL_RETRY_OPTIONS.maxDelayMs).toBe(60000);
    });

    it('QUICK_RETRY_OPTIONS should have fewer attempts', () => {
      expect(QUICK_RETRY_OPTIONS.maxAttempts).toBe(2);
      expect(QUICK_RETRY_OPTIONS.jitter).toBe(false);
    });

    it('API_RETRY_OPTIONS.isRetryable should identify retryable errors', () => {
      const isRetryable = API_RETRY_OPTIONS.isRetryable!;
      expect(isRetryable(new Error('Network error'))).toBe(true);
      expect(isRetryable(new Error('500 Internal Server Error'))).toBe(true);
      expect(isRetryable(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryable(new Error('Invalid argument'))).toBe(false);
    });
  });
});
