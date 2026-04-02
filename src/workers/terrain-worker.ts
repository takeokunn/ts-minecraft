import { Schema } from 'effect'
import { generateTerrainBlocks } from '@/domain/terrain/terrain-generation'
import {
  TerrainWorkerRequestSchema,
  type TerrainWorkerRequest,
} from '@/infrastructure/terrain/terrain-worker-protocol'
import { sampleTerrainNoise } from '@/infrastructure/terrain/terrain-noise'

self.onmessage = (e: MessageEvent<TerrainWorkerRequest>): void => {
  const {
    id,
    seed,
    chunkX,
    chunkZ,
    seaLevel,
    lakeLevel,
  } = Schema.decodeUnknownSync(TerrainWorkerRequestSchema)(e.data)

  const samples = sampleTerrainNoise({ x: chunkX, z: chunkZ }, seed)

  const blocks = generateTerrainBlocks(
    { x: chunkX, z: chunkZ },
    samples,
    { seaLevel, lakeLevel },
  )

  self.postMessage(
    { id, blocks },
    [blocks.buffer as ArrayBuffer],
  )
}
