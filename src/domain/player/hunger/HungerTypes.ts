import { HealthSchema, ItemId as ItemIdSchema, PlayerIdSchema } from '@domain/core/types/brands'
import { Schema } from '@effect/schema'

/**
 * Hunger System用の型定義
 * Effect-TSのSchema/Brandパターンに準拠
 */

// Branded Types
export const HungerLevel = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('HungerLevel'),
  Schema.annotations({
    title: 'HungerLevel',
    description: 'Player hunger level (0-20, where 20 is full)',
  })
)
export type HungerLevel = Schema.Schema.Type<typeof HungerLevel>

export const SaturationLevel = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('SaturationLevel'),
  Schema.annotations({
    title: 'SaturationLevel',
    description: 'Player saturation level (0-20, cannot exceed hunger level)',
  })
)
export type SaturationLevel = Schema.Schema.Type<typeof SaturationLevel>

export const ExhaustionLevel = Schema.Number.pipe(
  Schema.between(0, 4),
  Schema.brand('ExhaustionLevel'),
  Schema.annotations({
    title: 'ExhaustionLevel',
    description: 'Player exhaustion level (0-4, triggers hunger decrease at 4)',
  })
)
export type ExhaustionLevel = Schema.Schema.Type<typeof ExhaustionLevel>

export const NutritionValue = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('NutritionValue'),
  Schema.annotations({
    title: 'NutritionValue',
    description: 'Food nutrition value (positive number)',
  })
)
export type NutritionValue = Schema.Schema.Type<typeof NutritionValue>

// Status Effect Definition
export const StatusEffectType = Schema.Literal(
  'regeneration',
  'poison',
  'hunger',
  'saturation',
  'instant_health',
  'instant_damage'
)
export type StatusEffectType = Schema.Schema.Type<typeof StatusEffectType>

export const StatusEffect = Schema.Struct({
  type: StatusEffectType,
  duration: Schema.Number.pipe(Schema.positive()),
  amplifier: Schema.Number.pipe(Schema.between(0, 255)),
})
export type StatusEffect = Schema.Schema.Type<typeof StatusEffect>

// Food Item Definition
export const FoodItem = Schema.Struct({
  itemId: ItemIdSchema,
  nutrition: NutritionValue,
  saturation: SaturationLevel,
  effects: Schema.Array(StatusEffect),
  eatTime: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Time in milliseconds to consume the food',
    })
  ),
})
export type FoodItem = Schema.Schema.Type<typeof FoodItem>

// Hunger Decrease Reasons - Tagged Union
export const HungerDecreaseReason = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Movement'),
    distance: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Combat'),
    damage: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Mining'),
    blockHardness: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Regeneration'),
    healthRestored: HealthSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Swimming'),
    duration: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Sprinting'),
    distance: Schema.Number.pipe(Schema.positive()),
  })
)
export type HungerDecreaseReason = Schema.Schema.Type<typeof HungerDecreaseReason>

// Tagged Union for Hunger Events
export const HungerEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('FoodConsumed'),
    playerId: PlayerIdSchema,
    foodItem: FoodItem,
    hungerRestored: HungerLevel,
    saturationRestored: SaturationLevel,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('HungerDecreased'),
    playerId: PlayerIdSchema,
    amount: HungerLevel,
    reason: HungerDecreaseReason,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('StarvationStarted'),
    playerId: PlayerIdSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('StarvationEnded'),
    playerId: PlayerIdSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SaturationDepleted'),
    playerId: PlayerIdSchema,
    timestamp: Schema.Number,
  })
)
export type HungerEvent = Schema.Schema.Type<typeof HungerEvent>

// Hunger State
export const HungerState = Schema.Struct({
  playerId: PlayerIdSchema,
  hunger: HungerLevel,
  saturation: SaturationLevel,
  exhaustion: ExhaustionLevel,
  isStarving: Schema.Boolean,
  lastFoodEaten: Schema.OptionFromNullOr(FoodItem),
  lastUpdateTime: Schema.Number,
})
export type HungerState = Schema.Schema.Type<typeof HungerState>

// Error Types
export class ConsumeError extends Schema.TaggedError<ConsumeError>()('ConsumeError', {
  playerId: PlayerIdSchema,
  reason: Schema.String,
}) {}

export class HungerError extends Schema.TaggedError<HungerError>()('HungerError', {
  playerId: PlayerIdSchema,
  message: Schema.String,
}) {}

export class PlayerNotFoundError extends Schema.TaggedError<PlayerNotFoundError>()('PlayerNotFoundError', {
  playerId: PlayerIdSchema,
}) {}

export class InvalidFoodError extends Schema.TaggedError<InvalidFoodError>()('InvalidFoodError', {
  itemId: ItemIdSchema,
  reason: Schema.String,
}) {}

// Constants
export const HUNGER_CONSTANTS = {
  MAX_HUNGER: 20,
  MAX_SATURATION: 20,
  MAX_EXHAUSTION: 4,
  MIN_SPRINT_HUNGER: 7,
  REGENERATION_HUNGER: 18,
  STARVATION_DAMAGE_INTERVAL: 4000, // 4 seconds
  STARVATION_DAMAGE: 1,
  EXHAUSTION_THRESHOLD: 4,
} as const
