import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { handleBucket } from '@ts-minecraft/app/frame/stages/interaction-bucket-handler/bucket-handler'
import { handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'
import { handleFeedAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/feed-animal'
import { handleEnderPearlThrow } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/ender-pearl'
import { handleFoodConsumption } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/food-consumption'
import { handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/shear-animal'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'
import { handleFlintAndSteel } from '@ts-minecraft/app/frame/stages/interaction-flint-steel-handler'
import type { BlockServiceError } from '@ts-minecraft/world/application/block-service-error'
import type { ChunkManagerError } from '@ts-minecraft/world/application/chunk-manager-constants'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

export type RightClickPriorityHandlers = {
  readonly shearAnimal: () => Effect.Effect<boolean, never>
  readonly feedAnimal: () => Effect.Effect<boolean, never>
  readonly consumeFood: () => Effect.Effect<boolean, never>
  readonly enderPearl: () => Effect.Effect<boolean, never>
  readonly farm: () => Effect.Effect<boolean, never>
  readonly bucket: () => Effect.Effect<boolean, never>
  readonly ignite: () => Effect.Effect<boolean, never>
  readonly place: () => Effect.Effect<void, ChunkManagerError | BlockServiceError, never>
}

type RightClickPriorityContext = {
  readonly snapshot: InteractionStageSnapshot
  readonly targetHit: Option.Option<TargetRayHit>
}

export const handleRightClickPriority = (
  handlers: RightClickPriorityHandlers,
): Effect.Effect<void, ChunkManagerError | BlockServiceError, never> =>
  Effect.gen(function* () {
    if (yield* handlers.shearAnimal()) return
    if (yield* handlers.feedAnimal()) return
    if (yield* handlers.consumeFood()) return
    if (yield* handlers.enderPearl()) return
    if (yield* handlers.farm()) return
    if (yield* handlers.bucket()) return
    if (yield* handlers.ignite()) return

    yield* handlers.place()
  })

export const handleRightClickPriorityFromContext = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'hotbarService'
    | 'chestService'
    | 'furnaceService'
    | 'timeService'
    | 'netherService'
    | 'inventoryService'
    | 'inventoryRenderer'
    | 'xpService'
    | 'multiplayer'
    | 'entityManager'
    | 'equipmentService'
    | 'fishingService'
    | 'hungerService'
    | 'healthService'
    | 'gameState'
    | 'cropGrowthService'
    | 'fluidService'
    | 'gameMode'
    | 'redstoneService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: RightClickPriorityContext,
): Effect.Effect<void, ChunkManagerError | BlockServiceError, never> =>
  Effect.gen(function* () {
    if (yield* handleShearAnimal(deps, services)) return
    if (yield* handleFeedAnimal(deps, services)) return
    if (yield* handleFoodConsumption(services)) return
    if (yield* handleEnderPearlThrow(deps, services, { targetHit: context.targetHit })) return
    if (yield* handleFarmingInteraction(services, refs, { targetHit: context.targetHit })) return
    if (yield* handleBucket(services, refs, { targetHit: context.targetHit })) return

    const selectedHotbarItem = Option.getOrNull(context.snapshot.selectedHotbarItem)
    if (selectedHotbarItem === 'FLINT_AND_STEEL') {
      if (yield* handleFlintAndSteel(services, refs, { targetHit: context.targetHit })) return
    }

    yield* handleRightClick(services, refs, {
      targetHit: context.targetHit,
      respawnPositionRef: deps.respawnPositionRef,
    })
  })
