import { Effect } from 'effect'
import { type BlockService } from '@ts-minecraft/world'
import {
  type VillageBlockPlacement,
  type VillagePlacementServiceBlockType,
  type VillagePlacementServicePosition,
} from './village-placement-foundation-types'

export const writeVillageBlock = (
  blockService: Pick<BlockService, 'forceSetBlock'>,
  position: VillagePlacementServicePosition,
  blockType: VillagePlacementServiceBlockType,
): Effect.Effect<void, never> =>
  blockService.forceSetBlock(position, blockType).pipe(
    Effect.catchAll(() => Effect.void),
  )

export const writeVillagePlacements = (
  blockService: Pick<BlockService, 'forceSetBlock'>,
  placements: ReadonlyArray<VillageBlockPlacement>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    for (const { position, blockType } of placements) {
      yield* writeVillageBlock(blockService, position, blockType)
    }
  })
