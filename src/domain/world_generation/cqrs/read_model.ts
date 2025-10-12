import { Context, Effect, HashMap, Layer, Option, Stream, SubscriptionRef, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'

import type { ChunkGenerationResultType, GenerationProgressType, WorldGenerationResultType } from '../types'

interface WorldGenerationReadModelState {
  readonly worlds: HashMap.HashMap<string, WorldGenerationResultType>
  readonly chunks: HashMap.HashMap<string, ChunkGenerationResultType>
  readonly progress: HashMap.HashMap<string, GenerationProgressType>
  readonly activeSessions: ReadonlyArray.ReadonlyArray<string>
  readonly healthStatus: Record<string, boolean>
}

const makeInitialState = (): WorldGenerationReadModelState => ({
  worlds: HashMap.empty(),
  chunks: HashMap.empty(),
  progress: HashMap.empty(),
  activeSessions: [],
  healthStatus: {},
})

const chunkKey = (result: ChunkGenerationResultType | { readonly x: number; readonly z: number }): string =>
  `${result.chunkPosition?.x ?? result.x}:${result.chunkPosition?.z ?? result.z}`

export interface WorldGenerationReadModel {
  readonly recordWorldResult: (result: WorldGenerationResultType) => Effect.Effect<void>
  readonly recordChunkResult: (result: ChunkGenerationResultType) => Effect.Effect<void>
  readonly recordProgress: (progress: GenerationProgressType) => Effect.Effect<void>
  readonly setActiveSessions: (sessions: ReadonlyArray.ReadonlyArray<string>) => Effect.Effect<void>
  readonly setHealthStatus: (status: Record<string, boolean>) => Effect.Effect<void>
  readonly getWorldResult: (generationId: string) => Effect.Effect<Option.Option<WorldGenerationResultType>>
  readonly getChunkResult: (position: { readonly x: number; readonly z: number }) => Effect.Effect<Option.Option<ChunkGenerationResultType>>
  readonly getProgress: (generationId: string) => Effect.Effect<Option.Option<GenerationProgressType>>
  readonly worldResultsStream: Stream.Stream<ReadonlyArray.ReadonlyArray<WorldGenerationResultType>>
  readonly chunkResultsStream: Stream.Stream<ReadonlyArray.ReadonlyArray<ChunkGenerationResultType>>
  readonly progressStream: Stream.Stream<ReadonlyArray.ReadonlyArray<GenerationProgressType>>
  readonly activeSessionsStream: Stream.Stream<ReadonlyArray.ReadonlyArray<string>>
  readonly healthStatusStream: Stream.Stream<Record<string, boolean>>
}

export const WorldGenerationReadModel = Context.GenericTag<WorldGenerationReadModel>(
  '@minecraft/domain/world_generation/CQRS/ReadModel'
)

export const WorldGenerationReadModelLive = Layer.effect(
  WorldGenerationReadModel,
  Effect.gen(function* () {
    const subscription = yield* SubscriptionRef.make<WorldGenerationReadModelState>(makeInitialState())

    const recordWorldResult: WorldGenerationReadModel['recordWorldResult'] = (result) =>
      SubscriptionRef.update(subscription, (state) => ({
        ...state,
        worlds: HashMap.set(state.worlds, result.generationId, result),
      }))

    const recordChunkResult: WorldGenerationReadModel['recordChunkResult'] = (result) =>
      SubscriptionRef.update(subscription, (state) => ({
        ...state,
        chunks: HashMap.set(state.chunks, chunkKey(result), result),
      }))

    const recordProgress: WorldGenerationReadModel['recordProgress'] = (progress) =>
      SubscriptionRef.update(subscription, (state) => ({
        ...state,
        progress: HashMap.set(state.progress, progress.generationId, progress),
      }))

    const setActiveSessions: WorldGenerationReadModel['setActiveSessions'] = (sessions) =>
      SubscriptionRef.update(subscription, (state) => ({
        ...state,
        activeSessions: sessions,
      }))

    const setHealthStatus: WorldGenerationReadModel['setHealthStatus'] = (status) =>
      SubscriptionRef.update(subscription, (state) => ({
        ...state,
        healthStatus: status,
      }))

    const getWorldResult: WorldGenerationReadModel['getWorldResult'] = (generationId) =>
      SubscriptionRef.get(subscription).pipe(
        Effect.map((state) => HashMap.get(state.worlds, generationId))
      )

    const getChunkResult: WorldGenerationReadModel['getChunkResult'] = (position) =>
      SubscriptionRef.get(subscription).pipe(
        Effect.map((state) => HashMap.get(state.chunks, chunkKey(position)))
      )

    const getProgress: WorldGenerationReadModel['getProgress'] = (generationId) =>
      SubscriptionRef.get(subscription).pipe(
        Effect.map((state) => HashMap.get(state.progress, generationId))
      )

    const worldResultsStream: WorldGenerationReadModel['worldResultsStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.worlds)))
    )

    const chunkResultsStream: WorldGenerationReadModel['chunkResultsStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.chunks)))
    )

    const progressStream: WorldGenerationReadModel['progressStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => ReadonlyArray.fromIterable(HashMap.values(state.progress)))
    )

    const activeSessionsStream: WorldGenerationReadModel['activeSessionsStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => state.activeSessions)
    )

    const healthStatusStream: WorldGenerationReadModel['healthStatusStream'] = pipe(
      SubscriptionRef.changes(subscription),
      Stream.map((state) => state.healthStatus)
    )

    return WorldGenerationReadModel.of({
      recordWorldResult,
      recordChunkResult,
      recordProgress,
      setActiveSessions,
      setHealthStatus,
      getWorldResult,
      getChunkResult,
      getProgress,
      worldResultsStream,
      chunkResultsStream,
      progressStream,
      activeSessionsStream,
      healthStatusStream,
    })
  })
)
