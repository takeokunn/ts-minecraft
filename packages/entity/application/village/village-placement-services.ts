import {
  type BlockService,
  type ChunkManagerService,
} from '@ts-minecraft/world'

export type VillagePlacementServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getChunk'>
}
