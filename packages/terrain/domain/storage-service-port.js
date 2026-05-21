import { Effect, Option } from 'effect';
// Application-layer port for chunk persistence.
// Decouples application services from IndexedDB infrastructure.
// Wired to infrastructure/storage/StorageService via StoragePortLayer in src/layers.ts.
export class StorageServicePort extends Effect.Service()('@minecraft/application/storage/StorageServicePort', {
    succeed: {
        /* c8 ignore next 5 */
        saveChunk: (_worldId, _chunkCoord, _data) => Effect.void,
        /* c8 ignore next 4 */
        loadChunk: (_worldId, _chunkCoord) => Effect.succeed(Option.none()),
    },
}) {
}
//# sourceMappingURL=../../../dist/packages/terrain/domain/storage-service-port.js.map