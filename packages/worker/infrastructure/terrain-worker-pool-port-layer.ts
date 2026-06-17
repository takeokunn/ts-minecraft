import { Effect, Layer } from 'effect'
import { TerrainWorkerPoolPort, TerrainGenerationError } from '../application/terrain-worker-pool-port'
import { TerrainWorkerPool } from './terrain-worker-pool'

export const TerrainWorkerPoolPortLayer = Layer.effect(
  TerrainWorkerPoolPort,
  Effect.map(TerrainWorkerPool, (pool) => {
    return TerrainWorkerPoolPort.of({
      _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
      generateTerrain: (coord, options) =>
        pool.generateTerrain(coord, options).pipe(
          Effect.mapError((err) => new TerrainGenerationError({ reason: err.reason, chunk: err.chunk })),
        ),
    })
  })
).pipe(Layer.provide(TerrainWorkerPool.Default))
