/**
 * ECS System基盤 - システム実行と管理のインターフェース
 *
 * Entity-Component-Systemアーキテクチャのシステム層を定義
 * Effect-TSを使用した関数型でコンポジタブルな実装
 */

import { Clock, Context, Data, Effect, Match, Option, pipe, Schema } from 'effect'
import { ErrorCauseSchema, toErrorCause } from '@/shared/schema/error'
import type { ErrorCause } from '@/shared/schema/error'

/**
 * システムエラー - ECSシステム実行時のエラー
 */
export const SystemError = Data.tagged<{
  readonly systemName: string
  readonly message: string
  readonly cause: Option.Option<ErrorCause>
}>('SystemError')

export type SystemError = ReturnType<typeof SystemError>

export const makeSystemError = (
  systemName: string,
  message: string,
  cause?: unknown
): SystemError =>
  SystemError({ systemName, message, cause: Option.fromNullable(toErrorCause(cause)) })

export const isSystemError = (error: unknown): error is SystemError =>
  typeof error === 'object' && error !== null && (error as { readonly _tag?: string })._tag === 'SystemError'

/**
 * システムの優先度レベル
 * 小さい値ほど先に実行される
 */
export const SystemPriority = Schema.Literal(
  'critical', // 0-99: 最優先（物理演算前処理など）
  'high', // 100-299: 高優先度（入力処理など）
  'normal', // 300-699: 通常優先度（ゲームロジック）
  'low', // 700-899: 低優先度（AI処理など）
  'deferred' // 900-999: 遅延実行（描画、後処理など）
)

export type SystemPriority = Schema.Schema.Type<typeof SystemPriority>

/**
 * 優先度を数値に変換
 */
export const priorityToNumber = (priority: SystemPriority): number =>
  pipe(
    priority,
    Match.value,
    Match.when('critical', () => 50),
    Match.when('high', () => 200),
    Match.when('normal', () => 500),
    Match.when('low', () => 800),
    Match.when('deferred', () => 950),
    Match.exhaustive
  )

/**
 * システムメタデータ
 */
export const SystemMetadata = Schema.Struct({
  name: Schema.String,
  priority: SystemPriority,
  enabled: Schema.Boolean,
  order: Schema.Number, // 同じ優先度内での実行順序
})

export type SystemMetadata = Schema.Schema.Type<typeof SystemMetadata>

/**
 * ECSシステムインターフェース
 * ゲームループ内で実行される処理単位を定義
 */
export interface System<Context = Record<string, never>> {
  readonly name: string
  readonly update: (context: Context, deltaTime: number) => Effect.Effect<void, SystemError>
}

/**
 * システムサービス - DIコンテナ用のタグ
 */
export const System = Context.GenericTag<System<Record<string, never>>>( '@minecraft/infrastructure/System')

/**
 * システム作成ヘルパー
 * 簡潔なシステム定義を可能にする
 */
export const createSystem = <Context>(
  name: string,
  update: (context: Context, deltaTime: number) => Effect.Effect<void, SystemError>
): System<Context> => ({
  name,
  update,
})

/**
 * システム実行の合成
 * 複数のシステムを順次実行する
 */
export const runSystems = <Context>(
  systems: readonly System<Context>[],
  world: Context,
  deltaTime: number
): Effect.Effect<void, SystemError> =>
  Effect.forEach(
    systems,
    (system) =>
      system.update(world, deltaTime).pipe(
        Effect.mapError((error) =>
          isSystemError(error) ? error : makeSystemError(system.name, 'Unknown error in system execution', error)
        ),
        Effect.tapError((error) => Effect.logError(`System ${error.systemName} failed: ${error.message}`))
      ),
    { concurrency: 1 }
  ).pipe(Effect.asVoid)

/**
 * パフォーマンス計測付きシステム実行
 */
export const runSystemWithMetrics = <Context>(
  system: System<Context>,
  world: Context,
  deltaTime: number
): Effect.Effect<{ readonly duration: number }, SystemError> =>
  Effect.gen(function* () {
    const startTime = yield* Clock.currentTimeMillis
    yield* system.update(world, deltaTime)
    const endTime = yield* Clock.currentTimeMillis
    const duration = endTime - startTime

    // パフォーマンス警告（16ms = 60FPS基準）
    yield* pipe(
      duration > 16,
      Match.value,
      Match.when(true, () => Effect.logWarning(`System ${system.name} took ${duration}ms (target: <16ms for 60FPS)`)),
      Match.when(false, () => Effect.void),
      Match.exhaustive
    )

    return { duration }
  })

/**
 * テスト用のモックシステム作成
 */
export const createMockSystem = <Context>(
  name: string,
  behavior: Effect.Effect<void, SystemError> = Effect.void
): System<Context> => ({
  name,
  update: () => behavior,
})

/**
 * システム実行状態
 */
export const SystemExecutionState = Schema.Struct({
  systemName: Schema.String,
  executionCount: Schema.Number,
  totalDuration: Schema.Number,
  averageDuration: Schema.Number,
  maxDuration: Schema.Number,
  lastExecutionTime: Schema.Number,
  errors: Schema.Array(Schema.String),
})

export type SystemExecutionState = Schema.Schema.Type<typeof SystemExecutionState>
