import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { DEFAULT_PLAYER_ID, type Position } from '@ts-minecraft/core'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { EXHAUSTION_DAMAGE } from '@ts-minecraft/entity/application/hunger-service.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const ENDER_PEARL_MAX_DISTANCE = 24
export const ENDER_PEARL_ENDERMITE_SPAWN_CHANCE = 0.05
export const ENDER_PEARL_DAMAGE = 5

const enderPearlDirection = new THREE.Vector3()

export const resolveEnderPearlTeleportTarget = (
  position: Position,
  direction: THREE.Vector3,
  targetHit: Option.Option<TargetRayHit>,
): Position => {
  const length = direction.length()
  const dx = length === 0 ? 0 : direction.x / length
  const dy = length === 0 ? 0 : direction.y / length
  const dz = length === 0 ? -1 : direction.z / length
  const hit = Option.getOrNull(targetHit)
  const distance = Math.max(0, Math.min(hit?.distance ?? ENDER_PEARL_MAX_DISTANCE, ENDER_PEARL_MAX_DISTANCE))

  return {
    x: position.x + dx * distance,
    y: position.y + dy * distance,
    z: position.z + dz * distance,
  }
}

export const shouldSpawnEndermiteFromEnderPearl = (roll: number): boolean =>
  roll >= 0 && roll < ENDER_PEARL_ENDERMITE_SPAWN_CHANCE

export const handleEnderPearlThrow = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    'hotbarService' | 'inventoryService' | 'gameMode' | 'gameState' | 'entityManager' | 'healthService' | 'hungerService'
  >,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const selected = yield* services.hotbarService.getSelectedBlockType()
    if (Option.getOrNull(selected) !== 'ENDER_PEARL') return false

    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const playerPosition = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
    const direction = deps.camera.getWorldDirection(enderPearlDirection)
    const teleportTarget = resolveEnderPearlTeleportTarget(playerPosition, direction, context.targetHit)
    const isCreative = yield* services.gameMode.isCreative()

    if (!isCreative) {
      const consumed = yield* services.inventoryService
        .removeBlock('ENDER_PEARL', 1, selectedHotbarSlotIndex(selectedSlot))
        .pipe(
          Effect.as(true),
          Effect.catchAll(() => Effect.succeed(false)),
        )
      if (!consumed) return false
    }

    yield* services.gameState.setPlayerPosition(teleportTarget)
    if (!isCreative) {
      yield* services.healthService.applyDamage(ENDER_PEARL_DAMAGE)
      yield* services.hungerService.addExhaustion(EXHAUSTION_DAMAGE)
    }
    if (shouldSpawnEndermiteFromEnderPearl(Math.random())) {
      yield* services.entityManager.addEntity(EntityType.Endermite, teleportTarget)
    }
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
