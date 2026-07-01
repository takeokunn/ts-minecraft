import { describe, expect, it } from 'vitest'
import { buildVillageStructures } from '@ts-minecraft/entity/domain/village/village-creation-structures'
import { STRUCTURE_TEMPLATES } from '@ts-minecraft/entity/domain/village/village-creation-data'
import { VillageId } from '@ts-minecraft/entity/domain/village/village-model'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const VILLAGE_ID = VillageId.make('village-1')
const CENTER = { x: 100, y: 64, z: 200 }

const structures = buildVillageStructures(VILLAGE_ID, CENTER)

// ─── buildVillageStructures ───────────────────────────────────────────────────

describe('buildVillageStructures — count', () => {
  it('creates one structure per STRUCTURE_TEMPLATES entry', () => {
    expect(structures).toHaveLength(STRUCTURE_TEMPLATES.length)
  })
})

describe('buildVillageStructures — IDs', () => {
  it('scopes every structureId to the villageId', () => {
    for (const structure of structures) {
      expect(String(structure.structureId)).toContain(String(VILLAGE_ID))
    }
  })

  it('assigns unique structureIds', () => {
    const ids = structures.map(s => String(s.structureId))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('embeds the template suffix in the structureId', () => {
    for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
      const template = STRUCTURE_TEMPLATES[i]!
      expect(String(structures[i]!.structureId)).toContain(template.suffix)
    }
  })
})

describe('buildVillageStructures — anchor positions', () => {
  it('places each structure relative to the center + template offsets', () => {
    for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
      const template = STRUCTURE_TEMPLATES[i]!
      const anchor = structures[i]!.anchor
      expect(anchor.x).toBe(CENTER.x + template.offsetX)
      expect(anchor.y).toBe(CENTER.y + template.offsetY)
      expect(anchor.z).toBe(CENTER.z + template.offsetZ)
    }
  })
})

describe('buildVillageStructures — sizes', () => {
  it('copies size directly from each template', () => {
    for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
      const template = STRUCTURE_TEMPLATES[i]!
      const size = structures[i]!.size
      expect(size.x).toBe(template.sizeX)
      expect(size.y).toBe(template.sizeY)
      expect(size.z).toBe(template.sizeZ)
    }
  })
})

describe('buildVillageStructures — types', () => {
  it('assigns the structure type from the template', () => {
    for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
      const template = STRUCTURE_TEMPLATES[i]!
      expect(structures[i]!.type).toBe(template.type)
    }
  })
})
