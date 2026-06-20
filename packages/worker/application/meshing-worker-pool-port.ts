import { Effect } from 'effect'
import type { Chunk } from '@ts-minecraft/world'
import type { MeshChunkOptions, WorkerMeshResult } from '../domain/meshing-worker-pool-types'

// Application-layer port for off-main-thread chunk meshing.
// Exposes ONLY the surface consumed by infrastructure/three/meshing/chunk-mesh.ts
// (`meshChunk`).
//
// Worker-internal details (Worker objects, transferable buffers, pending
// request maps, sync fallback when Worker is unavailable, decode validation,
// timeout-and-degrade logic) deliberately stay inside
// infrastructure/meshing/meshing-worker-pool.ts. The application layer must
// remain ignorant of whether meshing runs on a Worker, on a thread pool, or
// synchronously — the port lets the implementation evolve without touching
// the consumers.
//
// Mirrors the architecture of TerrainWorkerPoolPort
// (packages/world/application/terrain-worker-pool-port.ts):
//   - `Effect.Service` exposed at this seam
//   - Concrete `MeshingWorkerPool` is bridged via `MeshingWorkerPoolPortLayer`
//     in infrastructure/meshing/meshing-worker-pool-port-layer.ts
// The error channel is `never`: `MeshingWorkerPool.meshChunk` already
// terminates its `Effect.catchAll` by falling back to synchronous meshing,
// so no error reaches the port consumer. If a future implementation surfaces
// errors, a `MeshingError` tagged class would be added here (not imported
// from infrastructure) to keep the application layer error-vocabulary stable.
export class MeshingWorkerPoolPort extends Effect.Service<MeshingWorkerPoolPort>()(
  '@minecraft/application/rendering/MeshingWorkerPoolPort',
  {
    succeed: {
      /* c8 ignore next 3 */
      meshChunk: (_chunk: Chunk, _options?: MeshChunkOptions): Effect.Effect<WorkerMeshResult, never> =>
        Effect.die('MeshingWorkerPoolPort.meshChunk not provided'),
    },
  }
) {}
