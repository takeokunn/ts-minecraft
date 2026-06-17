import { Layer } from 'effect'

import { ChunkMeshService } from '@ts-minecraft/rendering'
import { ParticleSystemService } from '@ts-minecraft/rendering'

export const ParticleSystemLayer = ParticleSystemService.Default.pipe(
  Layer.provide(ChunkMeshService.Default),
)
