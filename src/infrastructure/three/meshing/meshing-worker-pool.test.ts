import { describe, expect } from '@effect/vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { MeshingWorkerPool } from './meshing-worker-pool'
import type { Chunk } from '@/domain/chunk'

const makeChunk = (): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: (() => {
    const blocks = new Uint8Array(16 * 16 * 256)
    blocks[0] = 1
    return blocks
  })(),
  fluid: Option.none(),
})

describe('infrastructure/three/meshing/meshing-worker-pool', () => {
  it.effect('falls back to synchronous meshing when Worker is unavailable', () =>
    Effect.gen(function* () {
      const pool = yield* MeshingWorkerPool
      expect(pool.workerCount).toBe(0)

      const result = yield* pool.meshChunk(makeChunk())
      expect(result.opaque.positions.length).toBeGreaterThan(0)
      expect(result.opaque.indices.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(MeshingWorkerPool.Default))
  )
})
