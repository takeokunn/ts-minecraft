import { Effect } from 'effect'
import {
  AutoManagementConfig,
  SystemLoad,
} from '../../types/interfaces'
import {
  MaxActiveChunks,
  ResourceUsagePercent,
  makeMaxActiveChunks,
  makeResourceUsagePercent,
} from '../../types/core'

export const shouldThrottleActivations = (
  config: AutoManagementConfig,
  systemLoad: SystemLoad,
  activeChunks: number
): Effect.Effect<boolean, never> =>
  Effect.succeed(
    activeChunks >= Number(config.maxActiveChunks) || systemLoad.memory >= config.memoryThreshold
  )

export const shouldEvictChunks = (
  config: AutoManagementConfig,
  systemLoad: SystemLoad,
  activeChunks: number
): Effect.Effect<boolean, never> =>
  Effect.succeed(
    config.enabled &&
      (activeChunks > Number(config.maxActiveChunks) || systemLoad.memory >= config.memoryThreshold)
  )

export const computeTargetActiveChunks = (
  config: AutoManagementConfig,
  systemLoad: SystemLoad
): Effect.Effect<MaxActiveChunks, never> =>
  Effect.succeed(
    makeMaxActiveChunks(
      Math.max(
        1,
        Math.round(
          Number(config.maxActiveChunks) *
            Math.min(
              1,
              Math.max(
                0.2,
                1 - systemLoad.memory / Math.max(Number(config.memoryThreshold), Number.EPSILON) / 2
              )
            )
        )
      )
    )
  )

export const blendMemoryPressure = (
  current: ResourceUsagePercent,
  load: SystemLoad
): ResourceUsagePercent =>
  makeResourceUsagePercent((current + load.memory) / 2)
