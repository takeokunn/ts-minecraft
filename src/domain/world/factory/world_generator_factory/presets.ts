/**
 * @fileoverview WorldGenerator Presets - プリセット設定集
 *
 * WorldGeneratorの事前定義された設定パターンを提供します。
 * Minecraftの標準世界タイプに対応し、カスタマイズ可能な
 * 高品質なプリセットシステムを実装しています。
 *
 * ## プリセット一覧
 * - Default: 標準バランス型設定
 * - Survival: サバイバル最適化設定
 * - Creative: クリエイティブ最適化設定
 * - Peaceful: 平和な環境設定
 * - Hardcore: 高難易度設定
 * - Superflat: 平坦世界設定
 * - Amplified: 拡張地形設定
 * - Debug: 開発・デバッグ設定
 * - Custom: ユーザー定義設定
 * - Experimental: 実験的機能設定
 */

import { Effect, Function, Option, Schema } from 'effect'
import type { CreateWorldGeneratorParams, FactoryError, PresetType } from './index'

// ================================
// Preset Definition Schema
// ================================

/**
 * プリセット定義スキーマ
 * 各プリセットの構造と制約を定義
 */
export const PresetDefinitionSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  category: Schema.Literal('standard', 'specialized', 'debug', 'experimental'),
  compatibility: Schema.Struct({
    minecraftVersion: Schema.String,
    modSupport: Schema.Boolean,
    experimentalFeatures: Schema.Boolean,
  }),
  performance: Schema.Struct({
    cpuUsage: Schema.Literal('low', 'medium', 'high'),
    memoryUsage: Schema.Literal('low', 'medium', 'high'),
    recommendedThreads: Schema.Number.pipe(Schema.between(1, 16)),
  }),
  features: Schema.Struct({
    structures: Schema.Boolean,
    caves: Schema.Boolean,
    ores: Schema.Boolean,
    villages: Schema.Boolean,
    dungeons: Schema.Boolean,
  }),
  generation: CreateWorldGeneratorParams,
  metadata: Schema.Struct({
    author: Schema.String,
    version: Schema.String,
    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.DateTimeUtc,
  }),
})

export type PresetDefinition = typeof PresetDefinitionSchema.Type

// ================================
// Preset Registry
// ================================

/**
 * プリセットレジストリ
 * 全プリセットの一元管理
 */
class PresetRegistry {
  private readonly presets = new Map<PresetType, PresetDefinition>()

  register(type: PresetType, definition: PresetDefinition): void {
    this.presets.set(type, definition)
  }

  get(type: PresetType): Option.Option<PresetDefinition> {
    return Option.fromNullable(this.presets.get(type))
  }

  list(): readonly PresetType[] {
    return Array.from(this.presets.keys())
  }

  listByCategory(category: PresetDefinition['category']): readonly PresetType[] {
    return Array.from(this.presets.entries())
      .filter(([_, definition]) => definition.category === category)
      .map(([type, _]) => type)
  }
}

const registry = new PresetRegistry()

// ================================
// Standard Presets
// ================================

/**
 * Default - 標準バランス型設定
 * 最も汎用的で安定した設定
 */
const defaultPreset: PresetDefinition = {
  name: 'Default World',
  description: 'Standard balanced world generation with all features enabled',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'balanced',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Survival - サバイバル最適化設定
 * 高品質でバランスの取れたサバイバル体験
 */
const survivalPreset: PresetDefinition = {
  name: 'Survival World',
  description: 'Optimized for survival gameplay with enhanced world generation',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 2,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 2,
    cacheSize: 2000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'warn',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Creative - クリエイティブ最適化設定
 * 高速生成でクリエイティブビルド向け
 */
const creativePreset: PresetDefinition = {
  name: 'Creative World',
  description: 'Fast generation optimized for creative building',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'medium',
    recommendedThreads: 8,
  },
  features: {
    structures: true,
    caves: false,
    ores: false,
    villages: true,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 8,
    cacheSize: 1500,
    enableStructures: true,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: false,
    logLevel: 'error',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Peaceful - 平和な環境設定
 * 敵対的構造物を除外した平和な世界
 */
const peacefulPreset: PresetDefinition = {
  name: 'Peaceful World',
  description: 'Peaceful world without hostile structures',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: false,
    caves: true,
    ores: true,
    villages: true,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'balanced',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: false,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Hardcore - 高難易度設定
 * 最高品質・最高難易度の生成設定
 */
const hardcorePreset: PresetDefinition = {
  name: 'Hardcore World',
  description: 'Maximum quality generation for hardcore gameplay',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 1,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 1,
    cacheSize: 3000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'warn',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

// ================================
// Specialized Presets
// ================================

/**
 * Superflat - 平坦世界設定
 * 最小限の生成で平坦な世界
 */
const superflatPreset: PresetDefinition = {
  name: 'Superflat World',
  description: 'Flat world with minimal generation',
  category: 'specialized',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: false,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'low',
    recommendedThreads: 8,
  },
  features: {
    structures: false,
    caves: false,
    ores: false,
    villages: false,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 16,
    cacheSize: 500,
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: false,
    logLevel: 'error',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Amplified - 拡張地形設定
 * 極端な地形生成による壮大な世界
 */
const amplifiedPreset: PresetDefinition = {
  name: 'Amplified World',
  description: 'Extreme terrain generation with amplified features',
  category: 'specialized',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 1,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 1,
    cacheSize: 5000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

// ================================
// Debug & Development Presets
// ================================

/**
 * Debug - 開発・デバッグ設定
 * 開発者向け高度なデバッグ機能
 */
const debugPreset: PresetDefinition = {
  name: 'Debug World',
  description: 'Development and debugging focused generation',
  category: 'debug',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: false,
    caves: false,
    ores: false,
    villages: false,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: true,
    logLevel: 'debug',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Custom - ユーザー定義設定
 * 完全カスタマイズ可能な基本設定
 */
const customPreset: PresetDefinition = {
  name: 'Custom World',
  description: 'User-defined customizable world generation',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {},
  metadata: {
    author: 'user',
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

/**
 * Experimental - 実験的機能設定
 * 最新実験的機能をテストする設定
 */
const experimentalPreset: PresetDefinition = {
  name: 'Experimental World',
  description: 'Cutting-edge experimental features and generation',
  category: 'experimental',
  compatibility: {
    minecraftVersion: '1.21+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 2,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 2,
    cacheSize: 2000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: true,
    logLevel: 'debug',
  },
  metadata: {
    author: 'minecraft-experimental',
    version: '1.0.0-alpha',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
}

// ================================
// Registry Registration
// ================================

// 全プリセットをレジストリに登録
registry.register('default', defaultPreset)
registry.register('survival', survivalPreset)
registry.register('creative', creativePreset)
registry.register('peaceful', peacefulPreset)
registry.register('hardcore', hardcorePreset)
registry.register('superflat', superflatPreset)
registry.register('amplified', amplifiedPreset)
registry.register('debug', debugPreset)
registry.register('custom', customPreset)
registry.register('experimental', experimentalPreset)

// ================================
// Public API
// ================================

/**
 * プリセット取得
 */
export const getPreset = (type: PresetType): Effect.Effect<PresetDefinition, FactoryError> =>
  Function.pipe(
    registry.get(type),
    Option.match({
      onNone: () =>
        Effect.fail(
          new FactoryError({
            category: 'parameter_validation',
            message: `Unknown preset type: ${type}`,
          })
        ),
      onSome: (preset) => Effect.succeed(preset),
    })
  )

/**
 * プリセット生成パラメータ取得
 */
export const getPresetParams = (type: PresetType): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.map(getPreset(type), (preset) => preset.generation)

/**
 * 利用可能プリセット一覧
 */
export const listPresets = (): readonly PresetType[] => registry.list()

/**
 * カテゴリ別プリセット一覧
 */
export const listPresetsByCategory = (category: PresetDefinition['category']): readonly PresetType[] =>
  registry.listByCategory(category)

/**
 * プリセット情報取得
 */
export const getPresetInfo = (type: PresetType): Effect.Effect<Omit<PresetDefinition, 'generation'>, FactoryError> =>
  Effect.map(getPreset(type), ({ generation, ...info }) => info)

/**
 * プリセット互換性チェック
 */
export const checkPresetCompatibility = (
  type: PresetType,
  requirements: {
    minecraftVersion?: string
    needsModSupport?: boolean
    allowExperimental?: boolean
  }
): Effect.Effect<boolean, FactoryError> =>
  Effect.gen(function* () {
    const preset = yield* getPreset(type)

    // バージョンチェック（簡易実装）
    if (requirements.minecraftVersion && preset.compatibility.minecraftVersion !== requirements.minecraftVersion) {
      return false
    }

    // MODサポートチェック
    if (requirements.needsModSupport && !preset.compatibility.modSupport) {
      return false
    }

    // 実験的機能チェック
    if (!requirements.allowExperimental && preset.compatibility.experimentalFeatures) {
      return false
    }

    return true
  })

/**
 * 推奨プリセット取得
 */
export const getRecommendedPreset = (requirements: {
  performance: 'low' | 'medium' | 'high'
  quality: 'fast' | 'balanced' | 'quality'
  features: string[]
}): Effect.Effect<PresetType, FactoryError> =>
  Effect.gen(function* () {
    const allPresets = listPresets()

    // 要件に基づくスコアリング
    const scores = yield* Effect.all(
      allPresets.map((type) =>
        Effect.gen(function* () {
          const preset = yield* getPreset(type)
          let score = 0

          // パフォーマンス一致度
          if (preset.performance.cpuUsage === requirements.performance) score += 3

          // 品質一致度
          if (preset.generation.qualityLevel === requirements.quality) score += 3

          // 機能一致度
          const availableFeatures = Object.entries(preset.features)
            .filter(([_, enabled]) => enabled)
            .map(([feature, _]) => feature)

          const matchingFeatures = requirements.features.filter((feature) => availableFeatures.includes(feature))

          score += matchingFeatures.length

          return { type, score }
        })
      )
    )

    // 最高スコアのプリセットを返す
    const best = scores.reduce((max, current) => (current.score > max.score ? current : max))

    if (best.score === 0) {
      return yield* Effect.fail(
        new FactoryError({
          category: 'parameter_validation',
          message: 'No suitable preset found for requirements',
        })
      )
    }

    return best.type
  })

/**
 * カスタムプリセット作成
 */
export const createCustomPreset = (
  name: string,
  description: string,
  params: CreateWorldGeneratorParams
): Effect.Effect<PresetDefinition, FactoryError> =>
  Effect.succeed({
    name,
    description,
    category: 'standard',
    compatibility: {
      minecraftVersion: '1.20+',
      modSupport: true,
      experimentalFeatures: false,
    },
    performance: {
      cpuUsage: 'medium',
      memoryUsage: 'medium',
      recommendedThreads: 4,
    },
    features: {
      structures: params.enableStructures ?? true,
      caves: params.enableCaves ?? true,
      ores: params.enableOres ?? true,
      villages: true,
      dungeons: true,
    },
    generation: params,
    metadata: {
      author: 'user',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

// ================================
// Exports
// ================================

export { registry as PresetRegistry, type PresetDefinition }
