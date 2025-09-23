import { Schema } from '@effect/schema'

/**
 * ゲーム固有Brand型定義
 * Minecraftゲームメカニクスに特化した型を定義
 */

/**
 * Health用のブランド型
 * プレイヤーやエンティティの体力を表現（0-20の範囲）
 */
export const HealthSchema = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Health'),
  Schema.annotations({
    title: 'Health',
    description: 'Health points (0-20, where 20 is full health)',
    examples: [20, 10, 5, 0],
  })
)
export type Health = Schema.Schema.Type<typeof HealthSchema>

/**
 * Hunger用のブランド型
 * プレイヤーの空腹度を表現（0-20の範囲）
 */
export const HungerSchema = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('Hunger'),
  Schema.annotations({
    title: 'Hunger',
    description: 'Hunger level (0-20, where 20 is full saturation)',
    examples: [20, 15, 5, 0],
  })
)
export type Hunger = Schema.Schema.Type<typeof HungerSchema>

/**
 * Experience用のブランド型
 * プレイヤーの経験値を表現
 */
export const ExperienceSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.brand('Experience'),
  Schema.annotations({
    title: 'Experience',
    description: 'Experience points (non-negative integer)',
    examples: [0, 100, 1000, 50000],
  })
)
export type Experience = Schema.Schema.Type<typeof ExperienceSchema>

/**
 * Level用のブランド型
 * プレイヤーのレベルを表現（0-1000の範囲、実用的上限）
 */
export const LevelSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 1000),
  Schema.brand('Level'),
  Schema.annotations({
    title: 'Level',
    description: 'Player level (0-1000)',
    examples: [1, 10, 30, 100],
  })
)
export type Level = Schema.Schema.Type<typeof LevelSchema>

/**
 * Score用のブランド型
 * プレイヤーのスコアを表現
 */
export const ScoreSchema = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.int(),
  Schema.brand('Score'),
  Schema.annotations({
    title: 'Score',
    description: 'Player score (non-negative integer)',
    examples: [0, 500, 10000, 1000000],
  })
)
export type Score = Schema.Schema.Type<typeof ScoreSchema>

/**
 * StackSize用のブランド型
 * アイテムスタックのサイズを表現（1-64の範囲）
 */
export const StackSizeSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.brand('StackSize'),
  Schema.annotations({
    title: 'StackSize',
    description: 'Item stack size (1-64)',
    examples: [1, 16, 32, 64],
  })
)
export type StackSize = Schema.Schema.Type<typeof StackSizeSchema>

/**
 * Durability用のブランド型
 * アイテムの耐久度を表現（0-1000の範囲、実用的上限）
 */
export const DurabilitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 1000),
  Schema.brand('Durability'),
  Schema.annotations({
    title: 'Durability',
    description: 'Item durability (0-1000, where 0 is broken)',
    examples: [1000, 500, 100, 1],
  })
)
export type Durability = Schema.Schema.Type<typeof DurabilitySchema>

/**
 * ゲーム固有Brand型の安全な作成ヘルパー
 */
export const GameBrands = {
  /**
   * 安全なHealth作成
   */
  createHealth: (value: number): Health =>
    Schema.decodeSync(HealthSchema)(value),

  /**
   * Full health
   */
  fullHealth: (): Health =>
    Schema.decodeSync(HealthSchema)(20),

  /**
   * 安全なHunger作成
   */
  createHunger: (value: number): Hunger =>
    Schema.decodeSync(HungerSchema)(value),

  /**
   * Full hunger
   */
  fullHunger: (): Hunger =>
    Schema.decodeSync(HungerSchema)(20),

  /**
   * 安全なExperience作成
   */
  createExperience: (value: number): Experience =>
    Schema.decodeSync(ExperienceSchema)(value),

  /**
   * 安全なLevel作成
   */
  createLevel: (value: number): Level =>
    Schema.decodeSync(LevelSchema)(value),

  /**
   * Calculate level from experience
   * Simplified formula: level = floor(sqrt(experience / 100))
   */
  levelFromExperience: (experience: Experience): Level => {
    const level = Math.floor(Math.sqrt(experience / 100))
    return Schema.decodeSync(LevelSchema)(Math.min(level, 1000))
  },

  /**
   * 安全なScore作成
   */
  createScore: (value: number): Score =>
    Schema.decodeSync(ScoreSchema)(value),

  /**
   * 安全なStackSize作成
   */
  createStackSize: (value: number): StackSize =>
    Schema.decodeSync(StackSizeSchema)(value),

  /**
   * Default stack sizes
   */
  defaultStackSize: (): StackSize =>
    Schema.decodeSync(StackSizeSchema)(64),

  singleStack: (): StackSize =>
    Schema.decodeSync(StackSizeSchema)(1),

  /**
   * 安全なDurability作成
   */
  createDurability: (value: number): Durability =>
    Schema.decodeSync(DurabilitySchema)(value),

  /**
   * Maximum durability
   */
  maxDurability: (): Durability =>
    Schema.decodeSync(DurabilitySchema)(1000),

  /**
   * Check if item is broken
   */
  isBroken: (durability: Durability): boolean =>
    durability === 0,

  /**
   * Calculate durability percentage
   */
  durabilityPercentage: (current: Durability, max: Durability): number =>
    max === 0 ? 0 : (current / max) * 100,
} as const