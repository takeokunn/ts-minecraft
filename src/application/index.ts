// Application Layer - Core exports only
export { ApplicationLayer } from './application-layer'

// Commands - Used in presentation controllers and main.ts
export { PlayerMovementCommand } from './commands/player-movement'
export { BlockInteractionCommand } from './commands/block-interaction'

// Note: DI container exports removed as they are unused in the current architecture

// Handlers - Core handlers used in presentation layer
export { CommandHandlers, CommandHandlersLive } from './handlers/command-handlers'
export { QueryHandlers, QueryHandlersLive } from './handlers/query-handlers'

// Queries - Core query system used in CLI
export {
  query,
  QueryBuilder,
  soaQuery,
  aosQuery,
  UnifiedQuerySystemService,
  UnifiedQuerySystemLive,
  QueryCache,
  globalQueryCacheLayer,
} from './queries'

// Use Cases - Core use cases with commands used in handlers
export { PlayerMoveUseCase, PlayerMoveUseCaseLive } from './use-cases/player-move.use-case'
export { BlockPlaceUseCase, BlockPlaceUseCaseLive } from './use-cases/block-place.use-case'
export { ChunkLoadUseCase, ChunkLoadUseCaseLive, ChunkLoadCommand } from './use-cases/chunk-load.use-case'
export { WorldGenerateUseCase, WorldGenerateUseCaseLive, WorldGenerateCommand } from './use-cases/world-generate.use-case'

// Workflows (used in main.ts)
export { UIUpdateWorkflow, UIUpdateWorkflowLive } from './workflows/ui-update'
export { WorldUpdateWorkflow, WorldUpdateWorkflowLive } from './workflows/world-update'
export { ChunkLoadingWorkflow, ChunkLoadingWorkflowLive } from './workflows/chunk-loading'
export { SystemSchedulerService, SystemSchedulerServiceLive, SchedulerError, SystemConfig, SystemMetrics } from './workflows/system-scheduler.service'
