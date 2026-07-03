import { Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type PistonFacing, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { detonateTnt } from '@ts-minecraft/app/frame/stages/interaction-flint-steel-handler'

export type RedstoneDispenserWorldServices = Pick<
  FrameHandlerServices,
  | 'redstoneService' | 'chestService' | 'droppedItemService' | 'entityManager'
  | 'blockService' | 'soundManager' | 'multiplayer' | 'gameMode' | 'gameState'
  | 'healthService' | 'hungerService' | 'equipmentService'
>

const EJECT_DIRECTIONS: Readonly<Record<PistonFacing, { readonly x: number; readonly y: number; readonly z: number }>> = {
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  south: { x: 0, y: 0, z: 1 },
  north: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
}

const EJECT_SPEED = 0.15
// Fired-arrow hitscan: vanilla dispenser arrows deal ~3 hearts.
const DISPENSED_ARROW_DAMAGE = 5
const DISPENSED_ARROW_RANGE = 8
const DISPENSED_ARROW_RADIUS = 0.9
const ENTITY_CENTER_Y_OFFSET = 0.9

const dispenserKey = (position: Position): string =>
  `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`

// Powered state each dispenser had on the previous tick — rising-edge
// detection. Module scratch like the observer's watch map: stale entries are
// swept when their dispensers disappear.
const lastPowered = new Map<string, boolean>()

// Exposed for tests.
export const resetDispenserState = (): void => {
  lastPowered.clear()
}

// Vanilla dispensers eject from their own 9-slot inventory; this model draws
// ONE item from a CHEST directly above on each power rising edge and spawns
// it as a drop in front of the muzzle (facing direction). No chest above or
// an empty chest → the edge is consumed with no effect.
export const applyDispenserWorldEffects = (
  services: RedstoneDispenserWorldServices,
  components: ReadonlyArray<RedstoneComponent>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const liveKeys = new Set<string>()

    for (const component of components) {
      if (component.type !== RedstoneComponentType.Dispenser) continue
      const key = dispenserKey(component.position)
      liveKeys.add(key)

      const power = yield* services.redstoneService.getPowerAt(component.position)
      const powered = power > 0
      const wasPowered = lastPowered.get(key) ?? false
      lastPowered.set(key, powered)
      if (!powered || wasPowered) continue

      const base = {
        x: Math.floor(component.position.x),
        y: Math.floor(component.position.y),
        z: Math.floor(component.position.z),
      }
      const taken = yield* services.chestService.withdrawOneFromChestAt({ x: base.x, y: base.y + 1, z: base.z })
      const itemType = Option.getOrNull(taken)
      if (itemType === null) continue

      const direction = EJECT_DIRECTIONS[component.state.pistonFacing ?? 'east']

      // TNT detonates at the muzzle cell (vanilla dispensers prime TNT; this
      // model's TNT is instant everywhere, so the dispenser matches).
      if (itemType === 'TNT') {
        yield* detonateTnt(services, {
          x: base.x + direction.x,
          y: base.y + direction.y,
          z: base.z + direction.z,
        })
        continue
      }

      // ARROWs fire as projectiles: hitscan along the facing axis hits the
      // nearest entity within range; a miss falls to the ground as a
      // pick-up-able arrow (vanilla behavior).
      if (itemType === 'ARROW') {
        const origin = {
          x: base.x + 0.5 + direction.x,
          y: base.y + 0.5 + direction.y,
          z: base.z + 0.5 + direction.z,
        }
        const entities = yield* services.entityManager.getEntities()
        let nearestId: (typeof entities)[number]['entityId'] | null = null
        let nearestAlong = Number.POSITIVE_INFINITY
        for (const entity of entities) {
          const ex = entity.position.x - origin.x
          const ey = entity.position.y + ENTITY_CENTER_Y_OFFSET - origin.y
          const ez = entity.position.z - origin.z
          const alongRay = ex * direction.x + ey * direction.y + ez * direction.z
          if (alongRay < 0 || alongRay > DISPENSED_ARROW_RANGE) continue
          const perpendicularSq = ex * ex + ey * ey + ez * ez - alongRay * alongRay
          if (perpendicularSq > DISPENSED_ARROW_RADIUS * DISPENSED_ARROW_RADIUS) continue
          if (alongRay < nearestAlong) {
            nearestAlong = alongRay
            nearestId = entity.entityId
          }
        }
        if (nearestId !== null) {
          yield* services.entityManager.applyDamage(nearestId, DISPENSED_ARROW_DAMAGE).pipe(Effect.asVoid)
          continue
        }
      }

      yield* services.droppedItemService.spawn({
        itemType,
        count: 1,
        position: {
          x: base.x + 0.5 + direction.x,
          y: base.y + 0.5 + direction.y,
          z: base.z + 0.5 + direction.z,
        },
        velocity: {
          x: direction.x * EJECT_SPEED,
          y: direction.y * EJECT_SPEED + 0.05,
          z: direction.z * EJECT_SPEED,
        },
      }).pipe(Effect.asVoid)
    }

    for (const key of lastPowered.keys()) {
      if (!liveKeys.has(key)) lastPowered.delete(key)
    }
  })
