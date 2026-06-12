// Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
// Decomposed into 4 helpers to keep the orchestrator at low cyclomatic complexity:
//   - handleHotbarInput        — keyboard 1-9 / wheel slot selection + HUD update
//   - handleRedstoneInput      — 8-way Match dispatch on redstone key flags
//   - handleLeftClick          — entity attack (edge-trigger; hold-to-break is separate)
//   - handleBlockBreakProgress — hold-to-break: per-frame timed block mining
//   - handleRightClick         — furnace select / block place
import { Effect, MutableRef, Option, Ref } from 'effect'
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
import { handleBlockBreakProgress } from '@ts-minecraft/app/frame/stages/interaction-break-handler'
import { handleLeftClick } from '@ts-minecraft/app/frame/stages/interaction-melee-handler'
import { handleBowFire } from '@ts-minecraft/app/frame/stages/interaction-bow-handler'
import { handleRightClick, handleFlintAndSteel, handleBucket } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'
import { handleFoodConsumption, handleUnequipArmor, handleFeedAnimal, handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'

export const interactionStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'scene' | 'gamePausedRef' | 'respawnPositionRef' | 'breakProgressElement'>,
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
    | 'healthService'
    | 'gameState'
    | 'timeService'
    | 'multiplayer'
    | 'gameMode'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef' | 'breakProgressRef' | 'bowChargeStartRef' | 'isShieldBlockingRef'>,
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
        const mouseHeld = yield* services.inputService.isMouseDown(0)
        const rightClick = yield* services.inputService.consumeMouseClick(2)
        const rightMouseHeld = yield* services.inputService.isMouseDown(2)
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
        const breakProgressElementOrNull = Option.getOrNull(deps.breakProgressElement)

        // Reset break progress when mouse is released (mouseHeld=false) so the bar
        // clears immediately even if the spectator or no-target branch runs.
        if (!mouseHeld) MutableRef.set(refs.breakProgressRef, null)
        // Clear shield blocking whenever right mouse is released or player is spectator
        // (before the input gate, so it takes effect even when no other input fires).
        if (!rightMouseHeld || isSpectator) MutableRef.set(refs.isShieldBlockingRef, false)

        // Bow release: fire on the frame right-mouse transitions from held → released.
        // Runs before the input-gated block because on the release frame no other input
        // is necessarily active.
        const bowChargeStart = MutableRef.get(refs.bowChargeStartRef)
        if (!isSpectator && !rightMouseHeld && bowChargeStart !== null) {
          const now = yield* Ref.get(refs.totalTimeSecsRef)
          const entities = yield* services.entityManager.getEntities()
          yield* handleBowFire(deps, services, entities, { chargeStartSecs: bowChargeStart, nowSecs: now })
          MutableRef.set(refs.bowChargeStartRef, null)
        }

        if (!isSpectator && (leftClick || mouseHeld || rightClick || rightMouseHeld || hasRedstoneInput)) {
          const targetBlock = yield* services.blockHighlight.getTargetBlock()
          const targetHit = yield* services.blockHighlight.getTargetHit()
          const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType()

          if (hasRedstoneInput) {
            // Build the redstone flag object only when redstone input actually fired
            // (rare). Keeping it off the common path avoids allocating this object on
            // every frame that has no redstone keypress (the overwhelming majority).
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
            yield* handleRedstoneInput(services, flags, targetBlock)
          }

          if (leftClick) {
            yield* handleLeftClick(deps, services, refs, { targetBlock, targetHit, selectedHotbarItem })
          }

          if (mouseHeld) {
            // Determine whether an entity is in attack range — entity attack takes priority over block mining.
            const entities = yield* services.entityManager.getEntities()
            const targetEntityPresent = Option.isSome(
              findAttackableEntity(entities, deps.camera, Option.map(targetHit, (h) => h.distance))
            )
            yield* handleBlockBreakProgress(services, refs, {
              targetBlock,
              selectedHotbarItem,
              targetEntityPresent,
              breakProgressElementOrNull,
            })
          }

          // Shield blocking: right-mouse-hold with SHIELD equipped → blocking state.
          // The blocking MutableRef is read by physics-stage to reduce incoming damage.
          const selectedIsShield = Option.exists(selectedHotbarItem, (s) => s === 'SHIELD')
          MutableRef.set(refs.isShieldBlockingRef, rightMouseHeld && selectedIsShield)

          // Bow charging: right-mouse-hold with BOW equipped starts/continues the draw.
          // Suppress normal right-click placement while drawing the bow.
          const selectedIsBow = Option.exists(selectedHotbarItem, (s) => s === 'BOW')
          if (rightMouseHeld && selectedIsBow) {
            // Start charge on the first frame the button is held (bowChargeStart is null).
            if (bowChargeStart === null) {
              const now = yield* Ref.get(refs.totalTimeSecsRef)
              MutableRef.set(refs.bowChargeStartRef, now)
            }
          } else if (!rightMouseHeld && !selectedIsBow) {
            // Player switched away from BOW while holding right-mouse — clear stale charge.
            MutableRef.set(refs.bowChargeStartRef, null)
          }

          if (rightClick && !selectedIsBow) {
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
                  const ignited = Option.exists(selectedHotbarItem, (s) => s === 'FLINT_AND_STEEL')
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
