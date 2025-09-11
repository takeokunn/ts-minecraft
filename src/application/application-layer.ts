import { Layer } from 'effect'
import { CommandHandlersLive } from '@application/handlers/command-handlers'
import { QueryHandlersLive } from '@application/handlers/query-handlers'
import { PlayerMoveUseCaseLive } from '@application/use-cases/player-move.use-case'
import { BlockPlaceUseCaseLive } from '@application/use-cases/block-place.use-case'
import { ChunkLoadUseCaseLive } from '@application/use-cases/chunk-load.use-case'
import { WorldGenerateUseCaseLive } from '@application/use-cases/world-generate.use-case'
import { WorldUpdateWorkflowLive } from '@application/workflows/world-update'
import { UIUpdateWorkflowLive } from '@application/workflows/ui-update'
import { SystemSchedulerServiceLive } from '@application/workflows/system-scheduler.service'
// Removed direct infrastructure dependencies - using ports instead

// Import new domain services that the application layer depends on
import { TerrainGenerationDomainServiceLive } from '@domain/services/terrain-generation-domain.service'
import { MeshGenerationDomainServiceLive } from '@domain/services/mesh-generation-domain.service'
import { WorldManagementDomainServiceLive } from '@domain/services/world-management-domain.service'
import { UnifiedQuerySystemLive } from '@application/queries/unified-query-system'

/**
 * Complete Application Layer with all use cases, handlers, and workflows
 *
 * This layer provides:
 * - CQRS Command and Query Handlers
 * - Business Logic Use Cases
 * - Workflow Orchestration
 * - System Communication and Scheduling
 *
 * Dependencies:
 * - Domain Services (WorldDomainService, EntityDomainService, PhysicsDomainService,
 *   TerrainGenerationDomainService, MeshGenerationDomainService, WorldManagementDomainService)
 * - Infrastructure Services (provided by infrastructure layer)
 */
export const ApplicationLayer = Layer.mergeAll(
  // Query System (unified ECS queries)
  UnifiedQuerySystemLive,

  // Domain Services (required by use cases)
  TerrainGenerationDomainServiceLive,
  MeshGenerationDomainServiceLive,
  WorldManagementDomainServiceLive,

  // Use Cases
  PlayerMoveUseCaseLive,
  BlockPlaceUseCaseLive,
  ChunkLoadUseCaseLive,
  WorldGenerateUseCaseLive,

  // CQRS Handlers
  CommandHandlersLive,
  QueryHandlersLive,

  // Workflows
  WorldUpdateWorkflowLive,
  UIUpdateWorkflowLive,

  // System Services
  SystemSchedulerServiceLive(),
  // Note: SystemCommunication and PerformanceMonitor are now provided via adapters
  // They should be provided at the infrastructure layer level
)

/**
 * Application Layer Configuration
 */
export const ApplicationConfig = {
  maxCommandExecutionTime: 100, // milliseconds
  maxQueryExecutionTime: 50, // milliseconds
  enableCommandValidation: true,
  enableQueryValidation: true,
  enablePerformanceMetrics: true,
  enableErrorLogging: true,
} as const

/**
 * Application Layer Utilities
 */
export const ApplicationUtils = {
  /**
   * Create a command with timestamp
   */
  createCommand: <T extends Record<string, any>>(command: Omit<T, 'timestamp'>): T & { timestamp: number } =>
    ({
      ...command,
      timestamp: Date.now(),
    }) as T & { timestamp: number },

  /**
   * Validate command structure
   */
  validateCommand: (command: any) => {
    if (!command.timestamp) {
      throw new Error('Command must have a timestamp')
    }
    if (typeof command.timestamp !== 'number') {
      throw new Error('Command timestamp must be a number')
    }
    return true
  },

  /**
   * Create query result with metadata
   */
  createQueryResult: <T>(data: T, metadata: Record<string, any> = {}) => ({
    data,
    metadata: {
      ...metadata,
      timestamp: Date.now(),
      version: '1.0.0',
    },
  }),

  /**
   * Measure execution time
   */
  measureExecutionTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> => {
    const startTime = Date.now()
    const result = await fn()
    const executionTime = Date.now() - startTime
    return { result, executionTime }
  },
}
