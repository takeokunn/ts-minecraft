import { Effect } from 'effect'
import { type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { resolveVillageMaintenancePlan } from '../../domain/village/village-maintenance-plan'
import { type VillageMaintenanceServices } from './village-maintenance-services'
import { placeVillagePlan, updateVillageState } from './village-maintenance-ops'

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
  })
