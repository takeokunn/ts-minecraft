import { Schema } from '@effect/schema'
import { Brand, Match, pipe } from 'effect'
import type { PlayerId, EntityId, ItemId } from '../../shared/types/branded.js'
import { PlayerIdSchema } from '../../shared/types/branded.js'
import type { BlockPosition } from '../../shared/types/branded.js'
import type { ItemStack } from '../inventory/InventoryTypes.js'
import type { Health } from '../player/PlayerTypes.js'

// ===================================
// Branded Types
// ===================================

export type CropId = string & Brand.Brand<'CropId'>
export const CropId = Brand.nominal<CropId>()
export const CropIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('CropId'),
  Schema.annotations({
    title: 'CropId',
    description: 'Unique identifier for a crop',
  })
)

export type GrowthStage = number & Brand.Brand<'GrowthStage'>
export const GrowthStage = Brand.nominal<GrowthStage>()
export const GrowthStageSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('GrowthStage'),
  Schema.annotations({
    title: 'GrowthStage',
    description: 'Current growth stage of a crop (0-15)',
  })
)

export type LightLevel = number & Brand.Brand<'LightLevel'>
export const LightLevel = Brand.nominal<LightLevel>()
export const LightLevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 15),
  Schema.brand('LightLevel'),
  Schema.annotations({
    title: 'LightLevel',
    description: 'Light level at a position (0-15)',
  })
)

export type Moisture = number & Brand.Brand<'Moisture'>
export const Moisture = Brand.nominal<Moisture>()
export const MoistureSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 7),
  Schema.brand('Moisture'),
  Schema.annotations({
    title: 'Moisture',
    description: 'Moisture level of farmland (0-7)',
  })
)

export type GrowthRate = number & Brand.Brand<'GrowthRate'>
export const GrowthRate = Brand.nominal<GrowthRate>()
export const GrowthRateSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('GrowthRate'),
  Schema.annotations({
    title: 'GrowthRate',
    description: 'Growth rate multiplier for crops',
  })
)

export type WaterRadius = number & Brand.Brand<'WaterRadius'>
export const WaterRadius = Brand.nominal<WaterRadius>()
export const WaterRadiusSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(4),
  Schema.brand('WaterRadius'),
  Schema.annotations({
    title: 'WaterRadius',
    description: 'Required water proximity radius',
  })
)

export type BreedingCooldown = number & Brand.Brand<'BreedingCooldown'>
export const BreedingCooldown = Brand.nominal<BreedingCooldown>()
export const BreedingCooldownSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('BreedingCooldown'),
  Schema.annotations({
    title: 'BreedingCooldown',
    description: 'Breeding cooldown time in milliseconds',
  })
)

// ===================================
// Crop Types
// ===================================

export const CropTypeSchema = Schema.Literal(
  'wheat',
  'carrot',
  'potato',
  'beetroot',
  'melon',
  'pumpkin',
  'cocoa',
  'sugar_cane',
  'bamboo',
  'kelp',
  'nether_wart',
  'chorus_plant'
)
export type CropType = Schema.Schema.Type<typeof CropTypeSchema>

// ===================================
// Animal Types
// ===================================

export const AnimalTypeSchema = Schema.Literal(
  'cow',
  'pig',
  'sheep',
  'chicken',
  'horse',
  'rabbit',
  'llama',
  'cat',
  'dog',
  'parrot',
  'bee',
  'fox'
)
export type AnimalType = Schema.Schema.Type<typeof AnimalTypeSchema>

// ===================================
// Core Schemas
// ===================================

export const CropSchema = Schema.Struct({
  id: CropIdSchema,
  type: CropTypeSchema,
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  growthStage: GrowthStageSchema,
  plantedTime: Schema.Number,
  moisture: MoistureSchema,
  fertilized: Schema.Boolean,
  lastUpdate: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'Crop',
    description: 'A crop growing in the world',
  })
)
export type Crop = Schema.Schema.Type<typeof CropSchema>

export const GrowthRequirementsSchema = Schema.Struct({
  minLightLevel: LightLevelSchema,
  maxLightLevel: Schema.optional(LightLevelSchema),
  requiresWater: Schema.Boolean,
  waterRadius: WaterRadiusSchema,
  baseGrowthTime: Schema.Number.pipe(Schema.positive()), // milliseconds
  stages: Schema.Number.pipe(Schema.int(), Schema.positive()),
  canGrowInDark: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'GrowthRequirements',
    description: 'Requirements for crop growth',
  })
)
export type GrowthRequirements = Schema.Schema.Type<typeof GrowthRequirementsSchema>

export const GrowthConditionsSchema = Schema.Struct({
  lightLevel: LightLevelSchema,
  hasWater: Schema.Boolean,
  isFertilized: Schema.Boolean,
  temperature: Schema.optional(Schema.Number),
  humidity: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'GrowthConditions',
    description: 'Current growth conditions for a crop',
  })
)
export type GrowthConditions = Schema.Schema.Type<typeof GrowthConditionsSchema>

export const FarmAnimalSchema = Schema.Struct({
  entityId: Schema.String,
  type: AnimalTypeSchema,
  health: Schema.Number.pipe(Schema.positive()),
  age: Schema.Number.pipe(Schema.nonNegative()),
  isBaby: Schema.Boolean,
  lastFed: Schema.optional(Schema.Number),
  breedingCooldown: BreedingCooldownSchema,
  tamed: Schema.Boolean,
  ownerId: Schema.optional(PlayerIdSchema),
  loveModeTime: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'FarmAnimal',
    description: 'A farm animal entity',
  })
)
export type FarmAnimal = Schema.Schema.Type<typeof FarmAnimalSchema>

// ===================================
// Event Types
// ===================================

export const DestroyReasonSchema = Schema.Literal(
  'player_break',
  'natural_decay',
  'trampled',
  'explosion',
  'fire',
  'water_flow',
  'mob_grief'
)
export type DestroyReason = Schema.Schema.Type<typeof DestroyReasonSchema>

export const AgricultureEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('CropPlanted'),
    cropId: CropIdSchema,
    type: CropTypeSchema,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
    planterId: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CropGrown'),
    cropId: CropIdSchema,
    fromStage: GrowthStageSchema,
    toStage: GrowthStageSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CropHarvested'),
    cropId: CropIdSchema,
    drops: Schema.Array(Schema.Unknown), // ItemStack array
    harvesterId: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CropDestroyed'),
    cropId: CropIdSchema,
    reason: DestroyReasonSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('CropFertilized'),
    cropId: CropIdSchema,
    fertilizerId: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('AnimalBred'),
    parent1: Schema.String,
    parent2: Schema.String,
    offspring: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('AnimalFed'),
    animalId: Schema.String,
    feederId: Schema.String,
    food: Schema.Unknown, // ItemStack
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('AnimalTamed'),
    animalId: Schema.String,
    tamerId: Schema.String,
    timestamp: Schema.Number,
  })
)
export type AgricultureEvent = Schema.Schema.Type<typeof AgricultureEventSchema>

// ===================================
// Error Types
// ===================================

export const AgricultureErrorReasonSchema = Schema.Literal(
  'INVALID_SOIL',
  'CROP_ALREADY_EXISTS',
  'CROP_NOT_FOUND',
  'CROP_NOT_MATURE',
  'INSUFFICIENT_LIGHT',
  'NO_WATER_NEARBY',
  'ANIMAL_NOT_FOUND',
  'INCOMPATIBLE_ANIMALS',
  'ANIMAL_TOO_YOUNG',
  'BREEDING_COOLDOWN',
  'INVALID_FOOD',
  'NOT_TAMEABLE',
  'ALREADY_TAMED'
)
export type AgricultureErrorReason = Schema.Schema.Type<typeof AgricultureErrorReasonSchema>

export const AgricultureErrorSchema = Schema.Struct({
  _tag: Schema.Literal('AgricultureError'),
  reason: AgricultureErrorReasonSchema,
  message: Schema.String,
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  cropId: Schema.optional(CropIdSchema),
  animalId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'AgricultureError',
    description: 'Error in agriculture operations',
  })
)
export type AgricultureError = Schema.Schema.Type<typeof AgricultureErrorSchema>

// ===================================
// Helper Functions
// ===================================

export const createAgricultureError = (
  reason: AgricultureErrorReason,
  message: string,
  details?: {
    position?: { x: number; y: number; z: number }
    cropId?: CropId
    animalId?: string
    cause?: unknown
  }
): AgricultureError => ({
  _tag: 'AgricultureError' as const,
  reason,
  message,
  position: details?.position,
  cropId: details?.cropId,
  animalId: details?.animalId,
  cause: details?.cause,
})

export const InvalidSoilError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError('INVALID_SOIL', `Invalid soil at position (${position.x}, ${position.y}, ${position.z})`, {
    position,
  })

export const CropAlreadyExistsError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError(
    'CROP_ALREADY_EXISTS',
    `Crop already exists at position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const CropNotFoundError = (cropId: CropId) =>
  createAgricultureError('CROP_NOT_FOUND', `Crop ${cropId} not found`, { cropId })

export const CropNotMatureError = (cropId: CropId) =>
  createAgricultureError('CROP_NOT_MATURE', `Crop ${cropId} is not mature enough to harvest`, { cropId })

export const InsufficientLightError = (position: { x: number; y: number; z: number }, lightLevel: number) =>
  createAgricultureError(
    'INSUFFICIENT_LIGHT',
    `Insufficient light level (${lightLevel}) at position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const NoWaterNearbyError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError(
    'NO_WATER_NEARBY',
    `No water source found near position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const AnimalNotFoundError = (animalId: string) =>
  createAgricultureError('ANIMAL_NOT_FOUND', `Animal ${animalId} not found`, { animalId })

export const IncompatibleAnimalsError = (animal1: string, animal2: string) =>
  createAgricultureError('INCOMPATIBLE_ANIMALS', `Animals ${animal1} and ${animal2} are not compatible for breeding`)

export const AnimalTooYoungError = (animalId: string) =>
  createAgricultureError('ANIMAL_TOO_YOUNG', `Animal ${animalId} is too young to breed`, { animalId })

export const BreedingCooldownError = (animalId: string) =>
  createAgricultureError('BREEDING_COOLDOWN', `Animal ${animalId} is still in breeding cooldown`, { animalId })

export const InvalidFoodError = (animalType: AnimalType, foodId: string) =>
  createAgricultureError('INVALID_FOOD', `${foodId} is not valid food for ${animalType}`)

// ===================================
// Utility Types
// ===================================

export interface CropDrops {
  readonly items: ReadonlyArray<ItemStack>
  readonly experience: number
}

export interface AnimalDrops {
  readonly items: ReadonlyArray<ItemStack>
  readonly experience: number
}

export interface BreedingResult {
  readonly babyId: string
  readonly babyType: AnimalType
  readonly parents: [string, string]
}

// Type guards
export const isCrop = (value: unknown): value is Crop => Schema.is(CropSchema)(value)

export const isFarmAnimal = (value: unknown): value is FarmAnimal => Schema.is(FarmAnimalSchema)(value)

export const isAgricultureError = (error: unknown): error is AgricultureError =>
  Schema.is(AgricultureErrorSchema)(error)
