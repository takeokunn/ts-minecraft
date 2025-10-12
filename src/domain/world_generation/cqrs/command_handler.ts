import { Context, Effect, Layer, Match } from 'effect'

import type {
  CancelGenerationCommand,
  GenerateChunkCommand,
  GenerateWorldCommand,
  UpdateSettingsCommand,
  WorldGenerationCommand,
  WorldGenerationResultType,
  ChunkGenerationResultType,
} from '../types'
import {
  WorldGenerationOrchestrator,
  type WorldGenerationOrchestrator as WorldGenerationOrchestratorService,
  type WorldGenerationOrchestratorErrorType,
} from '../domain_service/world_generation_orchestrator/orchestrator'
import { WorldGenerationReadModel } from './read_model'

export type WorldGenerationCommandHandlerError = WorldGenerationOrchestratorErrorType

export type WorldGenerationCommandResult =
  | { readonly _tag: 'WorldGenerated'; readonly result: WorldGenerationResultType }
  | { readonly _tag: 'ChunkGenerated'; readonly result: ChunkGenerationResultType }
  | { readonly _tag: 'SettingsUpdated'; readonly generationId: string }
  | { readonly _tag: 'GenerationCancelled'; readonly generationId: string; readonly cancelled: boolean }

export interface WorldGenerationCommandHandler {
  readonly handle: (command: WorldGenerationCommand) => Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError>
}

export const WorldGenerationCommandHandler = Context.GenericTag<WorldGenerationCommandHandler>(
  '@minecraft/domain/world_generation/CQRS/CommandHandler'
)

const handleGenerateWorld = (
  orchestrator: WorldGenerationOrchestratorService,
  readModel: WorldGenerationReadModel,
  command: GenerateWorldCommand
): Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError> =>
  orchestrator.generateWorld(command).pipe(
    Effect.tap((result) => readModel.recordWorldResult(result)),
    Effect.map((result) => ({ _tag: 'WorldGenerated', result } as const))
  )

const handleGenerateChunk = (
  orchestrator: WorldGenerationOrchestratorService,
  readModel: WorldGenerationReadModel,
  command: GenerateChunkCommand
): Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError> =>
  orchestrator.generateChunk(command).pipe(
    Effect.tap((result) => readModel.recordChunkResult(result)),
    Effect.map((result) => ({ _tag: 'ChunkGenerated', result } as const))
  )

const handleUpdateSettings = (
  orchestrator: WorldGenerationOrchestratorService,
  command: UpdateSettingsCommand
): Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError> =>
  orchestrator.updateSettings(command).pipe(
    Effect.map(() => ({ _tag: 'SettingsUpdated', generationId: command.generationId } as const))
  )

const handleCancelGeneration = (
  orchestrator: WorldGenerationOrchestratorService,
  command: CancelGenerationCommand
): Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError> =>
  orchestrator.cancelGeneration(command).pipe(
    Effect.map((cancelled) => ({
      _tag: 'GenerationCancelled',
      generationId: command.generationId,
      cancelled,
    } as const))
  )

const executeCommand = (
  orchestrator: WorldGenerationOrchestratorService,
  readModel: WorldGenerationReadModel,
  command: WorldGenerationCommand
): Effect.Effect<WorldGenerationCommandResult, WorldGenerationCommandHandlerError> =>
  Match.value(command).pipe(
    Match.tag('GenerateWorldCommand', (cmd) => handleGenerateWorld(orchestrator, readModel, cmd)),
    Match.tag('GenerateChunkCommand', (cmd) => handleGenerateChunk(orchestrator, readModel, cmd)),
    Match.tag('UpdateSettingsCommand', (cmd) => handleUpdateSettings(orchestrator, cmd)),
    Match.tag('CancelGenerationCommand', (cmd) => handleCancelGeneration(orchestrator, cmd)),
    Match.exhaustive
  )

export const WorldGenerationCommandHandlerLive = Layer.effect(
  WorldGenerationCommandHandler,
  Effect.gen(function* () {
    const orchestrator = yield* WorldGenerationOrchestrator
    const readModel = yield* WorldGenerationReadModel

    return WorldGenerationCommandHandler.of({
      handle: (command) => executeCommand(orchestrator, readModel, command),
    })
  })
)
