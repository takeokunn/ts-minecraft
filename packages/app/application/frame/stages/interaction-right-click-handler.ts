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
import { handleBoatMount } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/boat-mount'
import { handleMinecartMount } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/minecart-mount'
import { handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/shear-animal'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'
import { handleFlintAndSteel } from '@ts-minecraft/app/frame/stages/interaction-flint-steel-handler'
import { handleEnderEyeUse } from '@ts-minecraft/app/frame/stages/interaction-ender-eye-handler'
import type { BlockServiceError } from '@ts-minecraft/world/application/block-service-error'
import type { ChunkManagerError } from '@ts-minecraft/world/application/chunk-manager-constants'
import type { InteractionStageSnapshot } from '@ts-minecraft/app/frame/stages/interaction-stage-snapshot'

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
    | 'inventoryRenderer' | 'sleepOverlay'
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
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly snapshot: InteractionStageSnapshot; readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<void, ChunkManagerError | BlockServiceError, never> =>
  Effect.gen(function* () {
    if (yield* handleShearAnimal(deps, services)) return
    if (yield* handleFeedAnimal(deps, services)) return
    if (yield* handleFarmingInteraction(services, refs, { targetHit: context.targetHit })) return
    if (yield* handleFoodConsumption(services)) return
    if (yield* handleBoatMount(services)) return
    if (yield* handleMinecartMount(services)) return
    if (yield* handleEnderPearlThrow(deps, services, { targetHit: context.targetHit })) return
    if (yield* handleBucket(services, refs, { targetHit: context.targetHit })) return

    const selectedHotbarItem = Option.getOrNull(context.snapshot.selectedHotbarItem)
    if (selectedHotbarItem === 'FLINT_AND_STEEL') {
      if (yield* handleFlintAndSteel(services, refs, { targetHit: context.targetHit })) return
    }
    if (selectedHotbarItem === 'ENDER_EYE') {
      const eyeHandled = yield* handleEnderEyeUse(services, refs, {
        targetHit: context.targetHit,
        playerPosition: deps.camera.position,
      })
      if (eyeHandled) return
    }

    yield* handleRightClick(services, refs, {
      targetHit: context.targetHit,
      respawnPositionRef: deps.respawnPositionRef,
    })
  })
