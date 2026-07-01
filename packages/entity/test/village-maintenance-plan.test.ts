import { describe, expect, it } from 'vitest'
import {
  collectNewVillages,
  resolveVillageMaintenancePlan,
} from '@ts-minecraft/entity/domain/village/village-maintenance-plan'
import type { Village } from '@ts-minecraft/entity/domain/village/village-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeVillage = (id: string): Village =>
  ({ villageId: id }) as unknown as Village

// ─── collectNewVillages ───────────────────────────────────────────────────────
describe('collectNewVillages', () => {
  it('returns all after-villages when before is empty', () => {
    const after = [makeVillage('v1'), makeVillage('v2')]
    const result = collectNewVillages([], after)
    expect(result).toHaveLength(2)
    expect(result).toBe(after)
  })

  it('returns an empty array when no new villages appeared', () => {
    const v1 = makeVillage('v1')
    const result = collectNewVillages([v1], [v1])
    expect(result).toHaveLength(0)
  })

  it('returns only villages that were not in the before list', () => {
    const before = [makeVillage('v1')]
    const after = [makeVillage('v1'), makeVillage('v2'), makeVillage('v3')]
    const result = collectNewVillages(before, after)
    expect(result).toHaveLength(2)
    const ids = (result as Village[]).map((v) => v.villageId as string)
    expect(ids).toContain('v2')
    expect(ids).toContain('v3')
  })

  it('returns an empty array when after is empty', () => {
    const result = collectNewVillages([makeVillage('v1')], [])
    expect(result).toHaveLength(0)
  })

  it('identifies new villages by villageId (not object identity)', () => {
    const before = [makeVillage('v1')]
    const differentRef = makeVillage('v1')
    const result = collectNewVillages(before, [differentRef])
    expect(result).toHaveLength(0)
  })

  it('returns all after-villages as new when none match the before ids', () => {
    const before = [makeVillage('old-1'), makeVillage('old-2')]
    const after = [makeVillage('new-1'), makeVillage('new-2')]
    const result = collectNewVillages(before, after)
    expect(result).toHaveLength(2)
  })
})

// ─── resolveVillageMaintenancePlan ────────────────────────────────────────────
describe('resolveVillageMaintenancePlan', () => {
  it('wraps collectNewVillages: plan.newVillages matches the delta', () => {
    const before = [makeVillage('v1')]
    const after = [makeVillage('v1'), makeVillage('v2')]
    const plan = resolveVillageMaintenancePlan({ villagesBefore: before, villagesAfter: after })
    expect(plan.newVillages).toHaveLength(1)
    const ids = (plan.newVillages as Village[]).map((v) => v.villageId as string)
    expect(ids).toContain('v2')
  })

  it('returns no new villages when before and after are identical', () => {
    const villages = [makeVillage('v1')]
    const plan = resolveVillageMaintenancePlan({ villagesBefore: villages, villagesAfter: villages })
    expect(plan.newVillages).toHaveLength(0)
  })

  it('returns all new villages on a fresh world with no pre-existing villages', () => {
    const after = [makeVillage('v1'), makeVillage('v2')]
    const plan = resolveVillageMaintenancePlan({ villagesBefore: [], villagesAfter: after })
    expect(plan.newVillages).toHaveLength(2)
  })
})
