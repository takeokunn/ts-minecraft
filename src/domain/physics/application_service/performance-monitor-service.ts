import { Array as Arr, Context, Effect, Layer, Match, Ref, pipe } from 'effect'
import type { PhysicsWorldId } from '../types/core'
import type { PhysicsError } from '../types/errors'
import { PERFORMANCE_THRESHOLDS } from '../types/constants'

export interface PerformanceSample {
  readonly worldId: PhysicsWorldId
  readonly frameTime: number
  readonly physicsTime: number
}

type HealthClass = 'good' | 'warning' | 'critical'

export interface PerformanceReport {
  readonly averageFrameTime: number
  readonly averagePhysicsTime: number
  readonly classification: HealthClass
}

export interface PerformanceMonitorApplicationService {
  readonly record: (sample: PerformanceSample) => Effect.Effect<void, PhysicsError>
  readonly report: () => Effect.Effect<PerformanceReport, PhysicsError>
}

export const PerformanceMonitorApplicationService = Context.GenericTag<PerformanceMonitorApplicationService>(
  '@minecraft/physics/PerformanceMonitorApplicationService'
)

const Health: Record<HealthClass, HealthClass> = {
  good: 'good',
  warning: 'warning',
  critical: 'critical',
}

const classify = (frameTime: number): HealthClass =>
  pipe(
    frameTime,
    Match.value,
    Match.when(
      (value) => value <= PERFORMANCE_THRESHOLDS.warningFrameTime,
      () => Health.good
    ),
    Match.when(
      (value) => value <= PERFORMANCE_THRESHOLDS.criticalFrameTime,
      () => Health.warning
    ),
    Match.orElse(() => Health.critical)
  )

export const PerformanceMonitorApplicationServiceLive = Layer.effect(
  PerformanceMonitorApplicationService,
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<PerformanceSample>>([])

    const record: PerformanceMonitorApplicationService['record'] = (sample) =>
      Ref.update(store, (current) => (
        pipe(current, Arr.append(sample), (updated) => (updated.length > 120 ? updated.slice(updated.length - 120) : updated))
      ))

    const report: PerformanceMonitorApplicationService['report'] = () =>
      Effect.map(Ref.get(store), (samples) => {
        const size = samples.length || 1
        const totals = samples.reduce(
          (acc, sample) => ({
            frame: acc.frame + sample.frameTime,
            physics: acc.physics + sample.physicsTime,
          }),
          { frame: 0, physics: 0 }
        )
        const averageFrameTime = totals.frame / size
        const averagePhysicsTime = totals.physics / size
        return {
          averageFrameTime,
          averagePhysicsTime,
          classification: classify(averageFrameTime),
        }
      })

    return {
      record,
      report,
    }
  })
)
