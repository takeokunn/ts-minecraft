import { Effect, MutableRef } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import { CROP_GROWTH_INTERVAL_SECS } from '../domain/crop-growth'
import { collectGrassSpreadTargets } from '../domain/grass-spread'
import { collectIceMeltTargets } from '../domain/ice-melting'
import { collectPlantGrowthTargets } from '../domain/plant-growth'
import { collectSnowAccumulationTargets } from '../domain/snow-accumulation'
import type { BiomeService } from './biome-service'
import type { BlockService } from './block-service'
import type { ChunkManagerService } from './chunk-manager-service'
import type { CropGrowthService } from './crop-growth-service'

type MaintenanceWeather = 'clear' | 'rain' | 'thunder'

type CropGrowthMaintenanceState = {
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
}

type CropGrowthMaintenanceServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getLoadedChunks'>
  readonly cropGrowthService: Pick<CropGrowthService, 'tickAll'>
  readonly biomeService?: Pick<BiomeService, 'getBiome'>
  readonly getWeather?: () => Effect.Effect<MaintenanceWeather, never>
}

const hasSnowAccumulationWeather = (weather: MaintenanceWeather): boolean =>
  weather === 'rain' || weather === 'thunder'

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

    const loadedChunks = yield* services.chunkManagerService
      .getLoadedChunks()
      .pipe(Effect.catchAllCause(() => Effect.succeed([])))

    const grassSpreadTargets = yield* collectGrassSpreadTargets(loadedChunks).pipe(Effect.catchAllCause(() => Effect.succeed([])))
    const plantGrowthTargets = yield* collectPlantGrowthTargets(loadedChunks).pipe(Effect.catchAllCause(() => Effect.succeed([])))
    const iceMeltTargets = yield* collectIceMeltTargets(loadedChunks).pipe(Effect.catchAllCause(() => Effect.succeed([])))
    let snowAccumulationTargets: ReadonlyArray<Position> = []
    if (services.biomeService && services.getWeather) {
      const weather = yield* services.getWeather().pipe(Effect.catchAllCause(() => Effect.succeed('clear' as const)))
      if (hasSnowAccumulationWeather(weather)) {
        snowAccumulationTargets = yield* collectSnowAccumulationTargets(loadedChunks, services.biomeService).pipe(
          Effect.catchAllCause(() => Effect.succeed([])),
        )
      }
    }

    for (const target of grassSpreadTargets) {
      yield* services.blockService.forceSetBlock(target, 'GRASS').pipe(Effect.catchAllCause(() => Effect.void))
    }

    for (const target of plantGrowthTargets) {
      yield* services.blockService.forceSetBlock(target.position, target.blockType).pipe(Effect.catchAllCause(() => Effect.void))
    }

    for (const target of iceMeltTargets) {
      yield* services.blockService.forceSetBlock(target, 'WATER').pipe(Effect.catchAllCause(() => Effect.void))
    }

    for (const target of snowAccumulationTargets) {
      yield* services.blockService.forceSetBlock(target, 'SNOW').pipe(Effect.catchAllCause(() => Effect.void))
    }
  })
