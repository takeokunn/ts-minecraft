import { Effect, Option } from 'effect'
import { DEFAULT_PLAYER_ID, type Position } from '@ts-minecraft/core'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const CHORUS_FRUIT_FOOD_LEVEL = 4
export const CHORUS_FRUIT_SATURATION_MODIFIER = 0.3
export const CHORUS_FRUIT_TELEPORT_RADIUS = 8

const clampRoll = (roll: number): number => Math.min(1, Math.max(0, roll))

const randomOffset = (roll: number): number => (clampRoll(roll) * 2 - 1) * CHORUS_FRUIT_TELEPORT_RADIUS

export const resolveChorusFruitTeleportTarget = (
  position: Position,
  random: () => number = Math.random,
): Position => ({
  x: position.x + randomOffset(random()),
  y: position.y,
  z: position.z + randomOffset(random()),
})

export const handleChorusFruitUse = (
  services: Pick<
    FrameHandlerServices,
    'hotbarService' | 'inventoryService' | 'gameMode' | 'gameState' | 'hungerService'
  >,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    if (Option.getOrNull(selected) !== 'CHORUS_FRUIT') return false

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const isCreative = yield* services.gameMode.isCreative()

    if (!isCreative) {
      const consumed = yield* services.inventoryService
        .removeBlock('CHORUS_FRUIT', 1, selectedHotbarSlotIndex(selectedSlot))
        .pipe(
          Effect.as(true),
          Effect.catchAll(() => Effect.succeed(false)),
        )
      if (!consumed) return false
    }

    const playerPosition = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
    const teleportTarget = resolveChorusFruitTeleportTarget(playerPosition)
    yield* services.gameState.setPlayerPosition(teleportTarget)

    if (!isCreative) {
      yield* services.hungerService.eat(CHORUS_FRUIT_FOOD_LEVEL, CHORUS_FRUIT_SATURATION_MODIFIER)
    }

    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
