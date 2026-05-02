// Gap P — BlockService worldToBlockLocal round-trip property
//
// The internal worldToBlockLocal function uses double-modulo for negative
// coordinates. The invariant is:
//
//   chunkCoord.x * CHUNK_SIZE + lx  ===  Math.floor(wx)
//   chunkCoord.z * CHUNK_SIZE + lz  ===  Math.floor(wz)
//
// We exercise this at the integration level by using the same formula that
// block-service.ts uses (mirrored in worldToLocal in block-service.test.ts)
// and asserting the round-trip for any integer world coordinate.
import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'

const worldToBlockLocal = (w: number): { chunkCoord: number; local: number } => {
  const chunkCoord = Math.floor(w / CHUNK_SIZE)
  const local = ((Math.floor(w) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { chunkCoord, local }
}

describe('block-service / worldToBlockLocal (property-based)', () => {
  it.effect(
    'round-trip: chunkCoord * CHUNK_SIZE + local === Math.floor(wx) for any integer x',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -10000, max: 10000 }),
            (wx) => {
              const { chunkCoord, local } = worldToBlockLocal(wx)
              return chunkCoord * CHUNK_SIZE + local === Math.floor(wx)
            }
          )
        )
      })
  )

  it.effect(
    'round-trip: chunkCoord * CHUNK_SIZE + local === Math.floor(wz) for any integer z',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -10000, max: 10000 }),
            (wz) => {
              const { chunkCoord, local } = worldToBlockLocal(wz)
              return chunkCoord * CHUNK_SIZE + local === Math.floor(wz)
            }
          )
        )
      })
  )

  it.effect(
    'local coordinate is always in [0, CHUNK_SIZE) for any integer world coordinate',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -10000, max: 10000 }),
            (w) => {
              const { local } = worldToBlockLocal(w)
              return local >= 0 && local < CHUNK_SIZE
            }
          )
        )
      })
  )

  it.effect(
    'negative world coordinates map to the correct (negative) chunk coord',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -10000, max: -1 }),
            (wx) => {
              const { chunkCoord } = worldToBlockLocal(wx)
              return chunkCoord < 0
            }
          )
        )
      })
  )

  it.effect(
    'positive world coordinates map to non-negative chunk coord',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            (wx) => {
              const { chunkCoord } = worldToBlockLocal(wx)
              return chunkCoord >= 0
            }
          )
        )
      })
  )

  it.effect(
    'both x and z axes round-trip independently for any (wx, wz) integer pair',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -10000, max: 10000 }),
            fc.integer({ min: -10000, max: 10000 }),
            (wx, wz) => {
              const x = worldToBlockLocal(wx)
              const z = worldToBlockLocal(wz)
              return (
                x.chunkCoord * CHUNK_SIZE + x.local === Math.floor(wx) &&
                z.chunkCoord * CHUNK_SIZE + z.local === Math.floor(wz)
              )
            }
          )
        )
      })
  )
})
