/**
 * RepositoryConfigBuilder State Schema
 *
 * RepositoryConfigBuilderの状態を表すSchema定義
 * Builderパターンの状態管理を純粋関数化
 */

import { Schema } from 'effect'

/**
 * RepositoryConfigBuilder状態Schema
 */
export const RepositoryConfigBuilderStateSchema = Schema.Struct({
  strategy: Schema.optional(Schema.String),
  options: Schema.optional(
    Schema.Struct({
      maxMemoryUsage: Schema.optional(Schema.Number),
      preferredStorage: Schema.optional(Schema.Literal('memory', 'persistent')),
      enableWebWorkers: Schema.optional(Schema.Boolean),
      maxWorkers: Schema.optional(Schema.Number),
      cacheSize: Schema.optional(Schema.Number),
      compressionEnabled: Schema.optional(Schema.Boolean),
      encryptionEnabled: Schema.optional(Schema.Boolean),
    })
  ),
})

/**
 * RepositoryConfigBuilder状態型
 */
export type RepositoryConfigBuilderState = Schema.Schema.Type<typeof RepositoryConfigBuilderStateSchema>

/**
 * 初期状態
 */
export const initialRepositoryConfigBuilderState: RepositoryConfigBuilderState = {}
