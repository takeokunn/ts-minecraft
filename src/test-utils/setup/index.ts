/**
 * Test Setup Module
 * 
 * This module contains core test setup utilities moved from the deleted test/ directory.
 * It provides vitest configuration, mocks, and testing utilities that are imported by
 * the main test infrastructure.
 */

// Test setup and mocks
export * from './setup'

// Testing utilities and reversibility tests
export * from './test-utils'

// Property-based testing arbitraries
export * from './arbitraries'