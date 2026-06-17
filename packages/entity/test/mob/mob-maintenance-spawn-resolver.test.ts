import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { makeTerrainAwareSpawnResolver } from '../../application/mob/mob-maintenance-spawn-resolver'
import { expectSome, makeTerrainChunk } from './test-utils'

describe('entity/mob-maintenance-spawn-resolver', () => {
  it.effect('resolves a terrain-aware spawn position from the candidate chunk', () =>
    Effect.gen(function* () {
      let observedCoord: { readonly x: number; readonly z: number } | undefined

      const resolver = makeTerrainAwareSpawnResolver(
        {
          getChunk: (coord) => {
            observedCoord = coord
            return Effect.succeed(
              makeTerrainChunk(
                [{ lx: 1, y: 60, lz: 1, blockType: 'STONE' }],
                { coord: { x: 1, z: 1 } },
              ),
            )
          },
        },
        true,
      )

      const result = yield* resolver({ x: 17.5, y: 64, z: 17.5 })

      expect(observedCoord).toEqual({ x: 1, z: 1 })
      const resolved = expectSome(result)
      expect(resolved.x).toBe(17.5)
      expect(resolved.z).toBe(17.5)
      expect(resolved.y).toBeCloseTo(61.9)
    }))

  it.effect('returns none when chunk lookup fails', () =>
    Effect.gen(function* () {
      const resolver = makeTerrainAwareSpawnResolver(
        {
          getChunk: () => Effect.dieMessage('missing chunk'),
        },
        true,
      )

      const result = yield* resolver({ x: 17.5, y: 64, z: 17.5 })

      expect(Option.isNone(result)).toBe(true)
    }))
})
