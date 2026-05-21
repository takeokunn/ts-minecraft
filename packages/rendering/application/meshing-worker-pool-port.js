import { Effect } from 'effect';
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
// (packages/terrain/application/terrain-worker-pool-port.ts):
//   - `Effect.Service` exposed at this seam
//   - Concrete `MeshingWorkerPool` is bridged via `MeshingWorkerPoolPortLayer`
//     in infrastructure/meshing/meshing-worker-pool-port-layer.ts
//
// `WorkerMeshResult` is re-exported from infrastructure rather than redeclared:
// it is a structural payload of typed-array buffers (positions/normals/etc.)
// that flow through the port unchanged. Re-declaring it would force a noop
// remap on every meshChunk call. The shape is part of the port contract; if
// it changes, both sides update together.
//
// The error channel is `never`: `MeshingWorkerPool.meshChunk` already
// terminates its `Effect.catchAll` by falling back to synchronous meshing,
// so no error reaches the port consumer. If a future implementation surfaces
// errors, a `MeshingError` tagged class would be added here (not imported
// from infrastructure) to keep the application layer error-vocabulary stable.
export class MeshingWorkerPoolPort extends Effect.Service()('@minecraft/application/rendering/MeshingWorkerPoolPort', {
    succeed: {
        /* c8 ignore next 3 */
        meshChunk: (_chunk, _options) => Effect.die('MeshingWorkerPoolPort.meshChunk not provided'),
    },
}) {
}
// `WorkerMeshResult` is exported from the infrastructure module
// (`./infrastructure/meshing/meshing-worker-pool`); consumers import it from
// the package root (`@ts-minecraft/rendering`). Duplicating the re-export
// here would collide under `export *` re-exports in the package index.
//# sourceMappingURL=../../../dist/packages/rendering/application/meshing-worker-pool-port.js.map