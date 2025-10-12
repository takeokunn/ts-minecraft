import { Layer, Effect } from 'effect'
import {
  HardwareProfileServiceTag,
  type HardwareSpec,
  type LoadCondition,
} from '@domain/world_generation/factory/generation_session_factory/configuration'
import type { SessionFactoryError } from '@domain/world_generation/factory/generation_session_factory/index'

const detectHardwareSpec = (): Effect.Effect<HardwareSpec, SessionFactoryError> =>
  Effect.sync(() => {
    const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
    return {
      cpuCores: Math.max(1, hardwareConcurrency ?? 4),
      memoryMB: 4096,
      storageSpeedMBps: 100,
      networkLatencyMs: 50,
      hasSSE: true,
      hasSIMD: true,
    }
  })

const getCurrentLoadCondition = (): Effect.Effect<LoadCondition, SessionFactoryError> =>
  Effect.succeed({
    currentCpuUsage: 30,
    currentMemoryUsage: 40,
    activeConnections: 0,
    queuedRequests: 0,
    networkThroughput: 0,
  })

export const BrowserHardwareProfileServiceLive = Layer.succeed(HardwareProfileServiceTag, {
  detectHardwareSpec,
  getCurrentLoadCondition,
})
