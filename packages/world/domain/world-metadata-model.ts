import { Schema } from 'effect'
import {
  GameModeSchema,
  InventoryItemSchema,
  InventorySaveDataSchema,
  PositionSchema,
  QuaternionSchema,
  RecipeIdSchema,
  StackCountSchema,
  Vector3Schema,
} from '@ts-minecraft/core'

export const CURRENT_WORLD_SAVE_VERSION = 1

const FurnaceItemStackSchema = Schema.Struct({
  itemType: InventoryItemSchema,
  count: StackCountSchema,
})

const FurnaceStateSchema = Schema.Struct({
  position: PositionSchema,
  input: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  fuel: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  output: Schema.OptionFromNullOr(FurnaceItemStackSchema),
  activeRecipeId: Schema.OptionFromNullOr(RecipeIdSchema),
  progressSecs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  burnRemainingSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
  burnTotalSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
})

const ChestItemStackSchema = Schema.Struct({
  itemType: InventoryItemSchema,
  count: StackCountSchema,
  durability: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})

const ChestStateSchema = Schema.Struct({
  position: PositionSchema,
  slots: Schema.Array(Schema.OptionFromNullOr(ChestItemStackSchema)),
})

const WeatherStateSchema = Schema.Struct({
  weather: Schema.Literal('clear', 'rain', 'thunder'),
  remainingSecs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
})

const EntityTypeSchema = Schema.Literal(
  'Zombie',
  'Cow',
  'Pig',
  'Sheep',
  'Chicken',
  'Bat',
  'Bee',
  'Squid',
  'GlowSquid',
  'Witch',
  'Drowned',
  'ZombieVillager',
  'Creeper',
  'Skeleton',
  'Spider',
  'Enderman',
  'EnderDragon',
  'Endermite',
  'Shulker',
  'Blaze',
  'Villager',
  'Ghast',
  'Guardian',
)

const EntityStateSchema = Schema.Struct({
  entityId: Schema.String,
  // Home dimension of the entity (absent in pre-dimension saves → overworld).
  dimension: Schema.optional(Schema.Literal('overworld', 'nether', 'end')),
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
  health: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  type: EntityTypeSchema,
  isBaby: Schema.optional(Schema.Boolean),
  fuseSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
  fireSecs: Schema.optional(Schema.Number.pipe(Schema.finite(), Schema.nonNegative())),
})

export const WorldMetadataSchema = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  displayName: Schema.optional(Schema.String),
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
      // Currently-mounted vehicle modality. Plain optional so pre-vehicle saves
      // decode to undefined (no mount); on restore it re-enters the modality so
      // the consumed item stays accounted for across reloads.
      mountedVehicle: Schema.optional(Schema.Literal('BOAT', 'MINECART')),
      // Bed-set respawn point (FR-4). Optional because some game modes do not
      // establish a bed spawn before the first save.
      respawnPosition: Schema.optional(PositionSchema),
      // Crop age map: keys are "x,y,z" strings, values 0-2. Optional because
      // worlds without cultivated crops do not need to persist an empty map.
      cropAges: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Number.pipe(Schema.int(), Schema.between(0, 2)) })),
    }),
  ),
  // Player statistics + unlocked achievement ids (achievement system). Optional:
  // pre-feature saves decode without them and start from zero.
  statistics: Schema.optional(Schema.Struct({
    blocksMinedTotal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    blocksMinedByType: Schema.Record({ key: Schema.String, value: Schema.Number.pipe(Schema.int(), Schema.nonNegative()) }),
    mobsKilledTotal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    mobsKilledByType: Schema.Record({ key: Schema.String, value: Schema.Number.pipe(Schema.int(), Schema.nonNegative()) }),
    itemsCraftedTotal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    itemsCraftedByType: Schema.Record({ key: Schema.String, value: Schema.Number.pipe(Schema.int(), Schema.nonNegative()) }),
    deathsTotal: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { default: () => 0 }),
    dimensionsVisited: Schema.Array(Schema.Literal('overworld', 'nether', 'end')),
  })),
  unlockedAchievements: Schema.optional(Schema.Array(Schema.String)),
  chestStates: Schema.optional(Schema.Array(ChestStateSchema)),
  furnaceStates: Schema.optional(Schema.Array(FurnaceStateSchema)),
  weatherState: Schema.optional(WeatherStateSchema),
  entityStates: Schema.optional(Schema.Array(EntityStateSchema)),
  // Dimension the player was in when the world was saved (absent → overworld).
  activeDimension: Schema.optional(Schema.Literal('overworld', 'nether', 'end')),
  // Nether/End portal registry — restoring it keeps portal links across reloads.
  portals: Schema.optional(Schema.Array(Schema.Struct({
    dimension: Schema.Literal('overworld', 'nether', 'end'),
    positions: Schema.Array(Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })),
  }))),
  gameMode: GameModeSchema,
  saveVersion: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type WorldMetadata = Schema.Schema.Type<typeof WorldMetadataSchema>
export type WorldMetadataEncoded = Schema.Schema.Encoded<typeof WorldMetadataSchema>
