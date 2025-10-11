/**
 * @fileoverview Repository Strategy Configuration Errors
 *
 * リポジトリ設定構築で発生する可能性のあるエラー型定義
 */

import { Schema } from 'effect'

/**
 * 不完全なリポジトリ設定エラー
 *
 * 必須フィールドが設定されていない状態でbuild()が呼ばれた場合に発生
 */
export class IncompleteRepositoryConfigError extends Schema.TaggedError<IncompleteRepositoryConfigError>()(
  'IncompleteRepositoryConfigError',
  {
    missingField: Schema.String,
    currentState: Schema.Unknown,
    message: Schema.String,
  }
) {}
