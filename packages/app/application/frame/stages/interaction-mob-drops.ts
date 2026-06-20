import { Effect } from 'effect'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { EntityDrop } from '@ts-minecraft/entity/domain/mob/drop'
import type { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import type { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service'

type MobDropServices = {
  readonly droppedItemService: DroppedItemService
}

type MobXpOrbServices = {
  readonly droppedXpOrbService: DroppedXpOrbService
}

export const spawnMobDrop = (
  services: MobDropServices,
  entity: Pick<Entity, 'position'>,
  drop: EntityDrop,
  count = drop.count,
) =>
  count > 0
    ? services.droppedItemService.spawn({
        itemType: drop.blockType,
        count,
        position: {
          x: entity.position.x,
          y: entity.position.y + 0.5,
          z: entity.position.z,
        },
        velocity: { x: 0, y: 0.14, z: 0 },
      }).pipe(Effect.catchAllCause(() => Effect.void))
    : Effect.void

export const spawnMobXpOrb = (
  services: MobXpOrbServices,
  entity: Pick<Entity, 'position'>,
  amount: number,
) =>
  amount > 0
    ? services.droppedXpOrbService.spawn({
        amount,
        position: {
          x: entity.position.x,
          y: entity.position.y + 0.5,
          z: entity.position.z,
        },
      }).pipe(Effect.asVoid, Effect.catchAllCause(() => Effect.void))
    : Effect.void
