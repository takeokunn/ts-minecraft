import { Effect } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { FrameInventoryServices } from '@ts-minecraft/app/frame/frame-service-types'

type FurnaceMaintenanceServices = Pick<FrameInventoryServices, 'furnaceService'>

export const runFurnaceMaintenance = (
  services: FurnaceMaintenanceServices,
  maintenanceDeltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  services.furnaceService.tick(maintenanceDeltaTime).pipe(Effect.catchAllCause(() => Effect.void))
