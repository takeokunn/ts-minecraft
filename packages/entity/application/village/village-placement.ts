import { Effect } from 'effect'
import {
  type BlockService,
  type ChunkManagerService,
} from '@ts-minecraft/world'
import { buildingBlocksForVillage, type Village } from '../../domain/village'
import { buildVillageFoundationPlacements, groundVillageStructures } from './village-placement-plan'
import { makeVillageSurfaceResolver, type VillagePlacementBlockReadError } from './village-placement-surface'
import { writeVillagePlacements } from './village-placement-write'

export type VillagePlacementServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getChunk'>
}

export const placeVillageStructures = (
  village: Village,
  services: VillagePlacementServices,
): Effect.Effect<void, VillagePlacementBlockReadError> =>
  Effect.gen(function* () {
    const surfaceAt = makeVillageSurfaceResolver(services.chunkManagerService)
    const groundedStructures = yield* groundVillageStructures(village, surfaceAt)
    const foundationPlacements = yield* buildVillageFoundationPlacements(groundedStructures, surfaceAt)
    yield* writeVillagePlacements(services.blockService, foundationPlacements)
    yield* writeVillagePlacements(services.blockService, buildingBlocksForVillage(groundedStructures))
  })
