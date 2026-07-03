import { Effect } from 'effect'
import { type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { resolveVillageMaintenancePlan } from '../../domain/village/village-maintenance-plan'
import { type Village } from '../../domain/village/village-model'
import { type VillageMaintenanceServices } from './village-maintenance-services'
import { placeVillagePlan, updateVillageState } from './village-maintenance-ops'

// A village's mob population counts as "its" villagers when standing within
// this radius of the village center (structures span ~30 blocks).
const VILLAGER_HOME_RADIUS_SQ = 48 * 48

// Materialize domain villagers as Villager mob entities. Idempotent per pass:
// spawns only the difference between the domain roster and the Villager
// entities already standing near the village center (they are despawn-exempt,
// so the count converges and stays).
export const syncVillagerEntities = (
  entityManager: VillageMaintenanceServices['entityManager'],
  villages: ReadonlyArray<Village>,
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    if (villages.length === 0) return 0
    const entities = yield* entityManager.getEntities()
    let spawned = 0
    for (const village of villages) {
      const present = entities.filter((entity) => {
        if (entity.type !== 'Villager') return false
        const dx = entity.position.x - village.center.x
        const dz = entity.position.z - village.center.z
        return dx * dx + dz * dz <= VILLAGER_HOME_RADIUS_SQ
      }).length
      const missing = village.villagers.length - present
      for (let i = 0; i < missing; i++) {
        const home = village.villagers[i]!
        yield* entityManager.addEntity('Villager', {
          x: home.position.x,
          y: home.position.y + 0.9,
          z: home.position.z,
        })
        spawned++
      }
    }
    return spawned
  })

export const runVillageMaintenance = (
  services: VillageMaintenanceServices,
  playerPos: Position,
  timeOfDay: number,
  maintenanceDeltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const villagesBefore = yield* services.villageService.getVillages()

    yield* updateVillageState(services, playerPos, timeOfDay, maintenanceDeltaTime)

    const villagesAfter = yield* services.villageService.getVillages()
    const plan = resolveVillageMaintenancePlan({
      villagesBefore,
      villagesAfter,
    })

    yield* placeVillagePlan(services, plan.newVillages)
    yield* syncVillagerEntities(services.entityManager, villagesAfter)
  })
