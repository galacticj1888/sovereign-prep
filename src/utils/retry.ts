/**
 * Retry Utility
 *
 * Provides retry logic with exponential backoff for unreliable operations.
 */

import { logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to delays (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  /** Operation name for logging */
  operationName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry' | 'operationName'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// ============================================================================
// Retry Functions
// ============================================================================

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const result = await executeWithRetry(operation, options);

  if (!result.success) {
    throw result.error ?? new Error('Operation failed after retries');
  }

  return result.value as T;
}

/**
 * Execute an async function with retry logic, returning detailed result
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const log = logger.child('retry');
  const config = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: Error | undefined;
  let currentDelay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const value = await operation();
      return {
        success: true,
        value,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt === config.maxAttempts) {
        log.warn(`${config.operationName ?? 'Operation'} failed after ${attempt} attempts`);
        break;
      }

      // Check if error is retryable
      if (config.isRetryable && !config.isRetryable(lastError)) {
        log.warn(`${config.operationName ?? 'Operation'} failed with non-retryable error`);
        break;
      }

      // Calculate delay with optional jitter
      let delay = currentDelay;
      if (config.jitter) {
        // Add random jitter of ±25%
        const jitterRange = delay * 0.25;
        delay = delay + (Math.random() * 2 - 1) * jitterRange;
      }
      delay = Math.min(delay, config.maxDelayMs);

      log.debug(`${config.operationName ?? 'Operation'} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`);

      // Notify callback
      config.onRetry?.(attempt, lastError, delay);

      // Wait before retry
      await sleep(delay);

      // Increase delay for next attempt
      currentDelay = Math.min(currentDelay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => fn(...args), options);
  };
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000) */
  resetTimeMs?: number;
  /** Operation name for logging */
  operationName?: string;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private options: Required<CircuitBreakerOptions>;
  private log = logger.child('circuit-breaker');

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeMs: options.resetTimeMs ?? 60000,
      operationName: options.operationName ?? 'operation',
    };
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.options.resetTimeMs) {
        this.state = 'half-open';
        this.log.info(`Circuit breaker for ${this.options.operationName} entering half-open state`);
      } else {
        throw new CircuitOpenError(
          `Circuit breaker is open for ${this.options.operationName}`,
          this.options.resetTimeMs - timeSinceFailure
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
    this.log.info(`Circuit breaker for ${this.options.operationName} manually reset`);
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.log.info(`Circuit breaker for ${this.options.operationName} closed after successful test`);
    }
    this.state = 'closed';
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      this.log.warn(`Circuit breaker for ${this.options.operationName} reopened after failed test`);
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.log.warn(`Circuit breaker for ${this.options.operationName} opened after ${this.failures} failures`);
    }
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

// ============================================================================
// Retry with Circuit Breaker
// ============================================================================

/**
 * Execute with both retry and circuit breaker protection
 */
export async function withRetryAndCircuitBreaker<T>(
  operation: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return circuitBreaker.execute(() => withRetry(operation, retryOptions));
}

// ============================================================================
// Predefined Retry Strategies
// ============================================================================

/**
 * Strategy for API calls - moderate retry with backoff
 */
export const API_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error) => {
    // Retry on network errors and 5xx status codes
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  },
};

/**
 * Strategy for critical operations - more retries
 */
export const CRITICAL_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Strategy for quick operations - minimal retry
 */
export const QUICK_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  initialDelayMs: 500,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitter: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for a specific attempt with exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number = 1000,
  backoffMultiplier: number = 2,
  maxDelayMs: number = 30000
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Check if an error is likely transient (worth retrying)
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const transientPatterns = [
    'timeout',
    'network',
    'econnrefused',
    'econnreset',
    'epipe',
    'enotfound',
    'rate limit',
    'too many requests',
    '429',
    '500',
    '502',
    '503',
    '504',
    'service unavailable',
    'internal server error',
    'gateway',
  ];

  return transientPatterns.some(pattern => message.includes(pattern));
}
