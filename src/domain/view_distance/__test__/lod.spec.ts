import { describe, expect, it, prop } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
import { Effect } from 'effect'
import {
  createManagedObject,
  createPerformanceMetrics,
  toViewDistance,
} from '../types.js'
import { LODInternals, createLODSelector, type LODSelectionContext } from '../lod.js'

const baseContext = Effect.runSync(
  Effect.gen(function* () {
    const maxViewDistance = yield* toViewDistance(64)
    return {
      cameraPosition: { x: 0, y: 0, z: 0 },
      performance: createPerformanceMetrics({ frameRate: 60, memoryUsage: 0.4, triangleCount: 100_000 }),
      maxViewDistance,
    } satisfies LODSelectionContext
  })
)

describe('view_distance/lod', () => {
  const selector = createLODSelector()

  const makeObject = (position: { readonly x: number; readonly y: number; readonly z: number }) =>
    createManagedObject({
      id: `${position.x}:${position.z}`,
      position,
      boundingRadius: 1,
      priority: 0.5,
      lodLevel: 2,
      lastUpdatedAt: 0,
    })

  it.effect('selectForObject returns low LOD for nearby objects', () =>
    Effect.gen(function* () {
      const decision = yield* selector.selectForObject(makeObject({ x: 2, y: 0, z: 2 }), baseContext)
      expect(decision.level).toBeLessThanOrEqual(1)
    })
  )

  it.effect('selectForObject increases LOD for distant objects', () =>
    Effect.gen(function* () {
      const decision = yield* selector.selectForObject(makeObject({ x: 40, y: 0, z: 0 }), baseContext)
      expect(decision.level).toBeGreaterThanOrEqual(3)
    })
  )

  it.effect('selectForObject adapts to low frame rate', () =>
    Effect.gen(function* () {
      const slowContext: LODSelectionContext = {
        ...baseContext,
        performance: createPerformanceMetrics({ frameRate: 20, memoryUsage: 0.8, triangleCount: 200_000 }),
      }
      const decision = yield* selector.selectForObject(makeObject({ x: 10, y: 0, z: 0 }), slowContext)
      expect(decision.level).toBeGreaterThanOrEqual(1)
    })
  )

  prop(
    'internal computations clamp results',
    [
      FC.double({ min: 0, max: 60, noNaN: true, noInfinity: true }),
      FC.integer({ min: 5, max: 64 }),
      FC.integer({ min: 10, max: 120 }),
    ],
    ([distance, maxViewDistance, frameRate]) => {
      const viewDistance = Effect.runSync(toViewDistance(maxViewDistance))
      const baseLevel = Effect.runSync(LODInternals.computeBaseLevel(distance, viewDistance))
      expect(baseLevel).toBeGreaterThanOrEqual(0)
      expect(baseLevel).toBeLessThanOrEqual(4)

      const performance = createPerformanceMetrics({ frameRate, memoryUsage: 0.5, triangleCount: 100_000 })
      const adjusted = Effect.runSync(LODInternals.adjustForPerformance(baseLevel, performance))
      expect(adjusted).toBeGreaterThanOrEqual(0)
      expect(adjusted).toBeLessThanOrEqual(4)

      const confidence = LODInternals.computeConfidence(distance, viewDistance)
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    }
  )
})
