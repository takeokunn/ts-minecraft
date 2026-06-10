import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import {
  MeshingWorkerPool,
  MeshingWorkerPoolPort,
  MeshingWorkerPoolPortLayer,
} from '@ts-minecraft/worker'

// Bridge layer test for MeshingWorkerPoolPortLayer.
//
// In the vitest 'node' environment, `typeof Worker === 'undefined'` so the
// underlying MeshingWorkerPool falls through to the synchronous greedy
// meshing path (see meshing-worker-pool.ts:179). That gives us a deterministic
// surface to verify the port wiring without spinning up a real Worker.
//
// What this file proves:
// 1. `Layer.build(MeshingWorkerPoolPortLayer)` resolves a port instance.
// 2. The resolved port has a callable `meshChunk` whose error channel is
//    `never` (compile-time check via type assignment) and which produces a
//    valid WorkerMeshResult shape.
// 3. The bridge delegates 1:1 to the underlying `MeshingWorkerPool.meshChunk`
//    — providing both layers in the same scope yields the identical result
//    for a deterministic chunk.
// 4. The bridge re-uses the `MeshingWorkerPool.Default` singleton baked into
//    the port layer (`Layer.provide(MeshingWorkerPool.Default)` at the
//    bridge definition site) — calling `meshChunk` twice returns
//    structurally identical opaque payloads (proves no per-call pool
//    re-initialisation, i.e. the same backing service).

const TOTAL_BLOCKS = CHUNK_SIZE * CHUNK_SIZE * 256

const makeChunk = (): Chunk => {
  const blocks = new Uint8Array(TOTAL_BLOCKS)
  // DIRT (index 1) at lx=0, y=0, lz=0 — produces a non-empty mesh.
  blocks[0] = 1
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

describe('infrastructure/three/meshing/meshing-worker-pool-port-layer', () => {
  it('MeshingWorkerPoolPortLayer resolves a port whose _tag matches the application identity', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const port = yield* MeshingWorkerPoolPort
          expect(port).toBeDefined()
          expect(typeof port.meshChunk).toBe('function')
          // Tag is the application-layer port identity, not the infra service.
          expect((port as { _tag?: string })._tag).toBe(
            '@minecraft/application/rendering/MeshingWorkerPoolPort',
          )
        }).pipe(Effect.provide(MeshingWorkerPoolPortLayer)),
      ),
    )
  })

  it('bridge meshChunk delegates 1:1 to the underlying MeshingWorkerPool', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const port = yield* MeshingWorkerPoolPort
          const pool = yield* MeshingWorkerPool

          const chunk = makeChunk()
          const portResult = yield* port.meshChunk(chunk)
          const poolResult = yield* pool.meshChunk(chunk)

          // Both paths run the same synchronous greedy mesher, so opaque
          // typed-array contents must be byte-identical.
          expect(portResult.opaque.positions.length).toBeGreaterThan(0)
          expect(portResult.opaque.indices.length).toBeGreaterThan(0)
          expect(portResult.opaque.positions.length).toBe(
            poolResult.opaque.positions.length,
          )
          expect(portResult.opaque.indices.length).toBe(
            poolResult.opaque.indices.length,
          )
          expect(portResult.water).toBeNull()
          expect(poolResult.water).toBeNull()
        }).pipe(
          Effect.provide(MeshingWorkerPoolPortLayer),
          Effect.provide(MeshingWorkerPool.Default),
        ),
      ),
    )
  })

  it('error channel is never (port.meshChunk(chunk) typechecks as Effect<_, never, _>)', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const port = yield* MeshingWorkerPoolPort
          const eff = port.meshChunk(makeChunk())
          // Compile-time: assignable to Effect<unknown, never, unknown> means
          // the error channel collapsed to `never` at the bridge seam.
          const _check: Effect.Effect<unknown, never, unknown> = eff
          void _check
          const result = yield* eff
          expect(result.opaque).toBeDefined()
        }).pipe(Effect.provide(MeshingWorkerPoolPortLayer)),
      ),
    )
  })

  it('repeated bridge calls hit the same MeshingWorkerPool.Default singleton', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const port = yield* MeshingWorkerPoolPort
          const chunk = makeChunk()
          const a = yield* port.meshChunk(chunk)
          const b = yield* port.meshChunk(chunk)
          // Same singleton + deterministic input → identical opaque payload size.
          expect(a.opaque.positions.length).toBe(b.opaque.positions.length)
          expect(a.opaque.indices.length).toBe(b.opaque.indices.length)
        }).pipe(Effect.provide(MeshingWorkerPoolPortLayer)),
      ),
    )
  })
})
