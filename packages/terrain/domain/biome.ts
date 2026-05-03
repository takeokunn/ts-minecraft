import { Schema } from 'effect'
import { BlockTypeSchema } from '@ts-minecraft/kernel'

export const BiomeTypeSchema = Schema.Literal('PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE', 'BEACH', 'RIVER', 'TAIGA', 'SAVANNA')
export type BiomeType = Schema.Schema.Type<typeof BiomeTypeSchema>

// baseHeight/heightModifier removed in Phase 2.1 — height derives from continentalness/erosion/pv noise now.
export const BiomePropertiesSchema = Schema.Struct({
  surfaceBlock: BlockTypeSchema,
  subSurfaceBlock: BlockTypeSchema,
  treeDensity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  temperature: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  humidity: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type BiomeProperties = Schema.Schema.Type<typeof BiomePropertiesSchema>
