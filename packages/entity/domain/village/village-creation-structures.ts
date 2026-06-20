import type { Position } from '@ts-minecraft/core'

import { VillageStructureId, type Village, type VillageStructure } from './village-model'
import { STRUCTURE_TEMPLATES } from './village-creation-data'
import { buildAnchor, buildScopedId } from './village-creation-data.helpers'

export const buildVillageStructures = (
  villageId: Village['villageId'],
  center: Position,
): ReadonlyArray<VillageStructure> => {
  const structureId = (suffix: string): VillageStructureId => VillageStructureId.make(buildScopedId(villageId, suffix))

  const structures = Array.from({ length: STRUCTURE_TEMPLATES.length }) as Array<VillageStructure>
  for (let i = 0; i < STRUCTURE_TEMPLATES.length; i++) {
    const template = STRUCTURE_TEMPLATES[i]!
    structures[i] = {
      structureId: structureId(template.suffix),
      type: template.type,
      anchor: buildAnchor(center, template),
      size: { x: template.sizeX, y: template.sizeY, z: template.sizeZ },
    }
  }

  return structures
}
