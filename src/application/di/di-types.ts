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

export type { BlockInteractionCommand } from '@application/commands/block-interaction'

export type { ChunkLoadCommand } from '@application/use-cases/chunk-load.usecase'

export type { WorldGenerateCommand } from '@application/use-cases/world-generate.usecase'

export type { PlayerQuery, ChunkQuery, WorldStateQuery, EntityQuery, PlayerQueryResult, ChunkQueryResult, WorldStateQueryResult } from '@application/handlers/query.handler'

// System configuration types
export type { SystemConfig, SystemContext, SystemMetrics, SystemFunction, SystemPriority, SystemPhase, SchedulerConfig } from '@application/workflows/system-scheduler'

// Main DI Types namespace
export const DITypes = {
  // Identifiers for dependency injection
  WorldDomainService: Symbol.for('WorldDomainService'),
  EntityDomainService: Symbol.for('EntityDomainService'),
  PhysicsDomainService: Symbol.for('PhysicsDomainService'),
  ClockPort: Symbol.for('ClockPort'),
  SystemCommunicationPort: Symbol.for('SystemCommunicationPort'),
  PerformanceMonitorPort: Symbol.for('PerformanceMonitorPort'),
} as const
