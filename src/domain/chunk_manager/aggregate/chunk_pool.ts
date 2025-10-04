import type { ChunkId } from '@domain/chunk/value_object/chunk_id/types'
import { Clock, Effect, HashMap, Match, Option, Ref, pipe } from 'effect'
import {
  DefaultChunkManagerConfig,
  makeChunkDistance,
  makeChunkLifetime,
  makeMaxActiveChunks,
  makeMemoryBytes,
  makeResourceUsagePercent,
  makeTimestamp,
  type ChunkLifetime,
  type ChunkManagerConfig,
  type LifecycleStage,
} from '../types/core'
import {
  makeActivationError,
  makeConfigError,
  makeDeactivationError,
  type ActivationError,
  type ConfigError,
  type DeactivationError,
  type PoolMetricsError,
} from '../types/errors'
import { AutoManagementConfig, LifecycleStats, PoolMetrics, makeAutoManagementConfig } from '../types/interfaces'
import { activateStage, createInitializedStage, deactivateStage } from '../value_object/lifecycle_stage/lifecycle_stage'
import {
  averageActivationDuration,
  averageDeactivationDuration,
  createLifecycleAccumulator,
  recordActivation,
  recordDeactivation,
  setMemoryPressure,
  toLifecycleStats,
} from '../value_object/lifecycle_stage/lifecycle_stats'
import {
  computeMemoryPressure,
  makeMemoryUsage,
  makePerformanceMetrics,
  makePoolMetrics,
} from '../value_object/pool_metrics/pool_metrics'

const bytesPerChunk = 262_144
const defaultCoreConfig = DefaultChunkManagerConfig
const defaultAutoConfig = makeAutoManagementConfig({
  enabled: true,
  activationDistance: makeChunkDistance(8),
  deactivationDistance: makeChunkDistance(12),
  maxActiveChunks: makeMaxActiveChunks(512),
  memoryThreshold: makeResourceUsagePercent(0.75),
  performanceThreshold: makeResourceUsagePercent(0.85),
})
const baseDeactivationDuration = makeChunkLifetime(1)

const countByTag = (map: HashMap.HashMap<ChunkId, LifecycleStage>, tag: string): number =>
  HashMap.reduce(map, 0, (count, stage) => count + Number(stage._tag === tag))

const currentTimestamp = Effect.map(Clock.currentTimeMillis, makeTimestamp)

const activationDurationFromConfig = (config: ChunkManagerConfig): ChunkLifetime =>
  makeChunkLifetime(Number(config.performanceSettings.priorityUpdateInterval))

export interface ChunkPool {
  readonly activate: (chunkId: ChunkId) => Effect.Effect<void, ActivationError>
  readonly deactivate: (chunkId: ChunkId) => Effect.Effect<void, DeactivationError>
  readonly getActiveChunks: () => Effect.Effect<ReadonlyArray<ChunkId>, never>
  readonly getPoolMetrics: () => Effect.Effect<PoolMetrics, PoolMetricsError>
  readonly configure: (config: AutoManagementConfig) => Effect.Effect<void, ConfigError>
  readonly snapshotStats: () => Effect.Effect<LifecycleStats, never>
}

export const makeChunkPool = (
  params: {
    readonly coreConfig?: ChunkManagerConfig
    readonly autoConfig?: AutoManagementConfig
  } = {}
): Effect.Effect<ChunkPool> =>
  Effect.gen(function* () {
    const now = yield* currentTimestamp
    const lifecycleRef = yield* Ref.make(HashMap.empty<ChunkId, LifecycleStage>())
    const statsRef = yield* Ref.make(createLifecycleAccumulator(now))
    const coreConfigRef = yield* Ref.make(params.coreConfig ?? defaultCoreConfig)
    const autoConfigRef = yield* Ref.make(params.autoConfig ?? defaultAutoConfig)

    const activate = (chunkId: ChunkId): Effect.Effect<void, ActivationError> =>
      Effect.gen(function* () {
        const nowTs = yield* currentTimestamp
        const coreConfig = yield* Ref.get(coreConfigRef)
        const autoConfig = yield* Ref.get(autoConfigRef)
        const currentMap = yield* Ref.get(lifecycleRef)
        const activeCount = countByTag(currentMap, 'Active')

        yield* Match.value(activeCount < Number(autoConfig.maxActiveChunks)).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Effect.fail(
              makeActivationError(chunkId, {
                _tag: 'PoolLimitReached',
                activeCount,
                maxActive: autoConfig.maxActiveChunks,
              })
            )
          )
        )

        const nextStage = yield* pipe(
          HashMap.get(currentMap, chunkId),
          Option.match({
            onNone: () => activateStage(createInitializedStage(nowTs), nowTs),
            onSome: (stage) => activateStage(stage, nowTs),
          })
        ).pipe(Effect.mapError((failure) => makeActivationError(chunkId, failure)))

        yield* Ref.update(lifecycleRef, (map) => HashMap.set(map, chunkId, nextStage))

        const activationDuration = activationDurationFromConfig(coreConfig)
        yield* Ref.update(statsRef, (stats) => recordActivation(stats, nowTs, activationDuration))
      })

    const deactivate = (chunkId: ChunkId): Effect.Effect<void, DeactivationError> =>
      Effect.gen(function* () {
        const nowTs = yield* currentTimestamp
        const currentMap = yield* Ref.get(lifecycleRef)

        const currentStage = yield* pipe(
          HashMap.get(currentMap, chunkId),
          Option.match({
            onNone: () => Effect.fail(makeDeactivationError(chunkId, { _tag: 'NotActive' })),
            onSome: (stage) => Effect.succeed(stage),
          })
        )

        const lifetime = yield* Match.value(currentStage).pipe(
          Match.tag('Active', (active) =>
            Effect.succeed(makeChunkLifetime(Math.max(0, Math.round(nowTs - active.activatedAt))))
          ),
          Match.orElse(() =>
            Effect.fail(makeDeactivationError(chunkId, { _tag: 'LifecycleViolation', stage: currentStage._tag }))
          )
        )

        const nextStage = yield* deactivateStage(currentStage, nowTs).pipe(
          Effect.mapError((failure) => makeDeactivationError(chunkId, failure))
        )

        yield* Ref.update(lifecycleRef, (map) => HashMap.set(map, chunkId, nextStage))

        yield* Ref.update(statsRef, (stats) => recordDeactivation(stats, nowTs, lifetime, baseDeactivationDuration))
      })

    const getActiveChunks = (): Effect.Effect<ReadonlyArray<ChunkId>, never> =>
      Effect.map(Ref.get(lifecycleRef), (map) =>
        Array.from(HashMap.entries(map))
          .filter(([, stage]) => stage._tag === 'Active')
          .map(([id]) => id)
      )

    const getPoolMetrics = (): Effect.Effect<PoolMetrics, PoolMetricsError> =>
      Effect.gen(function* () {
        const map = yield* Ref.get(lifecycleRef)
        const autoConfig = yield* Ref.get(autoConfigRef)

        const totalChunks = HashMap.size(map)
        const activeChunks = countByTag(map, 'Active')
        const inactiveChunks = countByTag(map, 'Inactive')
        const cachedChunks = Math.max(0, totalChunks - activeChunks - inactiveChunks)

        const totalMemory = makeMemoryBytes(Math.max(Number(autoConfig.maxActiveChunks), totalChunks) * bytesPerChunk)
        const activeMemory = makeMemoryBytes(activeChunks * bytesPerChunk)
        const cachedMemory = makeMemoryBytes(cachedChunks * bytesPerChunk)
        const memoryUsage = makeMemoryUsage({
          total: totalMemory,
          active: activeMemory,
          cached: cachedMemory,
        })

        const memoryPressure = computeMemoryPressure(memoryUsage)

        const updatedStats = yield* Ref.updateAndGet(statsRef, (current) => setMemoryPressure(current, memoryPressure))

        const performance = makePerformanceMetrics({
          activationTime: averageActivationDuration(updatedStats),
          deactivationTime: averageDeactivationDuration(updatedStats),
          memoryPressure,
        })

        return yield* makePoolMetrics({
          totalChunks,
          activeChunks,
          inactiveChunks,
          memoryUsage,
          performance,
        })
      })

    const configure = (config: AutoManagementConfig): Effect.Effect<void, ConfigError> =>
      Effect.gen(function* () {
        yield* Match.value(Number(config.activationDistance) <= Number(config.deactivationDistance)).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Effect.fail(
              makeConfigError({
                _tag: 'InvalidDistance',
                activationDistance: config.activationDistance,
                deactivationDistance: config.deactivationDistance,
              })
            )
          )
        )

        yield* Ref.set(autoConfigRef, config)
      })

    const snapshotStats = (): Effect.Effect<LifecycleStats, never> =>
      Effect.map(Ref.get(statsRef), (accumulator) => toLifecycleStats(accumulator))

    return {
      activate,
      deactivate,
      getActiveChunks,
      getPoolMetrics,
      configure,
      snapshotStats,
    }
  })
