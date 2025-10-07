/**
 * World Factory Helper Functions
 *
 * ワールドファクトリーの便利なワークフローとユーティリティ関数を提供します。
 */

import {
  createExplorationSession,
  createQualitySession,
  createQuickSession,
} from '@/domain/world_generation/factory/generation_session_factory/index'
import {
  createFastGenerator,
  createQualityGenerator,
  createQuickGenerator,
} from '@/domain/world_generation/factory/world_generator_factory/index'
import type * as Coordinates from '@domain/world/value_object/coordinates/index'
import { Effect } from 'effect'
import { createDefaultBiomeSystem } from './biome_system_factory/index'
import { SUPPORTED_FACTORY_TYPES } from './index'
import { createQuickConfiguration } from './world_configuration_factory/index'

/**
 * 完全な世界生成セットアップ
 * Generator + Session + BiomeSystem + Configuration
 */
export const createCompleteWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
    biomeSystem: any
    configuration: any
  },
  never
> =>
  Effect.gen(function* () {
    // 並列でFactoryを実行
    const [generator, session, biomeSystem, configuration] = yield* Effect.all([
      createQuickGenerator(),
      createQuickSession(coordinates),
      createDefaultBiomeSystem(),
      createQuickConfiguration(),
    ])

    return {
      generator,
      session,
      biomeSystem,
      configuration,
    }
  })

/**
 * 高速世界生成セットアップ
 * パフォーマンス重視
 */
export const createFastWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
  },
  never
> =>
  Effect.gen(function* () {
    const [generator, session] = yield* Effect.all([createFastGenerator(), createExplorationSession(coordinates)])

    return { generator, session }
  })

/**
 * 品質重視世界生成セットアップ
 * 最高品質の生成
 */
export const createQualityWorldSetup = (
  coordinates: readonly Coordinates.ChunkCoordinate[]
): Effect.Effect<
  {
    generator: any
    session: any
    biomeSystem: any
  },
  never
> =>
  Effect.gen(function* () {
    const [generator, session, biomeSystem] = yield* Effect.all([
      createQualityGenerator(),
      createQualitySession(coordinates),
      createDefaultBiomeSystem(),
    ])

    return { generator, session, biomeSystem }
  })

/**
 * Factory統計情報取得
 */
export const getFactoryStatistics = (): Effect.Effect<
  {
    factoryCount: number
    builderCount: number
    templateCount: number
    presetCount: number
  },
  never
> =>
  Effect.succeed({
    factoryCount: SUPPORTED_FACTORY_TYPES.length,
    builderCount: 4, // 各FactoryにBuilder
    templateCount: 7, // SessionTemplateの数
    presetCount: 10, // WorldGeneratorPresetの数
  })
