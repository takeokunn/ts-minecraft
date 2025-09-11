/**
 * Dependency Injection Types - Type definitions and re-exports
 * 
 * This module contains all type definitions and re-exports that were
 * previously inline in the index.ts file.
 */

// Re-export commonly used types for convenience
export type {
  // Command & Query Types
  PlayerMovementCommand,
} from '@application/commands/player-movement'

export type {
  BlockInteractionCommand,
} from '@application/commands/block-interaction'

export type {
  ChunkLoadCommand,
} from '@application/use-cases/chunk-load.use-case'

export type {
  WorldGenerateCommand,
} from '@application/use-cases/world-generate.use-case'

export type {
  PlayerQuery,
  ChunkQuery,
  WorldStateQuery,
  EntityQuery,
  PlayerQueryResult,
  ChunkQueryResult,
  WorldStateQueryResult,
} from '@application/handlers/query-handlers'

// System configuration types
export type {
  SystemConfig,
  SystemContext,
  SystemMetrics,
  SystemFunction,
  SystemPriority,
  SystemPhase,
  SchedulerConfig,
} from '@application/workflows/system-scheduler.service'