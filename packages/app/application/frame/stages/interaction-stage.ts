// Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
// Decomposed into 4 helpers to keep the orchestrator at low cyclomatic complexity:
//   - handleHotbarInput   — keyboard 1-9 / wheel slot selection + HUD update
//   - handleRedstoneInput — 8-way Match dispatch on redstone key flags
//   - handleLeftClick     — entity attack / block break / particle burst
//   - handleRightClick    — furnace select / block place
import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import {
  REDSTONE_PLACE_WIRE_KEY,
  REDSTONE_PLACE_LEVER_KEY,
  REDSTONE_PLACE_BUTTON_KEY,
  REDSTONE_PLACE_TORCH_KEY,
  REDSTONE_PLACE_PISTON_KEY,
  REDSTONE_TOGGLE_LEVER_KEY,
  REDSTONE_PRESS_BUTTON_KEY,
  REDSTONE_TOGGLE_TORCH_KEY,
  UNEQUIP_ARMOR_KEY,
} from '@ts-minecraft/app/frame-handler.config'
import { handleHotbarInput, renderHotbarHud } from '@ts-minecraft/app/frame/stages/interaction-hotbar-handler'
import { handleRedstoneInput, type RedstoneFlags } from '@ts-minecraft/app/frame/stages/interaction-redstone-handler'
import { handleLeftClick, handleRightClick, handleFoodConsumption, handleUnequipArmor, handleFeedAnimal, handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-block-handler'
import { handleFlintAndSteel, handleBucket } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'

export const interactionStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'scene' | 'gamePausedRef' | 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'debugFeatureFlags'
    | 'blockHighlight'
    | 'hotbarService'
    | 'hotbarRenderer'
    | 'inputService'
    | 'blockService'
    | 'chunkManagerService'
    | 'fluidService'
    | 'cropGrowthService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'equipmentService'
    | 'xpService'
    | 'fishingService'
    | 'redstoneService'
    | 'furnaceService'
    | 'netherService'
    | 'particleSystem'
    | 'hungerService'
    | 'gameState'
    | 'timeService'
    | 'multiplayer'
    | 'gameMode'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()

    // Keep block targeting live for interactions while allowing the outline itself
    // to be toggled independently.
    yield* services.blockHighlight.update(deps.camera, deps.scene)
    yield* services.blockHighlight.setVisible(debugFlags['ui.blockHighlight'])

    // Handle block interaction (break/place) and hotbar (suppressed when paused)
    yield* logErrors(
      Effect.gen(function* () {
        const paused = yield* Ref.get(deps.gamePausedRef)
        if (paused) return

        yield* handleHotbarInput(services)

        const leftClick = yield* services.inputService.consumeMouseClick(0)
        const rightClick = yield* services.inputService.consumeMouseClick(2)
        const [
          placeWire,
          placeLever,
          placeButton,
          placeTorch,
          placePiston,
          toggleLever,
          pressButton,
          toggleTorch,
        ] = yield* Effect.all(
          [
            services.inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY),
          ],
          // Sequential: consumeKeyPress is a synchronous edge read; unbounded
          // concurrency spawns 8 fibers every frame for no gain (and sequential
          // is deterministic for the edge-consume order).
        )
        const flags: RedstoneFlags = {
          placeWire,
          placeLever,
          placeButton,
          placeTorch,
          placePiston,
          toggleLever,
          pressButton,
          toggleTorch,
        }

        // Consumed via a SEPARATE statement so the positional redstone tuple
        // above stays untouched. Independent of the click/redstone branch below.
        const unequipArmor = yield* services.inputService.consumeKeyPress(UNEQUIP_ARMOR_KEY)
        if (unequipArmor) {
          yield* handleUnequipArmor(services)
        }

        const hasRedstoneInput =
          placeWire || placeLever || placeButton || placeTorch || placePiston || toggleLever || pressButton || toggleTorch

        // Spectator cannot interact with the world (no break / place / attack / redstone).
        const isSpectator = yield* services.gameMode.isSpectator()
        if (!isSpectator && (leftClick || rightClick || hasRedstoneInput)) {
          const targetBlock = yield* services.blockHighlight.getTargetBlock()
          const targetHit = yield* services.blockHighlight.getTargetHit()
          const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType()

          if (hasRedstoneInput) {
            yield* handleRedstoneInput(services, flags, targetBlock)
          }

          if (leftClick) {
            yield* handleLeftClick(deps, services, refs, { targetBlock, targetHit, selectedHotbarItem })
          }

          if (rightClick) {
            // Shearing a sheep with SHEARS (R11) takes top priority — then feeding a
            // breedable animal (R6c-3) so e.g. right-clicking a pig with a CARROT feeds
            // it rather than eating the carrot. Then eating; farming (hoe + seeds);
            // portal ignition; bed sleep; default block placement.
            const sheared = yield* handleShearAnimal(deps, services)
            const fed = sheared ? false : yield* handleFeedAnimal(deps, services)
            const ate = sheared || fed ? false : yield* handleFoodConsumption(services)
            if (!sheared && !fed && !ate) {
              const farmed = yield* handleFarmingInteraction(services, refs, { targetHit })
              if (!farmed) {
                // R26: bucket fill/empty before generic placement (held-item action like ignition).
                const bucketed = yield* handleBucket(services, refs, { targetHit })
                if (!bucketed) {
                  const ignited = selectedHotbarItem._tag === 'Some' && selectedHotbarItem.value === 'FLINT_AND_STEEL'
                    ? yield* handleFlintAndSteel(services, refs, { targetHit })
                    : false
                  if (!ignited) {
                    yield* handleRightClick(services, refs, { targetHit, respawnPositionRef: deps.respawnPositionRef })
                  }
                }
              }
            }
          }
        }

        // Update hotbar renderer with current slot state (first pass; second pass in hudStage)
        if (debugFlags['ui.hotbar']) {
          yield* renderHotbarHud(services)
        }
      }),
      'Block interaction error',
    )
  })
