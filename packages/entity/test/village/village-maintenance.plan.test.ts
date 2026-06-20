import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { VillageId } from '@ts-minecraft/entity/domain/village/village-model'
import { collectNewVillages, resolveVillageMaintenancePlan } from '../../domain/village/village-maintenance-plan'
import { makeTestVillage } from './test-utils'

const makeVillageWithId = (id: string) => makeTestVillage({
  villageId: VillageId.make(id),
  structures: [],
  villagers: [],
})

describe('village/village-maintenance.plan', () => {
  it('keeps only newly created village ids', () => {
    const villagesBefore = [makeVillageWithId('village-a'), makeVillageWithId('village-b')]
    const villagesAfter = [
      makeVillageWithId('village-a'),
      makeVillageWithId('village-b'),
      makeVillageWithId('village-c'),
    ]

    expect(collectNewVillages(villagesBefore, villagesAfter)).toEqual([makeVillageWithId('village-c')])
  })

  it('returns the full after snapshot when there was no previous village list', () => {
    const villagesAfter = [makeVillageWithId('village-a'), makeVillageWithId('village-b')]

    expect(collectNewVillages([], villagesAfter)).toEqual(villagesAfter)
  })

  it('resolves the placement plan from before and after snapshots', () => {
    const villagesBefore = [makeVillageWithId('village-a')]
    const villagesAfter = [makeVillageWithId('village-a'), makeVillageWithId('village-b')]

    expect(resolveVillageMaintenancePlan({ villagesBefore, villagesAfter })).toEqual({
      newVillages: [makeVillageWithId('village-b')],
    })
  })
})
