import type { Position } from '@ts-minecraft/kernel'

export type StructureTemplate = {
  readonly suffix: string
  readonly type: 'well' | 'road' | 'house' | 'farm'
  readonly offsetX: number
  readonly offsetY: number
  readonly offsetZ: number
  readonly sizeX: number
  readonly sizeY: number
  readonly sizeZ: number
}

export type VillagerTemplate = {
  readonly suffix: string
  readonly profession: 'Farmer' | 'Librarian' | 'Blacksmith'
  readonly homeStructureSuffix: string
  readonly workplaceStructureSuffix: string
}

export const STRUCTURE_TEMPLATES: ReadonlyArray<StructureTemplate> = [
  { suffix: 'well', type: 'well', offsetX: 0, offsetY: 0, offsetZ: 0, sizeX: 3, sizeY: 4, sizeZ: 3 },
  { suffix: 'road-main', type: 'road', offsetX: -12, offsetY: 0, offsetZ: 0, sizeX: 24, sizeY: 1, sizeZ: 3 },
  { suffix: 'house-a', type: 'house', offsetX: -8, offsetY: 0, offsetZ: -8, sizeX: 6, sizeY: 5, sizeZ: 6 },
  { suffix: 'house-b', type: 'house', offsetX: 2, offsetY: 0, offsetZ: -8, sizeX: 6, sizeY: 5, sizeZ: 6 },
  { suffix: 'house-c', type: 'house', offsetX: 8, offsetY: 0, offsetZ: 2, sizeX: 6, sizeY: 5, sizeZ: 6 },
  { suffix: 'farm', type: 'farm', offsetX: -10, offsetY: 0, offsetZ: 6, sizeX: 8, sizeY: 1, sizeZ: 8 },
]

export const VILLAGER_TEMPLATES: ReadonlyArray<VillagerTemplate> = [
  {
    suffix: 'villager-farmer',
    profession: 'Farmer',
    homeStructureSuffix: 'house-a',
    workplaceStructureSuffix: 'farm',
  },
  {
    suffix: 'villager-librarian',
    profession: 'Librarian',
    homeStructureSuffix: 'house-b',
    workplaceStructureSuffix: 'well',
  },
  {
    suffix: 'villager-blacksmith',
    profession: 'Blacksmith',
    homeStructureSuffix: 'house-c',
    workplaceStructureSuffix: 'road-main',
  },
]

export const buildAnchor = (center: Position, template: StructureTemplate): Position => ({
  x: center.x + template.offsetX,
  y: center.y + template.offsetY,
  z: center.z + template.offsetZ,
})

export const buildScopedId = (parentId: string, suffix: string): string => `${parentId}:${suffix}`
