import { Effect } from 'effect'
import type { VillageService } from '@ts-minecraft/entity/application/village/village-service'

// Villages are seed-deterministic and sparse (a ~40% roll per 384-block region),
// so verifying them from the browser meant wandering blindly. This exposes the
// live village/villager state directly: village centers + structure counts, and
// each villager's profession, level, activity, and position — enough to confirm
// generation, population, and AI activity in one call once the player is within
// a site's activation radius.
export type QaVillageState = {
  readonly villageCount: number
  readonly villagerCount: number
  readonly villages: ReadonlyArray<{
    readonly villageId: string
    readonly center: { x: number; y: number; z: number }
    readonly structureCount: number
    readonly villagerCount: number
  }>
  readonly villagers: ReadonlyArray<{
    readonly villagerId: string
    readonly profession: string
    readonly level: number
    readonly activity: string
    readonly position: { x: number; y: number; z: number }
  }>
}

export const getVillagesForQA = (villageService: VillageService): Promise<QaVillageState> =>
  Effect.runPromise(Effect.gen(function* () {
    const villages = yield* villageService.getVillages()
    const villagers = yield* villageService.getVillagers()
    return {
      villageCount: villages.length,
      villagerCount: villagers.length,
      villages: villages.map((v) => ({
        villageId: String(v.villageId),
        center: { x: v.center.x, y: v.center.y, z: v.center.z },
        structureCount: v.structures.length,
        villagerCount: v.villagers.length,
      })),
      villagers: villagers.map((vr) => ({
        villagerId: String(vr.villagerId),
        profession: vr.profession,
        level: vr.level,
        activity: vr.activity,
        position: { x: vr.position.x, y: vr.position.y, z: vr.position.z },
      })),
    }
  }))
