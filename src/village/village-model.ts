import { Schema } from 'effect'
import { PositionSchema } from '@/shared/kernel'

export const VillageIdSchema = Schema.String.pipe(Schema.brand('VillageId'))
export type VillageId = Schema.Schema.Type<typeof VillageIdSchema>
export const VillageId = {
  make: (value: string): VillageId => value as unknown as VillageId,
}

export const VillageStructureIdSchema = Schema.String.pipe(Schema.brand('VillageStructureId'))
export type VillageStructureId = Schema.Schema.Type<typeof VillageStructureIdSchema>
export const VillageStructureId = {
  make: (value: string): VillageStructureId => value as unknown as VillageStructureId,
}

export const VillagerIdSchema = Schema.String.pipe(Schema.brand('VillagerId'))
export type VillagerId = Schema.Schema.Type<typeof VillagerIdSchema>
export const VillagerId = {
  make: (value: string): VillagerId => value as unknown as VillagerId,
}

export const VillageStructureTypeSchema = Schema.Literal('house', 'road', 'well', 'farm')
export type VillageStructureType = Schema.Schema.Type<typeof VillageStructureTypeSchema>

export const VillageStructureSchema = Schema.Struct({
  structureId: VillageStructureIdSchema,
  type: VillageStructureTypeSchema,
  anchor: PositionSchema,
  size: Schema.Struct({
    x: Schema.Number.pipe(Schema.int(), Schema.positive()),
    y: Schema.Number.pipe(Schema.int(), Schema.positive()),
    z: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }),
})
export type VillageStructure = Schema.Schema.Type<typeof VillageStructureSchema>

export const VillagerProfessionSchema = Schema.Literal('Farmer', 'Librarian', 'Blacksmith')
export type VillagerProfession = Schema.Schema.Type<typeof VillagerProfessionSchema>
export const VillagerProfession = {
  Farmer: 'Farmer' as const,
  Librarian: 'Librarian' as const,
  Blacksmith: 'Blacksmith' as const,
}

export const VillagerActivitySchema = Schema.Literal('Idle', 'Wander', 'Work', 'Rest', 'Trade')
export type VillagerActivity = Schema.Schema.Type<typeof VillagerActivitySchema>
export const VillagerActivity = {
  Idle: 'Idle' as const,
  Wander: 'Wander' as const,
  Work: 'Work' as const,
  Rest: 'Rest' as const,
  Trade: 'Trade' as const,
}

export const VillagerSchema = Schema.Struct({
  villagerId: VillagerIdSchema,
  villageId: VillageIdSchema,
  profession: VillagerProfessionSchema,
  homeStructureId: VillageStructureIdSchema,
  workplaceStructureId: VillageStructureIdSchema,
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
  experience: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  position: PositionSchema,
  activity: VillagerActivitySchema,
})
export type Villager = Schema.Schema.Type<typeof VillagerSchema>

export const VillageSchema = Schema.Struct({
  villageId: VillageIdSchema,
  center: PositionSchema,
  structures: Schema.Array(VillageStructureSchema),
  villagers: Schema.Array(VillagerSchema),
})
export type Village = Schema.Schema.Type<typeof VillageSchema>

export const villagerLevelFromExperience = (experience: number): number => {
  if (experience >= 28) {
    return 4
  }

  if (experience >= 14) {
    return 3
  }

  if (experience >= 6) {
    return 2
  }

  return 1
}
