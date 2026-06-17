import type { InventoryItem } from '@ts-minecraft/core'
import type { WorldMetadata } from '@ts-minecraft/world'

type SessionSavePlayerStateInput = {
  readonly position: NonNullable<WorldMetadata['playerState']>['position']
  readonly health: NonNullable<WorldMetadata['playerState']>['health']
  readonly inventory: NonNullable<WorldMetadata['playerState']>['inventory']
  readonly timeOfDay: NonNullable<WorldMetadata['playerState']>['timeOfDay']
  readonly hunger: NonNullable<WorldMetadata['playerState']>['hunger']
  readonly totalXP: NonNullable<WorldMetadata['playerState']>['totalXP']
  readonly equipment: {
    readonly HELMET: InventoryItem | null
    readonly CHESTPLATE: InventoryItem | null
    readonly LEGGINGS: InventoryItem | null
    readonly BOOTS: InventoryItem | null
  }
  readonly respawnPosition: NonNullable<WorldMetadata['playerState']>['respawnPosition']
  readonly cropAges: NonNullable<WorldMetadata['playerState']>['cropAges']
}

const buildSerializedEquipment = (equipment: SessionSavePlayerStateInput['equipment']): NonNullable<WorldMetadata['playerState']>['equipment'] => ({
  ...(equipment.HELMET !== null ? { HELMET: equipment.HELMET } : {}),
  ...(equipment.CHESTPLATE !== null ? { CHESTPLATE: equipment.CHESTPLATE } : {}),
  ...(equipment.LEGGINGS !== null ? { LEGGINGS: equipment.LEGGINGS } : {}),
  ...(equipment.BOOTS !== null ? { BOOTS: equipment.BOOTS } : {}),
})

export const buildSessionSavePlayerState = (
  input: SessionSavePlayerStateInput,
): NonNullable<WorldMetadata['playerState']> => {
  const { position, health, inventory, timeOfDay, hunger, totalXP, equipment, respawnPosition, cropAges } = input
  return {
    position,
    health,
    inventory,
    timeOfDay,
    hunger,
    totalXP,
    equipment: buildSerializedEquipment(equipment),
    respawnPosition,
    cropAges,
  }
}
