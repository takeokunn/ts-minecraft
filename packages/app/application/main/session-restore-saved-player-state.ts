import { Effect } from 'effect'

import { EquipmentService, InventoryService } from '@ts-minecraft/inventory'
import { HealthService, HungerService, XPService } from '@ts-minecraft/entity'
import { CropGrowthService, type WorldMetadata } from '@ts-minecraft/world'

import { buildSessionRestorePlayerState } from './session-restore-player-state'

type SavedPlayerState = NonNullable<WorldMetadata['playerState']>

export type RestoreSavedPlayerStateDeps = {
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly cropGrowthService: CropGrowthService
}

export const restoreSavedPlayerState = (
  savedPlayerState: SavedPlayerState,
  services: RestoreSavedPlayerStateDeps,
): Effect.Effect<void, never> => {
  const { inventoryService, equipmentService, healthService, hungerService, xpService, cropGrowthService } = services
  const restored = buildSessionRestorePlayerState(savedPlayerState)

  return Effect.gen(function* () {
    yield* inventoryService.deserialize(restored.inventory)
    yield* healthService.reset()
    const resetHealth = yield* healthService.getHealth()
    const damageToApply = Math.max(0, resetHealth.current - restored.health)
    if (damageToApply > 0) {
      yield* healthService.applyDamage(damageToApply)
    }
    yield* hungerService.restore(restored.hunger.foodLevel, restored.hunger.saturation)
    yield* xpService.setTotalXP(restored.totalXP)
    yield* equipmentService.deserialize(restored.equipment)
    if (restored.cropAges != null) {
      yield* cropGrowthService.restore(restored.cropAges)
    }
  })
}
