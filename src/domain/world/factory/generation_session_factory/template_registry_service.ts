/**
 * @fileoverview SessionTemplateRegistry Service Interface
 *
 * セッションテンプレートレジストリのEffect Serviceインターフェース定義
 */

import { Context, Effect, Option } from 'effect'
import type { SessionTemplateDefinition, SessionTemplateType } from './index'

/**
 * セッションテンプレートレジストリサービス
 * テンプレート定義の登録・取得を提供
 */
export interface SessionTemplateRegistryService {
  /**
   * ビルトインテンプレートを登録
   */
  readonly register: (type: SessionTemplateType, definition: SessionTemplateDefinition) => Effect.Effect<void>

  /**
   * カスタムテンプレートを登録
   */
  readonly registerCustom: (name: string, definition: SessionTemplateDefinition) => Effect.Effect<void>

  /**
   * ビルトインテンプレートを取得
   */
  readonly get: (type: SessionTemplateType) => Effect.Effect<Option.Option<SessionTemplateDefinition>>

  /**
   * カスタムテンプレートを取得
   */
  readonly getCustom: (name: string) => Effect.Effect<Option.Option<SessionTemplateDefinition>>

  /**
   * ビルトインテンプレート一覧を取得
   */
  readonly list: Effect.Effect<ReadonlyArray<SessionTemplateType>>

  /**
   * カスタムテンプレート一覧を取得
   */
  readonly listCustom: Effect.Effect<ReadonlyArray<string>>

  /**
   * カテゴリ別テンプレート一覧を取得
   */
  readonly listByCategory: (
    category: SessionTemplateDefinition['category']
  ) => Effect.Effect<ReadonlyArray<SessionTemplateType>>

  /**
   * テンプレート検索
   */
  readonly search: (query: {
    readonly useCases?: ReadonlyArray<string>
    readonly performance?: Partial<SessionTemplateDefinition['performance']>
    readonly requirements?: Partial<SessionTemplateDefinition['requirements']>
    readonly tags?: ReadonlyArray<string>
  }) => Effect.Effect<ReadonlyArray<SessionTemplateType>>
}

/**
 * SessionTemplateRegistryService Context Tag
 */
export const SessionTemplateRegistryService = Context.GenericTag<SessionTemplateRegistryService>(
  '@minecraft/domain/world/factory/SessionTemplateRegistryService'
)
