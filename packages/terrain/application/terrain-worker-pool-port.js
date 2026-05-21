import { Data, Effect } from 'effect';
// Application-layer port for off-main-thread terrain generation.
// Exposes ONLY the surface consumed by chunk-manager-service.ts.
//
// Worker-internal details (Worker objects, transferable buffers, respawn,
// pending request maps, dev-mode buffer-detachment assertions) deliberately
// stay inside infrastructure/terrain/terrain-worker-pool.ts. The application
// layer must remain ignorant of whether terrain is generated on a Worker, on a
// thread pool, or synchronously — the port lets the implementation evolve
// without touching chunk-manager-service.ts.
//
// TerrainGenerationError and TerrainGenerationOptions are defined here
// (not imported from infrastructure) so the application layer never reaches
// across the architectural boundary. The infrastructure-side
// TerrainGenerationError happens to be structurally identical; the bridge
// in src/layers.ts widens the infrastructure error to the port error via a
// mapError so both sides speak the same vocabulary at the seam.
//
// Wired to infrastructure/terrain/TerrainWorkerPool via
// TerrainWorkerPoolPortLayer in src/layers.ts.
export class TerrainGenerationError extends Data.TaggedError('TerrainGenerationError') {
}
export class TerrainWorkerPoolPort extends Effect.Service()('@minecraft/application/terrain/TerrainWorkerPoolPort', {
    succeed: {
        /* c8 ignore next 5 */
        generateTerrain: (_coord, _options) => Effect.die('TerrainWorkerPoolPort.generateTerrain not provided'),
    },
}) {
}
//# sourceMappingURL=../../../dist/packages/terrain/application/terrain-worker-pool-port.js.map