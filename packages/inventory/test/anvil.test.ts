import { describe, expect, it } from 'vitest'
import { ANVIL_REPAIR_MAX_COST_LEVELS, anvilRepairCostLevels } from '../domain/anvil'

describe('anvil repair cost', () => {
  it('is 0 for a full-durability item (no-op)', () => {
    expect(anvilRepairCostLevels(250, 250)).toBe(0)
  })

  it('is at least 1 for any damage and scales with the missing fraction', () => {
    expect(anvilRepairCostLevels(249, 250)).toBe(1)
    expect(anvilRepairCostLevels(125, 250)).toBe(3)
    expect(anvilRepairCostLevels(0, 250)).toBe(ANVIL_REPAIR_MAX_COST_LEVELS)
  })

  it('never exceeds the max cost and tolerates degenerate inputs', () => {
    expect(anvilRepairCostLevels(-10, 250)).toBe(ANVIL_REPAIR_MAX_COST_LEVELS)
    expect(anvilRepairCostLevels(0, 0)).toBe(0)
  })
})
