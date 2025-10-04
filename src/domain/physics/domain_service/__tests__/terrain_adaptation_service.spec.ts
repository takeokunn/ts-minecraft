import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { provideLayersScoped } from '../../../../testing/effect'
import { FluidState } from '../../value_object/fluid_state'
import { TerrainAdaptationService, TerrainAdaptationServiceLive } from '../terrain_adaptation_service'

const withAnalysis = <A>(
  context: Parameters<TerrainAdaptationService['analyze']>[0],
  verify: (result: Awaited<ReturnType<TerrainAdaptationService['analyze']>>) => void
) =>
  Effect.gen(function* () {
    const service = yield* TerrainAdaptationService
    const result = yield* service.analyze(context)
    yield* Effect.sync(() => verify(result))
  }).pipe(provideLayersScoped(TerrainAdaptationServiceLive))

describe('TerrainAdaptationService', () => {
  it.effect('classifies solid ground', () =>
    withAnalysis(
      {
        feetBlock: 1,
        bodyBlock: null,
        belowBlock: 1,
        fluid: FluidState.presets.none,
      },
      (result) => {
        expect(result.surface).toBe('solid')
        expect(result.movementMultiplier).toBe(1)
        expect(result.canJump).toBe(true)
        expect(result.canStep).toBe(true)
        expect(result.breathingDifficulty).toBe(0)
      }
    )
  )

  it.effect('liquid surface identified from blocks', () =>
    withAnalysis(
      {
        feetBlock: 8,
        bodyBlock: 0,
        belowBlock: 8,
        fluid: FluidState.presets.water,
      },
      (result) => {
        expect(result.surface).toBe('liquid')
        expect(result.movementMultiplier).toBeCloseTo(0.4, 5)
        expect(result.canJump).toBe(true)
        expect(result.canStep).toBe(true)
        expect(result.breathingDifficulty).toBe(1)
      }
    )
  )
})
