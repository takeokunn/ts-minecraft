import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { PRESSURE_PLATE_COLLISION_HEIGHT } from '@ts-minecraft/game'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH } from '@ts-minecraft/entity/domain/mob/spawner-config'
import type { DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

// Pressure-plate activation: whether the player / a mob / a dropped item
// overlaps a plate's cell (with the vanilla-ish vertical reach), and the frame
// pass that pushes those pressed/released signals into the redstone graph.
// Split out of entity-update-stage.ts as a self-contained detection concern.

const PRESSURE_PLATE_PLAYER_VERTICAL_REACH = 1.75
const DROPPED_ITEM_PRESSURE_PLATE_HALF_WIDTH = 0.125
const DROPPED_ITEM_PRESSURE_PLATE_HALF_HEIGHT = 0.125

export const isPlayerPressingPressurePlate = (playerPos: Position, platePos: Position): boolean => {
  const overlapsHorizontally =
    playerPos.x >= platePos.x &&
    playerPos.x < platePos.x + 1 &&
    playerPos.z >= platePos.z &&
    playerPos.z < platePos.z + 1
  const verticalOffset = playerPos.y - platePos.y
  return overlapsHorizontally && verticalOffset >= 0 && verticalOffset <= PRESSURE_PLATE_PLAYER_VERTICAL_REACH
}

export const isEntityPressingPressurePlate = (entity: Pick<Entity, 'position'>, platePos: Position): boolean => {
  const pos = entity.position
  const overlapsHorizontally =
    pos.x + MOB_HALF_WIDTH > platePos.x &&
    pos.x - MOB_HALF_WIDTH < platePos.x + 1 &&
    pos.z + MOB_HALF_WIDTH > platePos.z &&
    pos.z - MOB_HALF_WIDTH < platePos.z + 1
  const entityBottom = pos.y - MOB_HALF_HEIGHT
  const entityTop = pos.y + MOB_HALF_HEIGHT
  return overlapsHorizontally && entityBottom <= platePos.y + PRESSURE_PLATE_COLLISION_HEIGHT && entityTop >= platePos.y
}

export const isDroppedItemPressingPressurePlate = (
  item: Pick<DroppedItemEntity, 'position'>,
  platePos: Position,
): boolean => {
  const pos = item.position
  const overlapsHorizontally =
    pos.x + DROPPED_ITEM_PRESSURE_PLATE_HALF_WIDTH > platePos.x &&
    pos.x - DROPPED_ITEM_PRESSURE_PLATE_HALF_WIDTH < platePos.x + 1 &&
    pos.z + DROPPED_ITEM_PRESSURE_PLATE_HALF_WIDTH > platePos.z &&
    pos.z - DROPPED_ITEM_PRESSURE_PLATE_HALF_WIDTH < platePos.z + 1
  const itemBottom = pos.y - DROPPED_ITEM_PRESSURE_PLATE_HALF_HEIGHT
  const itemTop = pos.y + DROPPED_ITEM_PRESSURE_PLATE_HALF_HEIGHT
  return overlapsHorizontally && itemBottom <= platePos.y + PRESSURE_PLATE_COLLISION_HEIGHT && itemTop >= platePos.y
}

const isAnyEntityPressingPressurePlate = (entities: ReadonlyArray<Pick<Entity, 'position'>>, platePos: Position): boolean => {
  for (const entity of entities) {
    if (isEntityPressingPressurePlate(entity, platePos)) return true
  }
  return false
}

const isAnyDroppedItemPressingPressurePlate = (
  droppedItems: ReadonlyArray<Pick<DroppedItemEntity, 'position'>>,
  platePos: Position,
): boolean => {
  for (const item of droppedItems) {
    if (isDroppedItemPressingPressurePlate(item, platePos)) return true
  }
  return false
}

export const updatePressurePlateStates = (
  redstoneService: Pick<FrameHandlerServices['redstoneService'], 'getComponents' | 'setPressurePlatePressed'>,
  playerPos: Position,
  entities: ReadonlyArray<Pick<Entity, 'position'>> = [],
  droppedItems: ReadonlyArray<Pick<DroppedItemEntity, 'position'>> = [],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const components = yield* redstoneService.getComponents()
    for (const component of components) {
      if (component.type !== RedstoneComponentType.PressurePlate) continue
      yield* redstoneService.setPressurePlatePressed(
        component.position,
        isPlayerPressingPressurePlate(playerPos, component.position) ||
          isAnyEntityPressingPressurePlate(entities, component.position) ||
          isAnyDroppedItemPressingPressurePlate(droppedItems, component.position),
      )
    }
  })
