import { Data, Effect } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/domain'
import type { ChunkBlocks } from './terrain-generation'

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
export class TerrainGenerationError extends Data.TaggedError('TerrainGenerationError')<{
  readonly reason: string
  readonly chunk: ChunkCoord
}> {}

export type TerrainGenerationOptions = Readonly<{
  seaLevel: number
  lakeLevel: number
  seed: number
}>

export class TerrainWorkerPoolPort extends Effect.Service<TerrainWorkerPoolPort>()(
  '@minecraft/application/terrain/TerrainWorkerPoolPort',
  {
    succeed: {
      generateTerrain: (
        _coord: ChunkCoord,
        _options: TerrainGenerationOptions,
      ): Effect.Effect<ChunkBlocks, TerrainGenerationError> =>
        Effect.die('TerrainWorkerPoolPort.generateTerrain not provided'),
    },
  }
) {}

export type { ChunkBlocks } from './terrain-generation'
