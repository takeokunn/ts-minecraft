import { Brand, Schema } from 'effect'
import {
  InventoryAccess,
  InventoryCapacity,
  InventoryCompatibility,
  InventoryFeature,
  InventorySize,
  InventoryType,
} from './types'

/**
 * InventoryType ADT用Schema
 */
export const InventoryTypeSchema: Schema.Schema<InventoryType> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Player'),
    slots: Schema.Literal(36),
    hotbarSlots: Schema.Literal(9),
    armorSlots: Schema.Literal(4),
    offhandSlots: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Chest'),
    rows: Schema.Number.pipe(Schema.int(), Schema.between(1, 6)),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(9, 54)),
  }).pipe(
    Schema.filter((chest) => chest.slots === chest.rows * 9, {
      message: () => 'Chest slots must equal rows * 9',
    })
  ),
  Schema.Struct({
    _tag: Schema.Literal('DoubleChest'),
    slots: Schema.Literal(54),
    leftChest: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Furnace'),
    inputSlot: Schema.Literal(0),
    fuelSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BlastFurnace'),
    inputSlot: Schema.Literal(0),
    fuelSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Smoker'),
    inputSlot: Schema.Literal(0),
    fuelSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('CraftingTable'),
    gridSlots: Schema.Literal(9),
    outputSlot: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Anvil'),
    leftSlot: Schema.Literal(0),
    rightSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('EnchantingTable'),
    itemSlot: Schema.Literal(0),
    lapisSlot: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BrewingStand'),
    inputSlots: Schema.Literal(3),
    fuelSlot: Schema.Literal(1),
    blazePowderSlot: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Beacon'),
    inputSlot: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Hopper'),
    slots: Schema.Literal(5),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Dispenser'),
    slots: Schema.Literal(9),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Dropper'),
    slots: Schema.Literal(9),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ShulkerBox'),
    slots: Schema.Literal(27),
    color: Schema.String.pipe(
      Schema.pattern(
        /^(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)$/
      )
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Barrel'),
    slots: Schema.Literal(27),
  }),
  Schema.Struct({
    _tag: Schema.Literal('CartographyTable'),
    mapSlot: Schema.Literal(0),
    paperSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Grindstone'),
    leftSlot: Schema.Literal(0),
    rightSlot: Schema.Literal(1),
    outputSlot: Schema.Literal(2),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Loom'),
    bannerSlot: Schema.Literal(0),
    dyeSlot: Schema.Literal(1),
    patternSlot: Schema.Literal(2),
    outputSlot: Schema.Literal(3),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Smithing'),
    templateSlot: Schema.Literal(0),
    baseSlot: Schema.Literal(1),
    additionSlot: Schema.Literal(2),
    outputSlot: Schema.Literal(3),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Stonecutter'),
    inputSlot: Schema.Literal(0),
    outputSlots: Schema.Literal(1),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Horse'),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(2, 17)), // 馬の種類により異なる
    armorSlot: Schema.optional(Schema.Boolean),
    saddleSlot: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Llama'),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(3, 15)), // ラマの強さにより異なる
    carpetSlot: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Villager'),
    trades: Schema.Number.pipe(Schema.int(), Schema.between(1, 8)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Creative'),
    unlimited: Schema.Literal(true),
  })
)

/**
 * InventoryCapacity Brand型用Schema
 */
export const InventoryCapacitySchema = Schema.Struct({
  totalSlots: Schema.Number.pipe(Schema.int(), Schema.between(1, 54)),
  maxStacksPerSlot: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  maxItemsTotal: Schema.Number.pipe(Schema.int(), Schema.positive()),
}).pipe(
  Schema.filter(
    (capacity) => {
      return capacity.maxItemsTotal <= capacity.totalSlots * capacity.maxStacksPerSlot
    },
    {
      message: () => 'maxItemsTotal cannot exceed totalSlots * maxStacksPerSlot',
    }
  ),
  Schema.fromBrand(Brand.nominal<InventoryCapacity>())
)

/**
 * InventorySize ADT用Schema
 */
export const InventorySizeSchema: Schema.Schema<InventorySize> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Small'),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(5, 9)),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Medium'),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(18, 27)),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Large'),
    slots: Schema.Number.pipe(Schema.int(), Schema.between(36, 54)),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ExtraLarge'),
    slots: Schema.Number.pipe(Schema.int(), Schema.greaterThan(54)),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Variable'),
    minSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
    maxSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
    description: Schema.String.pipe(Schema.nonEmptyString()),
  }).pipe(
    Schema.filter((variable) => variable.minSlots <= variable.maxSlots, {
      message: () => 'minSlots must be less than or equal to maxSlots',
    })
  )
)

/**
 * InventoryAccess ADT用Schema
 */
export const InventoryAccessSchema: Schema.Schema<InventoryAccess> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('ReadOnly'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('WriteOnly'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ReadWrite'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Restricted'),
    allowedPlayers: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('AdminOnly'),
    adminLevel: Schema.Number.pipe(Schema.int(), Schema.between(1, 4)),
  })
)

/**
 * InventoryFeature ADT用Schema
 */
export const InventoryFeatureSchema: Schema.Schema<InventoryFeature> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('AutoSorting'),
    enabled: Schema.Boolean,
    sortBy: Schema.Union(
      Schema.Literal('name'),
      Schema.Literal('type'),
      Schema.Literal('rarity'),
      Schema.Literal('quantity')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('VoidProtection'),
    enabled: Schema.Boolean,
    protectedItems: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('AutoCrafting'),
    recipes: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Filter'),
    allowedItems: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
    blockedItems: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('KeepOnDeath'),
    enabled: Schema.Boolean,
    items: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Sharing'),
    sharedWith: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
    permissions: InventoryAccessSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Backup'),
    enabled: Schema.Boolean,
    frequency: Schema.Number.pipe(Schema.int(), Schema.positive()), // minutes
    maxBackups: Schema.Number.pipe(Schema.int(), Schema.between(1, 100)),
  })
)

/**
 * InventoryCompatibility ADT用Schema
 */
export const InventoryCompatibilitySchema: Schema.Schema<InventoryCompatibility> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('FullyCompatible'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PartiallyCompatible'),
    limitations: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Incompatible'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('RequiresConversion'),
    conversionType: Schema.String.pipe(Schema.nonEmptyString()),
    dataLoss: Schema.Boolean,
  })
)

/**
 * InventoryLayout用Schema
 */
export const InventoryLayoutSchema = Schema.Struct({
  type: InventoryTypeSchema,
  gridWidth: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
  gridHeight: Schema.Number.pipe(Schema.int(), Schema.between(1, 6)),
  specialSlots: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      x: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      y: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      type: Schema.String.pipe(Schema.nonEmptyString()),
    }),
  }),
  playerSlots: Schema.Boolean,
  displayName: Schema.String.pipe(Schema.nonEmptyString()),
})

/**
 * InventoryStats用Schema
 */
export const InventoryStatsSchema = Schema.Struct({
  totalSlots: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  usedSlots: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  emptySlots: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalItems: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  uniqueItems: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageStackSize: Schema.Number.pipe(Schema.nonNegative()),
  utilization: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.filter(
    (stats) => {
      return stats.usedSlots + stats.emptySlots === stats.totalSlots
    },
    {
      message: () => 'usedSlots + emptySlots must equal totalSlots',
    }
  )
)

/**
 * 特定のインベントリタイプ用の専用Schema
 */
export const SpecificInventorySchemas = {
  playerInventory: Schema.Struct({
    _tag: Schema.Literal('Player'),
    slots: Schema.Literal(36),
    hotbarSlots: Schema.Literal(9),
    armorSlots: Schema.Literal(4),
    offhandSlots: Schema.Literal(1),
  }),

  smallChest: Schema.Struct({
    _tag: Schema.Literal('Chest'),
    rows: Schema.Literal(3),
    slots: Schema.Literal(27),
  }),

  largeChest: Schema.Struct({
    _tag: Schema.Literal('DoubleChest'),
    slots: Schema.Literal(54),
    leftChest: Schema.Boolean,
  }),

  shulkerBox: Schema.Struct({
    _tag: Schema.Literal('ShulkerBox'),
    slots: Schema.Literal(27),
    color: Schema.Union(
      Schema.Literal('white'),
      Schema.Literal('orange'),
      Schema.Literal('magenta'),
      Schema.Literal('light_blue'),
      Schema.Literal('yellow'),
      Schema.Literal('lime'),
      Schema.Literal('pink'),
      Schema.Literal('gray'),
      Schema.Literal('light_gray'),
      Schema.Literal('cyan'),
      Schema.Literal('purple'),
      Schema.Literal('blue'),
      Schema.Literal('brown'),
      Schema.Literal('green'),
      Schema.Literal('red'),
      Schema.Literal('black')
    ),
  }),
} as const
