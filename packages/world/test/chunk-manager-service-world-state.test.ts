import { Effect, Ref } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { WorldId } from '@ts-minecraft/core'
import { buildDimensionWorldId, buildSetActiveDimension } from '../application/chunk-manager-service-world-state'

const makeResetCacheSpy = () => {
  const calls: Array<string> = []
  const resetCache = (worldId: string) => {
    calls.push(worldId)
    return Effect.void
  }
  return { calls, resetCache }
}

describe('chunk-manager-service-world-state', () => {
  describe('buildDimensionWorldId', () => {
    it('keeps the base world ID for overworld', () => {
      expect(buildDimensionWorldId(WorldId.make('world'), 'overworld')).toEqual(WorldId.make('world'))
    })

    it('adds the nether suffix', () => {
      expect(buildDimensionWorldId(WorldId.make('world'), 'nether')).toEqual(WorldId.make('world-nether'))
    })

    it('adds the end suffix', () => {
      expect(buildDimensionWorldId(WorldId.make('world'), 'end')).toEqual(WorldId.make('world-end'))
    })
  })

  describe('buildSetActiveDimension', () => {
    it.effect('uses the base world id and updates the active dimension', () =>
      Effect.gen(function* () {
        const baseWorldIdRef = yield* Ref.make(WorldId.make('world'))
        const dimensionRef = yield* Ref.make<'overworld' | 'nether' | 'end'>('overworld')
        const { calls, resetCache } = makeResetCacheSpy()

        const setActiveDimension = buildSetActiveDimension(baseWorldIdRef, dimensionRef, resetCache)

        yield* setActiveDimension('nether')

        const updatedDimension = yield* Ref.get(dimensionRef)
        expect(updatedDimension).toBe('nether')
        expect(calls).toEqual(['world-nether'])
      }))
  })
})
