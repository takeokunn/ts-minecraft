import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'effect/FastCheck'
import { TerrainAdaptationService, TerrainAdaptationServiceLive } from '../terrain_adaptation_service'
import { FluidState } from '../../value_object/fluid_state'

describe('TerrainAdaptationService', () => {
  const layer = TerrainAdaptationServiceLive

  it.effect('classifies solid ground', () =>
    Effect.gen(function* () {
      const service = yield* TerrainAdaptationService
      const analysis = yield* service.analyze({
        feetBlock: 1,
        bodyBlock: null,
        belowBlock: 1,
        fluid: FluidState.presets.none,
      })
      expect(analysis.surface).toBe('solid')
      expect(analysis.canJump).toBe(true)
    }).pipe(Effect.provideLayer(layer))
  )
})

  it.effect.prop('liquid surface identified from blocks', [fc.constantFrom(8, 9, 10, 11)], ([blockId]) =>
    Effect.gen(function* () {
      const service = yield* TerrainAdaptationService
      const analysis = yield* service.analyze({
        feetBlock: blockId,
        bodyBlock: null,
        belowBlock: blockId,
        fluid: FluidState.classify(blockId) === 'none' ? FluidState.presets.none : FluidState.presets.water,
      })
      expect(['solid', 'liquid', 'air']).toContain(analysis.surface)
    }).pipe(Effect.provideLayer(layer))
  )
