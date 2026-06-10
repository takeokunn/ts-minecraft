import { Effect, HashMap, Option, Ref } from 'effect'
import { CROP_MAX_AGE, advanceCropAge } from '../domain/crop-growth'
import type { Position } from '@ts-minecraft/core'

const cropKey = (pos: Position): string =>
  `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`

export class CropGrowthService extends Effect.Service<CropGrowthService>()(
  '@minecraft/application/CropGrowthService',
  {
    effect: Effect.gen(function* () {
      const ageMapRef = yield* Ref.make(HashMap.empty<string, number>())

      return {
        // Register a freshly-planted crop at age 0 (seedling stage).
        plant: (pos: Position): Effect.Effect<void, never> =>
          Ref.update(ageMapRef, (m) => HashMap.set(m, cropKey(pos), 0)),

        // Harvest a crop: returns true if ripe (also true for untracked positions —
        // world-generated / village crops are assumed mature). Removes from tracking.
        harvest: (pos: Position): Effect.Effect<boolean, never> =>
          Ref.modify(ageMapRef, (m) => {
            const key = cropKey(pos)
            const age = Option.getOrElse(HashMap.get(m, key), () => CROP_MAX_AGE)
            return [age >= CROP_MAX_AGE, HashMap.remove(m, key)] as [boolean, HashMap.HashMap<string, number>]
          }),

        // Advance all tracked crops by one growth stage. Called every CROP_GROWTH_INTERVAL_SECS
        // from frame-maintenance. Ripe crops clamp at CROP_MAX_AGE (no-op after maturity).
        tickAll: (): Effect.Effect<void, never> =>
          Ref.update(ageMapRef, (m) => HashMap.map(m, advanceCropAge)),
      }
    }),
  }
) {}

export const CropGrowthServiceLive = CropGrowthService.Default
