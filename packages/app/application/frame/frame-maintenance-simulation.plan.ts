export type MaintenanceSimulationPlanInput = {
  readonly mobsSpawnEnabled: boolean
  readonly furnaceEnabled: boolean
  readonly villageEnabled: boolean
}

export type MaintenanceSimulationPlan = {
  readonly shouldResolveTimeOfDay: boolean
  readonly shouldRunFurnace: boolean
  readonly shouldRunVillage: boolean
}

export const resolveMaintenanceSimulationPlan = (
  input: MaintenanceSimulationPlanInput,
): MaintenanceSimulationPlan => ({
  shouldResolveTimeOfDay: input.mobsSpawnEnabled || input.villageEnabled,
  shouldRunFurnace: input.furnaceEnabled,
  shouldRunVillage: input.villageEnabled,
})
