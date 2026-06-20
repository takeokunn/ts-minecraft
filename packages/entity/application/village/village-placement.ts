import { Effect } from 'effect'
import { buildingBlocksForVillage } from '../../domain/village/village-builder-placements'
import { type Village } from '../../domain/village/village-model'
import { buildVillageFoundationPlacements, groundVillageStructures } from './village-placement-plan'
import { makeVillageSurfaceResolver } from './village-placement-surface'
import { type VillagePlacementBlockReadError } from './village-placement-surface-error'
import { type VillagePlacementServices } from './village-placement-services'
import { writeVillagePlacements } from './village-placement-write'

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
