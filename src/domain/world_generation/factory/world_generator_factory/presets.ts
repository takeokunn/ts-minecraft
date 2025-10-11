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

import { DateTime, Effect, Function, Match, Option, Schema } from 'effect'
import type { CreateWorldGeneratorParams, FactoryError, PresetType } from './index'
import { PresetRegistryService } from './preset_registry_service'

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
// Standard Presets (Moved to preset_initialization_live.ts)
// ================================
// Note: プリセット定義と初期化は preset_initialization_live.ts に移動しました

// ================================
// Public API
// ================================

/**
 * プリセット取得
 */
export const getPreset = (type: PresetType): Effect.Effect<PresetDefinition, FactoryError> =>
  Effect.gen(function* () {
    const registry = yield* PresetRegistryService
    const result = yield* registry.get(type)

    return yield* Function.pipe(
      result,
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
  })

/**
 * プリセット生成パラメータ取得
 */
export const getPresetParams = (type: PresetType): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.map(getPreset(type), (preset) => preset.generation)

/**
 * 利用可能プリセット一覧
 */
export const listPresets = (): Effect.Effect<readonly PresetType[]> =>
  Effect.gen(function* () {
    const registry = yield* PresetRegistryService
    return yield* registry.list
  })

/**
 * カテゴリ別プリセット一覧
 */
export const listPresetsByCategory = (category: PresetDefinition['category']): Effect.Effect<readonly PresetType[]> =>
  Effect.gen(function* () {
    const registry = yield* PresetRegistryService
    return yield* registry.listByCategory(category)
  })

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

    // 互換性チェック（Match.whenチェーン）
    const isCompatible = Function.pipe(
      Match.value({ preset, requirements }),
      Match.when(
        ({ preset, requirements }) =>
          requirements.minecraftVersion && preset.compatibility.minecraftVersion !== requirements.minecraftVersion,
        () => false
      ),
      Match.when(
        ({ preset, requirements }) => requirements.needsModSupport && !preset.compatibility.modSupport,
        () => false
      ),
      Match.when(
        ({ preset, requirements }) => !requirements.allowExperimental && preset.compatibility.experimentalFeatures,
        () => false
      ),
      Match.orElse(() => true)
    )

    return isCompatible
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

          const performanceScore = preset.performance.cpuUsage === requirements.performance ? 3 : 0
          const qualityScore = preset.generation.qualityLevel === requirements.quality ? 3 : 0

          const availableFeatures = Object.entries(preset.features)
            .filter(([_, enabled]) => enabled)
            .map(([feature, _]) => feature)

          const matchingFeatures = requirements.features.filter((feature) => availableFeatures.includes(feature))
          const featureScore = matchingFeatures.length

          const score = performanceScore + qualityScore + featureScore

          return { type, score }
        })
      )
    )

    // 最高スコアのプリセットを返す
    const best = scores.reduce((max, current) => (current.score > max.score ? current : max))

    yield* Function.pipe(
      Match.value(best.score),
      Match.when(0, () =>
        Effect.fail(
          new FactoryError({
            category: 'parameter_validation',
            message: 'No suitable preset found for requirements',
          })
        )
      ),
      Match.orElse(() => Effect.void)
    )

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
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate
    return {
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
        createdAt: now,
        updatedAt: now,
      },
    }
  })

// ================================
// Exports
// ================================

export { PresetSystemLive } from './preset_initialization_live'
export { PresetRegistryLive } from './preset_registry_live'
export { PresetRegistryService } from './preset_registry_service'
export type { PresetDefinition }
