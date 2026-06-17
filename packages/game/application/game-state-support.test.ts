import { describe, it, expect, vi } from 'vitest'
import { Effect, Ref } from 'effect'
import { PhysicsBodyId } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { PhysicsService } from './physics-service'
import { PhysicsServiceError } from './physics-service-error'
import {
  createChunkCache,
  refreshChunkCache,
  applyWaterDrag,
  type ChunkCache,
} from './game-state-support'

const chunk = (label: string) => ({ blocks: new Uint8Array([label.length]) } as const)

describe('createChunkCache', () => {
  it('creates a fixed-size 3x3 cache filled with null slots', () => {
    const cache = createChunkCache()
    expect(cache).toHaveLength(9)
    expect(cache.every((slot) => slot === null)).toBe(true)
  })
})

describe('refreshChunkCache', () => {
  it('loads the 3x3 neighborhood and updates the last chunk coord', async () => {
    const loaded = new Map<string, { blocks: Uint8Array }>()
    const getChunk = vi.fn((coord: { x: number; z: number }) => {
      const key = `${coord.x},${coord.z}`
      const value = loaded.get(key) ?? chunk(key)
      loaded.set(key, value)
      return Effect.succeed(value)
    })
    const chunkManagerService = { getChunk } as unknown as Pick<ChunkManagerService, 'getChunk'>

    await Effect.runPromise(Effect.gen(function* () {
      const cacheRef = yield* Ref.make<ChunkCache>([
        chunk('stale-0'),
        chunk('stale-1'),
        chunk('stale-2'),
        chunk('stale-3'),
        chunk('stale-4'),
        chunk('stale-5'),
        chunk('stale-6'),
        chunk('stale-7'),
        chunk('stale-8'),
      ])
      const coordRef = yield* Ref.make({ cx: -1, cz: -1 })

      yield* refreshChunkCache(chunkManagerService, 8, 12, cacheRef, coordRef)

      const cache = yield* Ref.get(cacheRef)
      expect(cache).toHaveLength(9)
      expect(yield* Ref.get(coordRef)).toEqual({ cx: 8, cz: 12 })
      expect(getChunk).toHaveBeenCalledTimes(9)

      for (const [dx, dz] of [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 0],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ] as const) {
        const expected = loaded.get(`${8 + dx},${12 + dz}`)
        expect(cache[(dx + 1) * 3 + (dz + 1)]).toBe(expected)
      }
    }))
  })
})

describe('applyWaterDrag', () => {
  it('applies swim, sneak, and sink velocities', async () => {
    const calls: Array<{ id: PhysicsBodyId; velocity: { x: number; y: number; z: number } }> = []
    const physicsService = {
      setVelocity: (id: PhysicsBodyId, velocity: { x: number; y: number; z: number }) => {
        calls.push({ id, velocity })
        return Effect.void
      },
    } as unknown as Pick<PhysicsService, 'setVelocity'>

    await Effect.runPromise(Effect.gen(function* () {
      const bodyId = PhysicsBodyId.make('player-1')
      yield* applyWaterDrag(physicsService, bodyId, { x: 4, y: -4, z: -2 }, true, false, 0.5)
      yield* applyWaterDrag(physicsService, bodyId, { x: 4, y: -4, z: -2 }, false, true, 0.5)
      yield* applyWaterDrag(physicsService, bodyId, { x: 4, y: -4, z: -2 }, false, false, 0.5)
    }))

    expect(calls).toEqual([
      {
        id: PhysicsBodyId.make('player-1'),
        velocity: { x: 2, y: 3, z: -1 },
      },
      {
        id: PhysicsBodyId.make('player-1'),
        velocity: { x: 2, y: -1.6, z: -1 },
      },
      {
        id: PhysicsBodyId.make('player-1'),
        velocity: { x: 2, y: -1.2, z: -1 },
      },
    ])
  })

  it('swallows PhysicsServiceError failures', async () => {
    const physicsService = {
      setVelocity: () => Effect.fail(new PhysicsServiceError({ operation: 'setVelocity', cause: 'boom' })),
    } as unknown as Pick<PhysicsService, 'setVelocity'>

    await Effect.runPromise(
      applyWaterDrag(physicsService, PhysicsBodyId.make('player-2'), { x: 1, y: 1, z: 1 }, false, false, 0.4)
    )
  })
})
