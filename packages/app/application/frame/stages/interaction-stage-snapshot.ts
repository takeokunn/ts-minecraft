import { Effect, MutableRef, Option, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
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

import {
  createActiveInteractionStageSnapshot,
  createPausedInteractionStageSnapshot,
  createInteractionStageRedstoneFlags,
} from './interaction-stage-snapshot-helpers'
import type { RedstoneFlags } from './interaction-redstone-handler'

export type InteractionStageSnapshot = {
  readonly paused: boolean
  readonly leftClick: boolean
  readonly mouseHeld: boolean
  readonly middleClick: boolean
  readonly rightClick: boolean
  readonly rightMouseHeld: boolean
  readonly redstoneFlags: RedstoneFlags
  readonly unequipArmor: boolean
  readonly isSpectator: boolean
  readonly isCreative: boolean
  readonly selectedHotbarItem: Option.Option<InventoryItem>
  readonly breakProgressElementOrNull: HTMLElement | null
  readonly bowChargeStart: number | null
  readonly totalTimeSecs: number
}

export const readInteractionStageSnapshot = (
  deps: Pick<FrameHandlerDeps, 'breakProgressElement' | 'gamePausedRef' | 'camera'>,
  services: Pick<
    FrameHandlerServices,
    'inputService' | 'gameMode' | 'hotbarService'
  >,
  refs: Pick<FrameStageRefs, 'bowChargeStartRef' | 'totalTimeSecsRef'>,
): Effect.Effect<InteractionStageSnapshot, never> =>
  Effect.gen(function* () {
    const paused = yield* Ref.get(deps.gamePausedRef)
    if (paused) {
      return createPausedInteractionStageSnapshot({
        totalTimeSecs: MutableRef.get(refs.totalTimeSecsRef),
      })
    }

    const leftClick = yield* services.inputService.consumeMouseClick(0)
    const mouseHeld = yield* services.inputService.isMouseDown(0)
    const middleClick = yield* services.inputService.consumeMouseClick(1)
    const rightClick = yield* services.inputService.consumeMouseClick(2)
    const rightMouseHeld = yield* services.inputService.isMouseDown(2)
    const placeWire = yield* services.inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY)
    const placeLever = yield* services.inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY)
    const placeButton = yield* services.inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY)
    const placeTorch = yield* services.inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY)
    const placePiston = yield* services.inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY)
    const toggleLever = yield* services.inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY)
    const pressButton = yield* services.inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY)
    const toggleTorch = yield* services.inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY)
    const unequipArmor = yield* services.inputService.consumeKeyPress(UNEQUIP_ARMOR_KEY)
    const isSpectator = yield* services.gameMode.isSpectator()
    const isCreative = yield* services.gameMode.isCreative()
    const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType()

    return createActiveInteractionStageSnapshot({
      leftClick,
      mouseHeld,
      middleClick,
      rightClick,
      rightMouseHeld,
      redstoneFlags: createInteractionStageRedstoneFlags({
        placeWire,
        placeLever,
        placeButton,
        placeTorch,
        placePiston,
        toggleLever,
        pressButton,
        toggleTorch,
      }),
      unequipArmor,
      isSpectator,
      isCreative,
      selectedHotbarItem,
      breakProgressElementOrNull: Option.getOrNull(deps.breakProgressElement),
      bowChargeStart: MutableRef.get(refs.bowChargeStartRef),
      totalTimeSecs: MutableRef.get(refs.totalTimeSecsRef),
    })
  })
