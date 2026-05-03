import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  VillageId,
  VillageStructureId,
  VillagerId,
  VillageStructureTypeSchema,
  VillagerProfessionSchema,
  VillagerActivitySchema,
  VillagerProfession,
  VillagerActivity,
  villagerLevelFromExperience,
} from '@ts-minecraft/entities'

describe('village/village-model', () => {
  describe('villagerLevelFromExperience', () => {
    it.each([
      [0, 1],
      [1, 1],
      [5, 1],
    ] as const)('experience %i → level 1', (experience: number, expected: number) => {
      expect(villagerLevelFromExperience(experience)).toBe(expected)
    })

    it.each([
      [6, 2],
      [10, 2],
      [13, 2],
    ] as const)('experience %i → level 2', (experience: number, expected: number) => {
      expect(villagerLevelFromExperience(experience)).toBe(expected)
    })

    it.each([
      [14, 3],
      [20, 3],
      [27, 3],
    ] as const)('experience %i → level 3', (experience: number, expected: number) => {
      expect(villagerLevelFromExperience(experience)).toBe(expected)
    })

    it.each([
      [28, 4],
      [30, 4],
    ] as const)('experience %i → level 4', (experience: number, expected: number) => {
      expect(villagerLevelFromExperience(experience)).toBe(expected)
    })
  })

  describe('VillageStructureTypeSchema', () => {
    const decode = Schema.decodeUnknownSync(VillageStructureTypeSchema)

    it.each(['house', 'road', 'well', 'farm'] as const)('accepts literal "%s"', (value: string) => {
      expect(decode(value)).toBe(value)
    })

    it('rejects unknown string', () => {
      expect(() => decode('tower')).toThrow()
    })
  })

  describe('VillagerProfessionSchema', () => {
    const decode = Schema.decodeUnknownSync(VillagerProfessionSchema)

    it.each(['Farmer', 'Librarian', 'Blacksmith'] as const)('accepts literal "%s"', (value: string) => {
      expect(decode(value)).toBe(value)
    })

    it('rejects unknown string', () => {
      expect(() => decode('Miner')).toThrow()
    })
  })

  describe('VillagerActivitySchema', () => {
    const decode = Schema.decodeUnknownSync(VillagerActivitySchema)

    it.each(['Idle', 'Wander', 'Work', 'Rest', 'Trade'] as const)('accepts literal "%s"', (value: string) => {
      expect(decode(value)).toBe(value)
    })

    it('rejects unknown string', () => {
      expect(() => decode('Sleep')).toThrow()
    })
  })

  describe('branded type make()', () => {
    it('VillageId.make returns the string value', () => {
      expect(VillageId.make('village-1')).toBe('village-1')
    })

    it('VillageStructureId.make returns the string value', () => {
      expect(VillageStructureId.make('struct-42')).toBe('struct-42')
    })

    it('VillagerId.make returns the string value', () => {
      expect(VillagerId.make('villager-7')).toBe('villager-7')
    })
  })

  describe('VillagerProfession const object', () => {
    it('Farmer value is "Farmer"', () => {
      expect(VillagerProfession.Farmer).toBe('Farmer')
    })

    it('Librarian value is "Librarian"', () => {
      expect(VillagerProfession.Librarian).toBe('Librarian')
    })

    it('Blacksmith value is "Blacksmith"', () => {
      expect(VillagerProfession.Blacksmith).toBe('Blacksmith')
    })
  })

  describe('VillagerActivity const object', () => {
    it('Idle value is "Idle"', () => {
      expect(VillagerActivity.Idle).toBe('Idle')
    })

    it('Wander value is "Wander"', () => {
      expect(VillagerActivity.Wander).toBe('Wander')
    })

    it('Work value is "Work"', () => {
      expect(VillagerActivity.Work).toBe('Work')
    })

    it('Rest value is "Rest"', () => {
      expect(VillagerActivity.Rest).toBe('Rest')
    })

    it('Trade value is "Trade"', () => {
      expect(VillagerActivity.Trade).toBe('Trade')
    })
  })
})
