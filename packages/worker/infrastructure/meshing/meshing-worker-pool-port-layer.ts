import { Effect, Layer } from 'effect'
import { MeshingWorkerPoolPort } from '../../application/meshing-worker-pool-port'
import { MeshingWorkerPool } from './meshing-worker-pool'

// Bridge: satisfies the application-layer MeshingWorkerPoolPort using the
// concrete infrastructure MeshingWorkerPool implementation. Mirrors
// TerrainWorkerPoolPortLayer.
//
// `MeshingWorkerPool.meshChunk` returns `Effect<WorkerMeshResult, Error>` in
// its raw (worker-async) form, but the public surface ALREADY pipes through
// `Effect.catchAll(...fallback to sync...)` which collapses the error channel
// to `never`. The structural type `Effect<WorkerMeshResult>` (no error) is
// exactly the port contract, so no `mapError` is necessary at this seam.
export const MeshingWorkerPoolPortLayer = Layer.effect(
  MeshingWorkerPoolPort,
  Effect.map(MeshingWorkerPool, (pool) => {
    return MeshingWorkerPoolPort.of({
      _tag: '@minecraft/application/rendering/MeshingWorkerPoolPort' as const,
      meshChunk: (chunk, options) => pool.meshChunk(chunk, options),
    })
  })
).pipe(Layer.provide(MeshingWorkerPool.Default))
