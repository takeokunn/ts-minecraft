import { Effect, MutableRef } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { CROP_GROWTH_INTERVAL_SECS } from '../domain/crop-growth'
import { collectGrassSpreadTargets } from '../domain/grass-spread'
import type { BlockService } from './block-service'
import type { ChunkManagerService } from './chunk-manager-service'
import type { CropGrowthService } from './crop-growth-service'

type CropGrowthMaintenanceState = {
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
}

type CropGrowthMaintenanceServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getLoadedChunks'>
  readonly cropGrowthService: Pick<CropGrowthService, 'tickAll'>
}

export const runCropGrowthMaintenance = (
  services: CropGrowthMaintenanceServices,
  state: CropGrowthMaintenanceState,
  maintenanceDeltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const newCropAcc = MutableRef.get(state.cropTickAccumulatorRef) + Number(maintenanceDeltaTime)
    if (newCropAcc < CROP_GROWTH_INTERVAL_SECS) {
      MutableRef.set(state.cropTickAccumulatorRef, newCropAcc)
      return
    }

    MutableRef.set(state.cropTickAccumulatorRef, newCropAcc - CROP_GROWTH_INTERVAL_SECS)
    yield* services.cropGrowthService.tickAll().pipe(Effect.catchAllCause(() => Effect.void))

    const grassSpreadTargets = yield* services.chunkManagerService.getLoadedChunks().pipe(
      Effect.flatMap((chunks) => collectGrassSpreadTargets(chunks)),
      Effect.catchAllCause(() => Effect.succeed([])),
    )

    for (const target of grassSpreadTargets) {
      yield* services.blockService.forceSetBlock(target, 'GRASS').pipe(Effect.catchAllCause(() => Effect.void))
    }
  })
