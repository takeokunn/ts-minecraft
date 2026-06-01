import { Array as Arr, Effect, MutableRef, Option } from 'effect'
import type * as THREE from 'three'
import type { Position } from '@ts-minecraft/core'
import type { EntityManager } from '@ts-minecraft/entity'
import { EntityType } from '@ts-minecraft/entity'
import type { HotbarService } from '@ts-minecraft/inventory'
import { getNormalizedLookDirection } from '@ts-minecraft/app/main/qa-spatial'
import {
  PLAYER_ATTACK_DAMAGE,
  WOODEN_SWORD_ATTACK_DAMAGE,
} from '@ts-minecraft/app/frame-handler.config'

export const spawnLowHealthZombieInFront = (
  camera: THREE.PerspectiveCamera,
  entityManager: EntityManager,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const direction = getNormalizedLookDirection(camera)
    const zombiePos = {
      x: camera.position.x + direction.x * 6,
      y: camera.position.y,
      z: camera.position.z + direction.z * 6,
    }
    MutableRef.set(stagedZombiePositionRef, zombiePos)
    const zombieId = yield* entityManager.addEntity(EntityType.Zombie, zombiePos)
    yield* entityManager.applyDamage(zombieId, 12)
  }))

export const attackFirstZombie = (
  hotbarService: HotbarService,
  entityManager: EntityManager,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const entities = yield* entityManager.getEntities()
    const zombieOpt = Arr.findFirst(entities, (entity) => entity.type === 'Zombie')
    return yield* Option.match(zombieOpt, {
      onNone: () => Effect.succeed(false),
      onSome: (zombie) => Effect.gen(function* () {
        const selectedItem = yield* hotbarService.getSelectedBlockType()
        const damage = Option.match(selectedItem, {
          onNone: () => PLAYER_ATTACK_DAMAGE,
          onSome: (item) => item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE,
        })
        yield* entityManager.applyDamage(zombie.entityId, damage)
        return true
      }),
    })
  }))

export const getMobMovementSnapshot = (entityManager: EntityManager, durationMs: number) =>
  Effect.runPromise(Effect.gen(function* () {
    const clampedDurationMs = Math.max(100, Math.floor(durationMs))
    const before = yield* entityManager.getEntities()
    const beforeById = new Map(before.map((entity) => [entity.entityId, entity.position] as const))
    yield* Effect.sleep(clampedDurationMs)
    const after = yield* entityManager.getEntities()

    let tracked = 0
    let moved = 0
    let maxDistance = 0
    let maxHorizontalDistance = 0
    let maxVerticalDistance = 0
    for (const entity of after) {
      const previous = beforeById.get(entity.entityId)
      if (!previous) continue
      tracked += 1
      const dx = entity.position.x - previous.x
      const dy = entity.position.y - previous.y
      const dz = entity.position.z - previous.z
      const horizontalDistance = Math.hypot(dx, dz)
      const distance = Math.hypot(dx, dy, dz)
      const verticalDistance = Math.abs(dy)
      if (horizontalDistance > 0.05) moved += 1
      if (distance > maxDistance) maxDistance = distance
      if (horizontalDistance > maxHorizontalDistance) maxHorizontalDistance = horizontalDistance
      if (verticalDistance > maxVerticalDistance) maxVerticalDistance = verticalDistance
    }

    return { tracked, moved, maxDistance, maxHorizontalDistance, maxVerticalDistance }
  }))
