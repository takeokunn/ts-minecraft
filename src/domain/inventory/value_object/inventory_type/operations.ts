import { Effect, Match, pipe, Schema } from 'effect'
import { InventoryCapacitySchema, InventoryLayoutSchema, InventoryStatsSchema, InventoryTypeSchema } from './schema'
import {
  InventoryCapacity,
  InventoryCompatibility,
  InventoryFeature,
  InventoryLayout,
  InventorySize,
  InventoryStats,
  InventoryType,
  InventoryTypeError,
} from './types'

/**
 * InventoryType ファクトリー関数
 */
export const createInventoryType = (typeData: unknown): Effect.Effect<InventoryType, InventoryTypeError> =>
  pipe(
    Schema.decodeUnknown(InventoryTypeSchema)(typeData),
    Effect.mapError(() =>
      InventoryTypeError.UnsupportedType({
        type:
          typeof typeData === 'object' && typeData !== null && '_tag' in typeData ? String(typeData._tag) : 'unknown',
        supportedTypes: ['Player', 'Chest', 'Furnace', 'CraftingTable', 'Anvil', 'EnchantingTable'],
      })
    )
  )

/**
 * プレイヤーインベントリを作成
 */
export const createPlayerInventory = (): Effect.Effect<InventoryType, InventoryTypeError> =>
  createInventoryType({
    _tag: 'Player',
    slots: 36,
    hotbarSlots: 9,
    armorSlots: 4,
    offhandSlots: 1,
  })

/**
 * チェストインベントリを作成
 */
export const createChestInventory = (rows: number): Effect.Effect<InventoryType, InventoryTypeError> =>
  Effect.gen(function* () {
    if (rows < 1 || rows > 6) {
      return yield* Effect.fail(
        InventoryTypeError.InvalidSlotCount({
          slots: rows * 9,
          min: 9,
          max: 54,
        })
      )
    }

    return yield* createInventoryType({
      _tag: 'Chest',
      rows,
      slots: rows * 9,
    })
  })

/**
 * シュルカーボックスを作成
 */
export const createShulkerBox = (color: string): Effect.Effect<InventoryType, InventoryTypeError> =>
  Effect.gen(function* () {
    const validColors = [
      'white',
      'orange',
      'magenta',
      'light_blue',
      'yellow',
      'lime',
      'pink',
      'gray',
      'light_gray',
      'cyan',
      'purple',
      'blue',
      'brown',
      'green',
      'red',
      'black',
    ]

    if (!validColors.includes(color)) {
      return yield* Effect.fail(
        InventoryTypeError.InvalidConfiguration({
          field: 'color',
          value: color,
          expected: `one of: ${validColors.join(', ')}`,
        })
      )
    }

    return yield* createInventoryType({
      _tag: 'ShulkerBox',
      slots: 27,
      color,
    })
  })

/**
 * インベントリ容量を計算
 */
export const calculateCapacity = (inventoryType: InventoryType): Effect.Effect<InventoryCapacity, InventoryTypeError> =>
  Effect.gen(function* () {
    const totalSlots = getTotalSlots(inventoryType)
    const maxStacksPerSlot = 64 // 標準的な最大スタックサイズ
    const maxItemsTotal = totalSlots * maxStacksPerSlot

    return yield* pipe(
      Schema.decodeUnknown(InventoryCapacitySchema)({
        totalSlots,
        maxStacksPerSlot,
        maxItemsTotal,
      }),
      Effect.mapError(() =>
        InventoryTypeError.InvalidConfiguration({
          field: 'capacity',
          value: { totalSlots, maxStacksPerSlot, maxItemsTotal },
          expected: 'valid capacity configuration',
        })
      )
    )
  })

/**
 * インベントリサイズカテゴリを判定
 */
export const categorizeInventorySize = (inventoryType: InventoryType): InventorySize => {
  const slots = getTotalSlots(inventoryType)

  if (slots <= 9) {
    return InventorySize.Small({
      slots,
      description: 'Small inventory for basic storage',
    })
  } else if (slots <= 27) {
    return InventorySize.Medium({
      slots,
      description: 'Medium inventory for moderate storage',
    })
  } else if (slots <= 54) {
    return InventorySize.Large({
      slots,
      description: 'Large inventory for extensive storage',
    })
  } else {
    return InventorySize.ExtraLarge({
      slots,
      description: 'Extra large inventory for massive storage',
    })
  }
}

/**
 * インベントリの総スロット数を取得
 */
export const getTotalSlots = (inventoryType: InventoryType): number =>
  pipe(
    inventoryType,
    Match.value,
    Match.tag('Player', (player) => player.slots),
    Match.tag('Chest', (chest) => chest.slots),
    Match.tag('DoubleChest', (doubleChest) => doubleChest.slots),
    Match.tag('Furnace', () => 3),
    Match.tag('BlastFurnace', () => 3),
    Match.tag('Smoker', () => 3),
    Match.tag('CraftingTable', (crafting) => crafting.gridSlots + crafting.outputSlot),
    Match.tag('Anvil', () => 3),
    Match.tag('EnchantingTable', () => 2),
    Match.tag('BrewingStand', (brewing) => brewing.inputSlots + brewing.fuelSlot + brewing.blazePowderSlot),
    Match.tag('Beacon', (beacon) => beacon.inputSlot),
    Match.tag('Hopper', (hopper) => hopper.slots),
    Match.tag('Dispenser', (dispenser) => dispenser.slots),
    Match.tag('Dropper', (dropper) => dropper.slots),
    Match.tag('ShulkerBox', (shulker) => shulker.slots),
    Match.tag('Barrel', (barrel) => barrel.slots),
    Match.tag('CartographyTable', () => 3),
    Match.tag('Grindstone', () => 3),
    Match.tag('Loom', () => 4),
    Match.tag('Smithing', () => 4),
    Match.tag('Stonecutter', () => 2),
    Match.tag('Horse', (horse) => horse.slots),
    Match.tag('Llama', (llama) => llama.slots),
    Match.tag('Villager', (villager) => villager.trades),
    Match.tag('Creative', () => Number.MAX_SAFE_INTEGER),
    Match.exhaustive
  )

/**
 * インベントリタイプが特定の機能をサポートするかを判定
 */
export const supportsFeature = (inventoryType: InventoryType, feature: InventoryFeature): boolean =>
  pipe(
    feature,
    Match.value,
    Match.tag('AutoSorting', () => {
      return pipe(
        inventoryType,
        Match.value,
        Match.tag('Player', () => true),
        Match.tag('Chest', () => true),
        Match.tag('DoubleChest', () => true),
        Match.tag('ShulkerBox', () => true),
        Match.tag('Barrel', () => true),
        Match.orElse(() => false),
        Match.exhaustive
      )
    }),
    Match.tag('VoidProtection', () => {
      return pipe(
        inventoryType,
        Match.value,
        Match.tag('Player', () => true),
        Match.orElse(() => false),
        Match.exhaustive
      )
    }),
    Match.tag('AutoCrafting', () => {
      return pipe(
        inventoryType,
        Match.value,
        Match.tag('CraftingTable', () => true),
        Match.orElse(() => false),
        Match.exhaustive
      )
    }),
    Match.tag('Filter', () => {
      return pipe(
        inventoryType,
        Match.value,
        Match.tag('Hopper', () => true),
        Match.tag('Dispenser', () => true),
        Match.tag('Dropper', () => true),
        Match.orElse(() => false),
        Match.exhaustive
      )
    }),
    Match.orElse(() => false),
    Match.exhaustive
  )

/**
 * 2つのインベントリタイプの互換性を判定
 */
export const checkCompatibility = (type1: InventoryType, type2: InventoryType): InventoryCompatibility => {
  const slots1 = getTotalSlots(type1)
  const slots2 = getTotalSlots(type2)

  // 同じタイプの場合は完全互換
  if (type1._tag === type2._tag) {
    return InventoryCompatibility.FullyCompatible({
      reason: 'Same inventory type',
    })
  }

  // プレイヤーインベントリとチェスト系の互換性
  if (
    (type1._tag === 'Player' && ['Chest', 'DoubleChest', 'ShulkerBox', 'Barrel'].includes(type2._tag)) ||
    (type2._tag === 'Player' && ['Chest', 'DoubleChest', 'ShulkerBox', 'Barrel'].includes(type1._tag))
  ) {
    if (slots1 === slots2) {
      return InventoryCompatibility.FullyCompatible({
        reason: 'Same slot count allows full compatibility',
      })
    } else {
      return InventoryCompatibility.PartiallyCompatible({
        limitations: [`Different slot counts: ${slots1} vs ${slots2}`],
      })
    }
  }

  // 機能ブロック間の互換性
  const functionalBlocks = ['Furnace', 'BlastFurnace', 'Smoker']
  if (functionalBlocks.includes(type1._tag) && functionalBlocks.includes(type2._tag)) {
    return InventoryCompatibility.RequiresConversion({
      conversionType: 'functional block migration',
      dataLoss: false,
    })
  }

  // その他の場合は非互換
  return InventoryCompatibility.Incompatible({
    reason: `Incompatible inventory types: ${type1._tag} and ${type2._tag}`,
  })
}

/**
 * インベントリレイアウトを作成
 */
export const createInventoryLayout = (
  inventoryType: InventoryType,
  displayName: string
): Effect.Effect<InventoryLayout, InventoryTypeError> =>
  Effect.gen(function* () {
    const { gridWidth, gridHeight, specialSlots, playerSlots } = getLayoutDimensions(inventoryType)

    return yield* pipe(
      Schema.decodeUnknown(InventoryLayoutSchema)({
        type: inventoryType,
        gridWidth,
        gridHeight,
        specialSlots,
        playerSlots,
        displayName,
      }),
      Effect.mapError(() =>
        InventoryTypeError.InvalidConfiguration({
          field: 'layout',
          value: { gridWidth, gridHeight, specialSlots, playerSlots, displayName },
          expected: 'valid inventory layout',
        })
      )
    )
  })

/**
 * インベントリタイプからレイアウト次元を取得
 */
export const getLayoutDimensions = (inventoryType: InventoryType) =>
  pipe(
    inventoryType,
    Match.value,
    Match.tag('Player', () => ({
      gridWidth: 9,
      gridHeight: 4,
      specialSlots: {
        helmet: { x: 0, y: 0, type: 'armor' },
        chestplate: { x: 0, y: 1, type: 'armor' },
        leggings: { x: 0, y: 2, type: 'armor' },
        boots: { x: 0, y: 3, type: 'armor' },
        offhand: { x: 2, y: 1, type: 'offhand' },
      },
      playerSlots: true,
    })),
    Match.tag('Chest', (chest) => ({
      gridWidth: 9,
      gridHeight: chest.rows,
      specialSlots: {},
      playerSlots: true,
    })),
    Match.tag('Furnace', () => ({
      gridWidth: 3,
      gridHeight: 1,
      specialSlots: {
        input: { x: 0, y: 0, type: 'input' },
        fuel: { x: 1, y: 0, type: 'fuel' },
        output: { x: 2, y: 0, type: 'output' },
      },
      playerSlots: true,
    })),
    Match.tag('CraftingTable', () => ({
      gridWidth: 3,
      gridHeight: 3,
      specialSlots: {
        output: { x: 4, y: 1, type: 'output' },
      },
      playerSlots: true,
    })),
    Match.orElse(() => ({
      gridWidth: 9,
      gridHeight: 1,
      specialSlots: {},
      playerSlots: true,
    })),
    Match.exhaustive
  )

/**
 * インベントリ統計を計算
 */
export const calculateInventoryStats = (
  inventoryType: InventoryType,
  usedSlots: number,
  totalItems: number,
  uniqueItems: number
): Effect.Effect<InventoryStats, InventoryTypeError> =>
  Effect.gen(function* () {
    const totalSlots = getTotalSlots(inventoryType)
    const emptySlots = totalSlots - usedSlots
    const averageStackSize = usedSlots > 0 ? totalItems / usedSlots : 0
    const utilization = totalSlots > 0 ? usedSlots / totalSlots : 0

    return yield* pipe(
      Schema.decodeUnknown(InventoryStatsSchema)({
        totalSlots,
        usedSlots,
        emptySlots,
        totalItems,
        uniqueItems,
        averageStackSize,
        utilization,
      }),
      Effect.mapError(() =>
        InventoryTypeError.InvalidConfiguration({
          field: 'stats',
          value: { totalSlots, usedSlots, emptySlots, totalItems, uniqueItems, averageStackSize, utilization },
          expected: 'valid inventory statistics',
        })
      )
    )
  })

/**
 * インベントリタイプの表示名を取得
 */
export const getDisplayName = (inventoryType: InventoryType): string =>
  pipe(
    inventoryType,
    Match.value,
    Match.tag('Player', () => 'Player Inventory'),
    Match.tag('Chest', (chest) => `Chest (${chest.rows} rows)`),
    Match.tag('DoubleChest', () => 'Large Chest'),
    Match.tag('Furnace', () => 'Furnace'),
    Match.tag('BlastFurnace', () => 'Blast Furnace'),
    Match.tag('Smoker', () => 'Smoker'),
    Match.tag('CraftingTable', () => 'Crafting Table'),
    Match.tag('Anvil', () => 'Anvil'),
    Match.tag('EnchantingTable', () => 'Enchanting Table'),
    Match.tag('BrewingStand', () => 'Brewing Stand'),
    Match.tag('Beacon', () => 'Beacon'),
    Match.tag('Hopper', () => 'Hopper'),
    Match.tag('Dispenser', () => 'Dispenser'),
    Match.tag('Dropper', () => 'Dropper'),
    Match.tag('ShulkerBox', (shulker) => `${shulker.color.replace('_', ' ')} Shulker Box`),
    Match.tag('Barrel', () => 'Barrel'),
    Match.tag('CartographyTable', () => 'Cartography Table'),
    Match.tag('Grindstone', () => 'Grindstone'),
    Match.tag('Loom', () => 'Loom'),
    Match.tag('Smithing', () => 'Smithing Table'),
    Match.tag('Stonecutter', () => 'Stonecutter'),
    Match.tag('Horse', () => 'Horse Inventory'),
    Match.tag('Llama', () => 'Llama Inventory'),
    Match.tag('Villager', () => 'Villager Trades'),
    Match.tag('Creative', () => 'Creative Inventory'),
    Match.exhaustive
  )

/**
 * インベントリタイプが保存可能かを判定
 */
export const isPersistent = (inventoryType: InventoryType): boolean =>
  pipe(
    inventoryType,
    Match.value,
    Match.tag('Player', () => true),
    Match.tag('Chest', () => true),
    Match.tag('DoubleChest', () => true),
    Match.tag('ShulkerBox', () => true),
    Match.tag('Barrel', () => true),
    Match.tag('Furnace', () => true),
    Match.tag('BlastFurnace', () => true),
    Match.tag('Smoker', () => true),
    Match.tag('BrewingStand', () => true),
    Match.tag('Beacon', () => true),
    Match.tag('Hopper', () => true),
    Match.tag('Dispenser', () => true),
    Match.tag('Dropper', () => true),
    Match.orElse(() => false), // 一時的なインベントリ（Anvil, Enchanting Table等）
    Match.exhaustive
  )
