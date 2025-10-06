import {
  makeChunkLifetime,
  makeResourceUsagePercent,
  type ChunkLifetime,
  type ResourceUsagePercent,
  type Timestamp,
} from '../../types'
import type { LifecycleStats } from '../../types'

export type LifecycleAccumulator = {
  readonly totalActivations: number
  readonly totalDeactivations: number
  readonly accumulatedLifetime: number
  readonly activationDurationSum: number
  readonly deactivationDurationSum: number
  readonly memoryPressure: ResourceUsagePercent
  readonly cacheHitRate: ResourceUsagePercent
  readonly errorRate: ResourceUsagePercent
  readonly lastUpdated: Timestamp
}

export const createLifecycleAccumulator = (now: Timestamp): LifecycleAccumulator => ({
  totalActivations: 0,
  totalDeactivations: 0,
  accumulatedLifetime: 0,
  activationDurationSum: 0,
  deactivationDurationSum: 0,
  memoryPressure: makeResourceUsagePercent(0),
  cacheHitRate: makeResourceUsagePercent(1),
  errorRate: makeResourceUsagePercent(0),
  lastUpdated: now,
})

export const recordActivation = (
  accumulator: LifecycleAccumulator,
  now: Timestamp,
  activationDuration: ChunkLifetime
): LifecycleAccumulator => ({
  ...accumulator,
  totalActivations: accumulator.totalActivations + 1,
  activationDurationSum: accumulator.activationDurationSum + activationDuration,
  lastUpdated: now,
})

export const recordDeactivation = (
  accumulator: LifecycleAccumulator,
  now: Timestamp,
  lifetime: ChunkLifetime,
  deactivationDuration: ChunkLifetime
): LifecycleAccumulator => ({
  ...accumulator,
  totalDeactivations: accumulator.totalDeactivations + 1,
  accumulatedLifetime: accumulator.accumulatedLifetime + lifetime,
  deactivationDurationSum: accumulator.deactivationDurationSum + deactivationDuration,
  lastUpdated: now,
})

export const setMemoryPressure = (
  accumulator: LifecycleAccumulator,
  pressure: ResourceUsagePercent
): LifecycleAccumulator => ({
  ...accumulator,
  memoryPressure: pressure,
})

const average = (sum: number, count: number): number => (count <= 0 ? 0 : sum / count)

export const toLifecycleStats = (accumulator: LifecycleAccumulator): LifecycleStats => ({
  totalActivations: accumulator.totalActivations,
  totalDeactivations: accumulator.totalDeactivations,
  averageLifetime: makeChunkLifetime(
    Math.round(average(accumulator.accumulatedLifetime, accumulator.totalDeactivations))
  ),
  memoryEfficiency: makeResourceUsagePercent(Math.max(0, 1 - accumulator.memoryPressure)),
  cacheHitRate: accumulator.cacheHitRate,
  errorRate: accumulator.errorRate,
  lastUpdated: accumulator.lastUpdated,
})

export const averageActivationDuration = (accumulator: LifecycleAccumulator): ChunkLifetime =>
  makeChunkLifetime(Math.round(average(accumulator.activationDurationSum, accumulator.totalActivations)))

export const averageDeactivationDuration = (accumulator: LifecycleAccumulator): ChunkLifetime =>
  makeChunkLifetime(Math.round(average(accumulator.deactivationDurationSum, accumulator.totalDeactivations)))
