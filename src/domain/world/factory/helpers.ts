/**
 * World Factory Helper Functions
 *
 * ワールドファクトリーの便利なワークフローとユーティリティ関数を提供します。
 */

import { Effect } from 'effect'
import { SUPPORTED_FACTORY_TYPES } from './index'

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
