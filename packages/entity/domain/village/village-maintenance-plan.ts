import type { Village } from './village-model'

export type VillageMaintenancePlanInput = {
  readonly villagesBefore: ReadonlyArray<Village>
  readonly villagesAfter: ReadonlyArray<Village>
}

export type VillageMaintenancePlan = {
  readonly newVillages: ReadonlyArray<Village>
}

export const collectNewVillages = (
  villagesBefore: ReadonlyArray<Village>,
  villagesAfter: ReadonlyArray<Village>,
): ReadonlyArray<Village> => {
  if (villagesBefore.length === 0) return villagesAfter

  const beforeIds = new Set<string>()
  for (const village of villagesBefore) beforeIds.add(village.villageId)

  return villagesAfter.filter((village) => !beforeIds.has(village.villageId))
}

export const resolveVillageMaintenancePlan = (
  input: VillageMaintenancePlanInput,
): VillageMaintenancePlan => ({
  newVillages: collectNewVillages(input.villagesBefore, input.villagesAfter),
})
