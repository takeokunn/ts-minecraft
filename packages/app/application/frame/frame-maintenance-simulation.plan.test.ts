import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { resolveMaintenanceSimulationPlan } from './frame-maintenance-simulation.plan'

describe('resolveMaintenanceSimulationPlan', () => {
  it('skips time-of-day lookup when mobs spawn and villages are disabled', () => {
    const plan = resolveMaintenanceSimulationPlan({
      mobsSpawnEnabled: false,
      furnaceEnabled: true,
      villageEnabled: false,
    })

    expect(plan).toEqual({
      shouldResolveTimeOfDay: false,
      shouldRunFurnace: true,
      shouldRunVillage: false,
    })
  })

  it('requests time-of-day when mob spawning is enabled', () => {
    const plan = resolveMaintenanceSimulationPlan({
      mobsSpawnEnabled: true,
      furnaceEnabled: false,
      villageEnabled: false,
    })

    expect(plan.shouldResolveTimeOfDay).toBe(true)
    expect(plan.shouldRunFurnace).toBe(false)
    expect(plan.shouldRunVillage).toBe(false)
  })

  it('requests time-of-day when village maintenance is enabled', () => {
    const plan = resolveMaintenanceSimulationPlan({
      mobsSpawnEnabled: false,
      furnaceEnabled: false,
      villageEnabled: true,
    })

    expect(plan.shouldResolveTimeOfDay).toBe(true)
    expect(plan.shouldRunFurnace).toBe(false)
    expect(plan.shouldRunVillage).toBe(true)
  })
})
