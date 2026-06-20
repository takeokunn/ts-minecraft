import type { Position } from '@ts-minecraft/core'
import type { StructureTemplate } from './village-creation-data'

export const buildAnchor = (center: Position, template: StructureTemplate): Position => ({
  x: center.x + template.offsetX,
  y: center.y + template.offsetY,
  z: center.z + template.offsetZ,
})

export const buildScopedId = (parentId: string, suffix: string): string => `${parentId}:${suffix}`
