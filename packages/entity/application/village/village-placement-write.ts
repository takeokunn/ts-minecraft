import { Effect } from 'effect'
import { type BlockService } from '@ts-minecraft/world'
import { type VillageBlockPlacement } from './village-placement-plan'

type VillageBlockPosition = Parameters<BlockService['forceSetBlock']>[0]
type VillageBlockType = Parameters<BlockService['forceSetBlock']>[1]

export const writeVillageBlock = (
  blockService: Pick<BlockService, 'forceSetBlock'>,
  position: VillageBlockPosition,
  blockType: VillageBlockType,
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
