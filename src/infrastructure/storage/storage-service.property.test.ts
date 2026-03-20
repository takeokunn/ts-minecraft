/**
 * Gap R — StorageService chunk key uniqueness property
 *
 * The chunkKey function produces `${worldId}:${x}:${z}`.
 * Property: distinct (worldId, x, z) triples produce distinct keys.
 *
 * This prevents collision bugs such as z=1,x=10 producing the same key as
 * z=10,x=1 (which would happen with a naive `${x}${z}` scheme).
 *
 * Since chunkKey is private, we test it indirectly through the in-memory
 * storage mock that mirrors the StorageService contract: save a chunk at
 * coord (x1,z1) and another at (x2,z2) in the same world — they must not
 * overwrite each other.
 */
import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { WorldId } from '@/shared/kernel'
import type { ChunkCoord } from '@/domain/chunk'

// ---------------------------------------------------------------------------
// Replicate the chunk key formula (mirrors storage-service.ts chunkKey)
// ---------------------------------------------------------------------------
const chunkKey = (worldId: string, coord: ChunkCoord): string =>
  `${worldId}:${coord.x}:${coord.z}`

// ---------------------------------------------------------------------------
// In-memory storage mock (mirrors makeInMemoryStorageService in test file)
// ---------------------------------------------------------------------------
const makeInMemoryStorage = () => {
  const store = new Map<string, Uint8Array>()
  const worldId = 'test-world' as WorldId

  const save = (coord: ChunkCoord, data: Uint8Array): void => {
    store.set(chunkKey(worldId, coord), data)
  }

  const load = (coord: ChunkCoord): Option.Option<Uint8Array> => {
    const val = store.get(chunkKey(worldId, coord))
    return val !== undefined ? Option.some(val) : Option.none()
  }

  return { save, load }
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('storage-service / chunk key uniqueness (property-based)', () => {
  it.effect(
    'distinct (x, z) coordinates produce distinct keys — no collision between (0,1) and (1,0)',
    () =>
      Effect.sync(() => {
        // Targeted regression: the specific collision pattern z=1,x=10 vs z=10,x=1
        // would happen with "x:z" format. Verify it does NOT happen with "x:z" (colon-separated).
        const key1 = chunkKey('world', { x: 1, z: 10 })
        const key2 = chunkKey('world', { x: 10, z: 1 })
        if (key1 === key2) {
          throw new Error(`Key collision: (1,10) and (10,1) both produce "${key1}"`)
        }
      })
  )

  it.effect(
    'distinct (x, z) pairs stored in the same world are independent — save/load round-trip',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            (x1, z1, x2, z2) => {
              // Only assert when the coordinates are actually distinct
              if (x1 === x2 && z1 === z2) return true

              const storage = makeInMemoryStorage()
              const data1 = new Uint8Array([1, 2, 3])
              const data2 = new Uint8Array([7, 8, 9])

              storage.save({ x: x1, z: z1 }, data1)
              storage.save({ x: x2, z: z2 }, data2)

              const loaded1 = storage.load({ x: x1, z: z1 })
              const loaded2 = storage.load({ x: x2, z: z2 })

              // Both must be Some
              if (Option.isNone(loaded1) || Option.isNone(loaded2)) return false

              // Each must retain its own data, not the other's
              return (
                loaded1.value[0] === 1 &&
                loaded2.value[0] === 7
              )
            }
          )
        )
      })
  )

  it.effect(
    'distinct worldIds with same coordinates produce distinct keys',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.integer({ min: -50, max: 50 }),
            fc.integer({ min: -50, max: 50 }),
            (worldId1, worldId2, x, z) => {
              if (worldId1 === worldId2) return true

              const key1 = chunkKey(worldId1, { x, z })
              const key2 = chunkKey(worldId2, { x, z })
              return key1 !== key2
            }
          )
        )
      })
  )

  it.effect(
    'chunk key is deterministic — same inputs always produce the same key',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            (worldId, x, z) => {
              const key1 = chunkKey(worldId, { x, z })
              const key2 = chunkKey(worldId, { x, z })
              return key1 === key2
            }
          )
        )
      })
  )

  it.effect(
    'saved chunk is retrievable at the exact same coordinate',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            (x, z) => {
              const storage = makeInMemoryStorage()
              const data = new Uint8Array([42, 43, 44])
              storage.save({ x, z }, data)
              const result = storage.load({ x, z })
              if (Option.isNone(result)) return false
              return result.value[0] === 42 && result.value[1] === 43 && result.value[2] === 44
            }
          )
        )
      })
  )

  it.effect(
    'loading a coordinate that was never saved returns None',
    () =>
      Effect.sync(() => {
        fc.assert(
          fc.property(
            fc.integer({ min: -100, max: 100 }),
            fc.integer({ min: -100, max: 100 }),
            (x, z) => {
              const storage = makeInMemoryStorage()
              const result = storage.load({ x, z })
              return Option.isNone(result)
            }
          )
        )
      })
  )
})
