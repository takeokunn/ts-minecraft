/**
 * @fileoverview Repository Strategy Configuration Errors
 *
 * リポジトリ設定構築で発生する可能性のあるエラー型定義
 */

import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'
import { RepositoryConfigBuilderStateSchema } from './config_builder_state'

/**
 * 不完全なリポジトリ設定エラー
 *
 * 必須フィールドが設定されていない状態でbuild()が呼ばれた場合に発生
 */
export const IncompleteRepositoryConfigErrorSchema = Schema.TaggedError('IncompleteRepositoryConfigError', {
  missingField: Schema.String,
  currentState: RepositoryConfigBuilderStateSchema,
  message: Schema.String,
})

export type IncompleteRepositoryConfigError = Schema.Schema.Type<typeof IncompleteRepositoryConfigErrorSchema>

export const IncompleteRepositoryConfigError = makeErrorFactory(IncompleteRepositoryConfigErrorSchema)
