import { Match, pipe, Schema } from 'effect'
import { MaxStackSizeSchema } from './schema'
import { MaxStackSize, StackConstraint } from './types'

/**
 * アイテム別スタック制約の定義
 */
export const STACK_CONSTRAINTS: Record<string, StackConstraint> = {
  // 単体アイテム（スタック不可）
  'minecraft:diamond_sword': {
    category: 'tool',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Weapons and tools cannot be stacked',
  },
  'minecraft:iron_pickaxe': {
    category: 'tool',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Weapons and tools cannot be stacked',
  },
  'minecraft:bow': {
    category: 'tool',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Weapons and tools cannot be stacked',
  },
  'minecraft:saddle': {
    category: 'single',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Unique items cannot be stacked',
  },

  // 16個制限アイテム
  'minecraft:ender_pearl': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(16),
    stackable: true,
    description: 'Ender pearls stack up to 16',
  },
  'minecraft:snowball': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(16),
    stackable: true,
    description: 'Snowballs stack up to 16',
  },
  'minecraft:egg': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(16),
    stackable: true,
    description: 'Eggs stack up to 16',
  },
  'minecraft:oak_sign': {
    category: 'block',
    maxSize: Schema.make(MaxStackSizeSchema)(16),
    stackable: true,
    description: 'Signs stack up to 16',
  },
  'minecraft:item_frame': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(16),
    stackable: true,
    description: 'Item frames stack up to 16',
  },

  // 64個制限アイテム（標準）
  'minecraft:cobblestone': {
    category: 'block',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Standard building blocks stack up to 64',
  },
  'minecraft:stone': {
    category: 'block',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Standard building blocks stack up to 64',
  },
  'minecraft:dirt': {
    category: 'block',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Standard building blocks stack up to 64',
  },
  'minecraft:iron_ingot': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Raw materials stack up to 64',
  },
  'minecraft:gold_ingot': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Raw materials stack up to 64',
  },
  'minecraft:diamond': {
    category: 'material',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Raw materials stack up to 64',
  },

  // 食べ物（多くは64個）
  'minecraft:bread': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Food items stack up to 64',
  },
  'minecraft:apple': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Food items stack up to 64',
  },
  'minecraft:cooked_beef': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Food items stack up to 64',
  },
  'minecraft:golden_apple': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(64),
    stackable: true,
    description: 'Special food items stack up to 64',
  },

  // スープ・シチュー系（スタック不可）
  'minecraft:mushroom_stew': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Bowl-based foods cannot be stacked',
  },
  'minecraft:rabbit_stew': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Bowl-based foods cannot be stacked',
  },
  'minecraft:beetroot_soup': {
    category: 'food',
    maxSize: Schema.make(MaxStackSizeSchema)(1),
    stackable: false,
    description: 'Bowl-based foods cannot be stacked',
  },
} as const

/**
 * デフォルトのスタック制約を取得
 */
export const getDefaultStackConstraint = (
  category: 'single' | 'tool' | 'food' | 'material' | 'block'
): StackConstraint =>
  pipe(
    Match.value(category),
    Match.when('single', () => ({
      category: 'single' as const,
      maxSize: Schema.make(MaxStackSizeSchema)(1),
      stackable: false,
      description: 'Single item only',
    })),
    Match.when('tool', () => ({
      category: 'tool' as const,
      maxSize: Schema.make(MaxStackSizeSchema)(1),
      stackable: false,
      description: 'Single item only',
    })),
    Match.orElse((cat) => ({
      category: cat,
      maxSize: Schema.make(MaxStackSizeSchema)(64),
      stackable: true,
      description: 'Standard stackable item',
    }))
  )

/**
 * アイテムIDからスタック制約を取得
 */
export const getStackConstraint = (itemId: string): StackConstraint => {
  return STACK_CONSTRAINTS[itemId] ?? getDefaultStackConstraint('material')
}

/**
 * アイテムがスタック可能かどうかを判定
 */
export const isStackable = (itemId: string): boolean => {
  const constraint = getStackConstraint(itemId)
  return constraint.stackable
}

/**
 * アイテムの最大スタックサイズを取得
 */
export const getMaxStackSize = (itemId: string): MaxStackSize => {
  const constraint = getStackConstraint(itemId)
  return constraint.maxSize
}

/**
 * 特定のカテゴリのアイテムをすべて取得
 */
export const getItemsByCategory = (category: 'single' | 'tool' | 'food' | 'material' | 'block'): readonly string[] => {
  return Object.entries(STACK_CONSTRAINTS)
    .filter(([_, constraint]) => constraint.category === category)
    .map(([itemId]) => itemId)
}

/**
 * スタック可能なアイテムをすべて取得
 */
export const getStackableItems = (): readonly string[] => {
  return Object.entries(STACK_CONSTRAINTS)
    .filter(([_, constraint]) => constraint.stackable)
    .map(([itemId]) => itemId)
}

/**
 * 指定されたスタックサイズのアイテムを取得
 */
export const getItemsByStackSize = (stackSize: number): readonly string[] => {
  return Object.entries(STACK_CONSTRAINTS)
    .filter(([_, constraint]) => constraint.maxSize === stackSize)
    .map(([itemId]) => itemId)
}

/**
 * スタック制約の統計情報
 */
export const getStackConstraintStats = () => {
  const constraints = Object.values(STACK_CONSTRAINTS)
  const categoryCounts = constraints.reduce(
    (acc, constraint) => {
      acc[constraint.category] = (acc[constraint.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const stackSizeCounts = constraints.reduce(
    (acc, constraint) => {
      const size = constraint.maxSize.toString()
      acc[size] = (acc[size] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const stackableCount = constraints.filter((c) => c.stackable).length
  const nonStackableCount = constraints.filter((c) => !c.stackable).length

  return {
    total: constraints.length,
    categoryCounts,
    stackSizeCounts,
    stackableCount,
    nonStackableCount,
    stackablePercentage: (stackableCount / constraints.length) * 100,
  }
}
