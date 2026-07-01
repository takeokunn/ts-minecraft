import { describe, expect, it } from 'vitest'
import { createVillage } from '@ts-minecraft/entity/domain/village/village-creation'
import { STRUCTURE_TEMPLATES, VILLAGER_TEMPLATES } from '@ts-minecraft/entity/domain/village/village-creation-data'
import { VillagerActivity } from '@ts-minecraft/entity/domain/village/village-model'

// ─── createVillage ────────────────────────────────────────────────────────────

const CENTER = { x: 100, y: 64, z: 200 }

describe('createVillage', () => {
  const village = createVillage(1, CENTER)

  it('creates a village with the correct villageId', () => {
    expect(String(village.villageId)).toBe('village-1')
  })

  it('uses the provided center position', () => {
    expect(village.center).toEqual(CENTER)
  })

  it('creates structures matching STRUCTURE_TEMPLATES count', () => {
    expect(village.structures).toHaveLength(STRUCTURE_TEMPLATES.length)
  })

  it('creates villagers matching VILLAGER_TEMPLATES count', () => {
    expect(village.villagers).toHaveLength(VILLAGER_TEMPLATES.length)
  })

  it('all villagers start with Idle activity', () => {
    for (const villager of village.villagers) {
      expect(villager.activity).toBe(VillagerActivity.Idle)
    }
  })

  it('all villagers belong to this village', () => {
    for (const villager of village.villagers) {
      expect(String(villager.villageId)).toBe(String(village.villageId))
    }
  })

  it('structure IDs are scoped to the village', () => {
    for (const structure of village.structures) {
      expect(String(structure.structureId)).toContain(String(village.villageId))
    }
  })

  it('assigns unique structureIds', () => {
    const ids = village.structures.map(s => String(s.structureId))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('assigns unique villagerIds', () => {
    const ids = village.villagers.map(v => String(v.villagerId))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('next village number produces a different ID', () => {
    const second = createVillage(2, CENTER)
    expect(String(second.villageId)).toBe('village-2')
    expect(String(second.villageId)).not.toBe(String(village.villageId))
  })
})
