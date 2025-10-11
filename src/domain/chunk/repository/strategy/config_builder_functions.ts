/**
 * RepositoryConfigBuilder Pure Functions
 *
 * RepositoryConfigBuilderの機能を純粋関数として実装
 */

import { Effect, Layer, Option } from 'effect'
import type { ChunkRepository } from '../../chunk_repository'
import type { RepositoryError } from '../../types'
import type { RepositoryConfigBuilderState } from './config_builder_state'
import { IncompleteRepositoryConfigError } from './errors'
import type { RepositoryConfig, RepositoryStrategyType } from './repository_strategy'
import { createRepositoryLayer } from './repository_strategy'

/**
 * Strategy設定
 */
export const setStrategy = (
  state: RepositoryConfigBuilderState,
  strategy: RepositoryStrategyType
): RepositoryConfigBuilderState => ({
  ...state,
  strategy,
})

/**
 * 最大メモリ使用量設定
 */
export const setMaxMemoryUsage = (state: RepositoryConfigBuilderState, mb: number): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    maxMemoryUsage: mb,
  },
})

/**
 * 優先ストレージ設定
 */
export const setPreferredStorage = (
  state: RepositoryConfigBuilderState,
  storage: 'memory' | 'persistent'
): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    preferredStorage: storage,
  },
})

/**
 * WebWorkers有効化設定
 */
export const setEnableWebWorkers = (
  state: RepositoryConfigBuilderState,
  enable: boolean = true,
  maxWorkers?: number
): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    enableWebWorkers: enable,
    maxWorkers,
  },
})

/**
 * キャッシュサイズ設定
 */
export const setCacheSize = (state: RepositoryConfigBuilderState, size: number): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    cacheSize: size,
  },
})

/**
 * 圧縮有効化設定
 */
export const setEnableCompression = (
  state: RepositoryConfigBuilderState,
  enable: boolean = true
): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    compressionEnabled: enable,
  },
})

/**
 * 暗号化有効化設定
 */
export const setEnableEncryption = (
  state: RepositoryConfigBuilderState,
  enable: boolean = true
): RepositoryConfigBuilderState => ({
  ...state,
  options: {
    ...state.options,
    encryptionEnabled: enable,
  },
})

/**
 * RepositoryConfig構築
 */
export const buildConfig = (
  state: RepositoryConfigBuilderState
): Effect.Effect<RepositoryConfig, IncompleteRepositoryConfigError> =>
  Option.fromNullable(state.strategy).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          new IncompleteRepositoryConfigError({
            missingField: 'strategy',
            currentState: state,
            message: 'リポジトリ戦略が設定されていません。build()を呼ぶ前にsetStrategy()を実行してください',
          })
        ),
      onSome: () => Effect.succeed(state as RepositoryConfig),
    })
  )

/**
 * Layer構築
 */
export const buildLayer = (
  state: RepositoryConfigBuilderState
): Effect.Effect<Layer.Layer<ChunkRepository, RepositoryError>, IncompleteRepositoryConfigError> =>
  buildConfig(state).pipe(Effect.map((config) => createRepositoryLayer(config.strategy)))
