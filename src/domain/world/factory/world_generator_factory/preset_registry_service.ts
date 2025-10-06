/**
 * @fileoverview PresetRegistry Service Interface
 *
 * プリセットレジストリのEffect Serviceインターフェース定義
 */

import { Context, Effect, Option } from 'effect'
import type { PresetType } from './index'
import type { PresetDefinition } from './presets'

/**
 * プリセットレジストリサービス
 * プリセット定義の登録・取得を提供
 */
export interface PresetRegistryService {
  /**
   * プリセットを登録
   */
  readonly register: (type: PresetType, definition: PresetDefinition) => Effect.Effect<void>

  /**
   * プリセットを取得
   */
  readonly get: (type: PresetType) => Effect.Effect<Option.Option<PresetDefinition>>

  /**
   * 登録済みプリセット一覧を取得
   */
  readonly list: Effect.Effect<readonly PresetType[]>

  /**
   * カテゴリ別プリセット一覧を取得
   */
  readonly listByCategory: (category: PresetDefinition['category']) => Effect.Effect<readonly PresetType[]>
}

/**
 * PresetRegistryService Context Tag
 */
export const PresetRegistryService = Context.GenericTag<PresetRegistryService>(
  '@minecraft/domain/world/factory/PresetRegistryService'
)
