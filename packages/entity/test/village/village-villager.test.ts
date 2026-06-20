import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { VillageId, VillagerId } from '@ts-minecraft/entity/domain/village/village-model';
import { awardVillagerExperience } from '@ts-minecraft/entity/domain/village/village-villager-experience';
import { findVillagerById } from '@ts-minecraft/entity/domain/village/village-villager-search';
import { expectSome } from '../test-utils'
import { makeTestVillage, makeTestVillager } from './test-utils'

describe('village/village-villager', () => {
  describe('findVillagerById', () => {
    it('returns Option.some for a matching villager id', () => {
      const target = makeTestVillager({
        villageId: VillageId.make('test-village-a'),
        villagerId: VillagerId.make('test-village-a:villager-farmer'),
      })
      const villages = [makeTestVillage({ villageId: target.villageId, villagers: [target] })]

      const result = findVillagerById(villages, target.villagerId)

      expectSome(result)
      expect(expectSome(result)).toBe(target)
    })

    it('returns Option.none for a missing villager id', () => {
      const villages = [makeTestVillage()]
      const missingId = VillagerId.make('test-village-missing:villager-farmer')

      const result = findVillagerById(villages, missingId)

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('awardVillagerExperience', () => {
    it('returns Option.none and preserves the input array when amount is zero or negative', () => {
      const target = makeTestVillager({
        villageId: VillageId.make('test-village-a'),
        villagerId: VillagerId.make('test-village-a:villager-farmer'),
      })
      const villages = [makeTestVillage({ villageId: target.villageId, villagers: [target] })]

      const zeroResult = awardVillagerExperience(villages, target.villagerId, 0)
      const negativeResult = awardVillagerExperience(villages, target.villagerId, -1)

      expect(Option.isNone(zeroResult[0])).toBe(true)
      expect(zeroResult[1]).toBe(villages)
      expect(Option.isNone(negativeResult[0])).toBe(true)
      expect(negativeResult[1]).toBe(villages)
    })

    it('updates experience and level for a matching villager', () => {
      const target = makeTestVillager({
        villageId: VillageId.make('test-village-a'),
        villagerId: VillagerId.make('test-village-a:villager-farmer'),
        experience: 0,
        level: 1,
      })
      const villages = [makeTestVillage({ villageId: target.villageId, villagers: [target] })]

      const [updatedVillager, updatedVillages] = awardVillagerExperience(villages, target.villagerId, 6)

      expectSome(updatedVillager)
      expect(expectSome(updatedVillager).experience).toBe(6)
      expect(expectSome(updatedVillager).level).toBe(2)
      expect(updatedVillages).not.toBe(villages)
      expect(updatedVillages[0]).not.toBe(villages[0])
      expect(updatedVillages[0].villagers[0]).toBe(expectSome(updatedVillager))
    })

    it('preserves unrelated village references when only one villager changes', () => {
      const targetVillageId = VillageId.make('test-village-a')
      const otherVillageId = VillageId.make('test-village-b')
      const targetVillager = makeTestVillager({
        villageId: targetVillageId,
        villagerId: VillagerId.make('test-village-a:villager-farmer'),
      })
      const otherVillager = makeTestVillager({
        villageId: otherVillageId,
        villagerId: VillagerId.make('test-village-b:villager-farmer'),
      })
      const targetVillage = makeTestVillage({ villageId: targetVillageId, villagers: [targetVillager] })
      const otherVillage = makeTestVillage({ villageId: otherVillageId, villagers: [otherVillager] })
      const villages = [targetVillage, otherVillage]

      const [, updatedVillages] = awardVillagerExperience(villages, targetVillager.villagerId, 1)

      expect(updatedVillages[0]).not.toBe(targetVillage)
      expect(updatedVillages[1]).toBe(otherVillage)
      expect(updatedVillages[1].villagers[0]).toBe(otherVillager)
    })

    it('returns Option.none and preserves the input array when the villager is missing', () => {
      const villages = [makeTestVillage()]
      const missingId = VillagerId.make('test-village-missing:villager-farmer')

      const [updatedVillager, updatedVillages] = awardVillagerExperience(villages, missingId, 5)

      expect(Option.isNone(updatedVillager)).toBe(true)
      expect(updatedVillages).toBe(villages)
    })
  })
})
