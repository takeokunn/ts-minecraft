import { type EquipmentService } from '@ts-minecraft/inventory'
import { type WorldMetadata } from '@ts-minecraft/world'

type SavedPlayerState = NonNullable<WorldMetadata['playerState']>
type RestoreEquipmentState = Parameters<EquipmentService['deserialize']>[0]

export type SessionRestorePlayerStateInput = Pick<SavedPlayerState, 'inventory' | 'health'> & {
  readonly hunger: SavedPlayerState['hunger']
  readonly totalXP: number
  readonly equipment?: SavedPlayerState['equipment'] | null
  readonly cropAges?: SavedPlayerState['cropAges'] | null
}

export type SessionRestorePlayerState = {
  readonly inventory: SavedPlayerState['inventory']
  readonly health: number
  readonly hunger: SavedPlayerState['hunger']
  readonly totalXP: number
  readonly equipment: RestoreEquipmentState
  readonly cropAges: SavedPlayerState['cropAges'] | null
}

export const buildSessionRestorePlayerState = (
  input: SessionRestorePlayerStateInput,
): SessionRestorePlayerState => ({
  inventory: input.inventory,
  health: input.health,
  hunger: input.hunger,
  totalXP: input.totalXP,
  equipment: {
    HELMET: input.equipment?.HELMET ?? null,
    CHESTPLATE: input.equipment?.CHESTPLATE ?? null,
    LEGGINGS: input.equipment?.LEGGINGS ?? null,
    BOOTS: input.equipment?.BOOTS ?? null,
  },
  cropAges: input.cropAges ?? null,
})
