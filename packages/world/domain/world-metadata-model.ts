import { Schema } from 'effect'
import { GameModeSchema, InventoryItemSchema, InventorySaveDataSchema, PositionSchema, RecipeIdSchema } from '@ts-minecraft/core'

export const CURRENT_WORLD_SAVE_VERSION = 1

const FurnaceItemStackSchema = Schema.Struct({
  itemType: InventoryItemSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
})

const FurnaceStateSchema = Schema.Struct({
  position: PositionSchema,
  input: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  fuel: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  output: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  activeRecipeId: Schema.OptionFromNullOr(RecipeIdSchema),
  progressSecs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})

export const WorldMetadataSchema = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.DateFromSelf,
  lastPlayed: Schema.DateFromSelf,
  playerSpawn: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    y: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  playerState: Schema.optional(
    Schema.Struct({
      position: PositionSchema,
      health: Schema.Number.pipe(Schema.int(), Schema.between(0, 20)),
      inventory: InventorySaveDataSchema,
      timeOfDay: Schema.Number.pipe(Schema.finite(), Schema.between(0, 0.9999)),
      hunger: Schema.Struct({
        foodLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 20)),
        saturation: Schema.Number.pipe(Schema.finite(), Schema.between(0, 20)),
      }),
      totalXP: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      equipment: Schema.Struct({
        HELMET: Schema.optional(InventoryItemSchema),
        CHESTPLATE: Schema.optional(InventoryItemSchema),
        LEGGINGS: Schema.optional(InventoryItemSchema),
        BOOTS: Schema.optional(InventoryItemSchema),
      }),
    }),
  ),
  furnaceStates: Schema.optional(Schema.Array(FurnaceStateSchema)),
  gameMode: GameModeSchema,
  saveVersion: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>
export type WorldMetadataEncoded = Schema.Schema.Encoded<typeof WorldMetadataSchema>
