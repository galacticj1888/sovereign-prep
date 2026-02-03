/**
 * Test setup file
 * Configures test environment before running tests
 */

// Set test environment variables
process.env['LOG_LEVEL'] = 'error'; // Suppress logs during tests
process.env['OUTPUT_DIR'] = './test-output';

// Clean up function for after tests
export function cleanup(): void {
  // Add any cleanup logic here
}
