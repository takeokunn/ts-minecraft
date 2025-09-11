/**
 * Infrastructure Layer Service Aliases
 * 
 * This module provides service aliases and compatibility mappings.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

// Import from unified layer
import {
  UnifiedAppLive,
} from './unified.layer'

// Layer composition aliases for backward compatibility
export {
  UnifiedAppLive as AppLive, // Map UnifiedAppLive to AppLive for compatibility
  UnifiedAppLive as AppTest, // Use same layer for tests for now
} from './unified.layer'