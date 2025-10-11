import { Context, Effect, Layer, Match, Schema } from 'effect'

import type { GetProgressQuery, HealthCheckQuery, ListActiveSessionsQuery, WorldGenerationQuery } from '../types'
import {
  GenerationProgress,
  WorldGenerationOrchestrator,
  type WorldGenerationOrchestrator as WorldGenerationOrchestratorService,
  type WorldGenerationOrchestratorErrorType,
} from '../domain_service/world_generation_orchestrator/orchestrator'

export type WorldGenerationQueryHandlerError = WorldGenerationOrchestratorErrorType

export type GenerationProgressType = Schema.Schema.Type<typeof GenerationProgress>

export type WorldGenerationQueryResult =
  | { readonly _tag: 'GenerationProgress'; readonly progress: GenerationProgressType }
  | { readonly _tag: 'ActiveSessions'; readonly sessions: ReadonlyArray<string> }
  | { readonly _tag: 'HealthStatus'; readonly status: Record<string, boolean> }

export interface WorldGenerationQueryHandler {
  readonly execute: (query: WorldGenerationQuery) => Effect.Effect<WorldGenerationQueryResult, WorldGenerationQueryHandlerError>
}

export const WorldGenerationQueryHandler = Context.GenericTag<WorldGenerationQueryHandler>(
  '@minecraft/domain/world_generation/CQRS/QueryHandler'
)

const handleGetProgress = (
  orchestrator: WorldGenerationOrchestratorService,
  query: GetProgressQuery
): Effect.Effect<WorldGenerationQueryResult, WorldGenerationQueryHandlerError> =>
  orchestrator.getProgress(query).pipe(
    Effect.map((progress) => ({ _tag: 'GenerationProgress', progress } as const))
  )

const handleListActiveSessions = (
  orchestrator: WorldGenerationOrchestratorService,
  _query: ListActiveSessionsQuery
): Effect.Effect<WorldGenerationQueryResult, WorldGenerationQueryHandlerError> =>
  orchestrator.listActiveSessions().pipe(
    Effect.map((sessions) => ({ _tag: 'ActiveSessions', sessions } as const))
  )

const handleHealthCheck = (
  orchestrator: WorldGenerationOrchestratorService,
  _query: HealthCheckQuery
): Effect.Effect<WorldGenerationQueryResult, WorldGenerationQueryHandlerError> =>
  orchestrator.healthCheck().pipe(Effect.map((status) => ({ _tag: 'HealthStatus', status } as const)))

const executeQuery = (
  orchestrator: WorldGenerationOrchestratorService,
  query: WorldGenerationQuery
): Effect.Effect<WorldGenerationQueryResult, WorldGenerationQueryHandlerError> =>
  Match.value(query).pipe(
    Match.tag('GetProgressQuery', (q) => handleGetProgress(orchestrator, q)),
    Match.tag('ListActiveSessionsQuery', (q) => handleListActiveSessions(orchestrator, q)),
    Match.tag('HealthCheckQuery', (q) => handleHealthCheck(orchestrator, q)),
    Match.exhaustive
  )

export const WorldGenerationQueryHandlerLive = Layer.effect(
  WorldGenerationQueryHandler,
  Effect.gen(function* () {
    const orchestrator = yield* WorldGenerationOrchestrator

    return WorldGenerationQueryHandler.of({
      execute: (query) => executeQuery(orchestrator, query),
    })
  })
)
