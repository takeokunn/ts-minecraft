import { JsonRecordSchema, JsonValueSchema, type JsonRecord, type JsonValue } from '@shared/schema/json'
import { Clock, Context, Effect, Layer, Match, Option, pipe, Ref, Schema } from 'effect'

/**
 * Error Recovery Service
 *
 * ワールド生成中のエラーからの自動回復機能を提供します。
 * 段階的回復戦略とフォールバック機能により、生成プロセスの継続性を保証します。
 */

// === Recovery Strategy Types ===

export const RecoveryStrategy = Schema.Union(
  Schema.Literal('retry'), // 単純再試行
  Schema.Literal('fallback'), // フォールバック実行
  Schema.Literal('skip'), // スキップして続行
  Schema.Literal('abort'), // 処理中断
  Schema.Literal('checkpoint_restore') // チェックポイント復元
)

export const RecoveryAction = Schema.Struct({
  _tag: Schema.Literal('RecoveryAction'),
  strategy: RecoveryStrategy,
  maxAttempts: Schema.Number.pipe(Schema.positive(), Schema.int()),
  backoffMs: Schema.Number.pipe(Schema.positive()),
  fallbackConfig: Schema.optional(JsonRecordSchema),
  conditions: Schema.Array(Schema.String), // 実行条件
  timeout: Schema.Number.pipe(Schema.positive()),
})

export const ErrorClassification = Schema.Union(
  Schema.Literal('transient'), // 一時的エラー（再試行可能）
  Schema.Literal('permanent'), // 永続的エラー（設定変更必要）
  Schema.Literal('resource'), // リソース不足エラー
  Schema.Literal('validation'), // 検証エラー
  Schema.Literal('timeout'), // タイムアウトエラー
  Schema.Literal('unknown') // 未分類エラー
)

export const ErrorContext = Schema.Struct({
  _tag: Schema.Literal('ErrorContext'),
  errorId: Schema.String,
  classification: ErrorClassification,
  severity: Schema.Union(
    Schema.Literal('low'),
    Schema.Literal('medium'),
    Schema.Literal('high'),
    Schema.Literal('critical')
  ),
  stage: Schema.String,
  timestamp: Schema.Number,
  retryCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  previousAttempts: Schema.Array(
    Schema.Struct({
      attempt: Schema.Number,
      strategy: RecoveryStrategy,
      result: Schema.Union(Schema.Literal('success'), Schema.Literal('failure'), Schema.Literal('partial')),
      duration: Schema.Number,
      errorMessage: Schema.optional(Schema.String),
    })
  ),
  metadata: Schema.Record(Schema.String, JsonValueSchema),
})

// === Recovery Configuration ===

export const RecoveryConfiguration = Schema.Struct({
  _tag: Schema.Literal('RecoveryConfiguration'),
  globalMaxRetries: Schema.Number.pipe(Schema.positive(), Schema.int()),
  globalTimeout: Schema.Number.pipe(Schema.positive()),
  errorClassificationRules: Schema.Record(Schema.String, ErrorClassification),
  recoveryStrategies: Schema.Record(ErrorClassification, RecoveryAction),
  circuitBreakerConfig: Schema.Struct({
    enabled: Schema.Boolean,
    failureThreshold: Schema.Number.pipe(Schema.positive(), Schema.int()),
    recoveryTimeout: Schema.Number.pipe(Schema.positive()),
    halfOpenMaxCalls: Schema.Number.pipe(Schema.positive(), Schema.int()),
  }),
  alertingConfig: Schema.Struct({
    enabled: Schema.Boolean,
    severityThreshold: Schema.Union(
      Schema.Literal('low'),
      Schema.Literal('medium'),
      Schema.Literal('high'),
      Schema.Literal('critical')
    ),
    channels: Schema.Array(Schema.String),
  }),
})

// === Circuit Breaker State ===

export const CircuitBreakerState = Schema.Union(
  Schema.Literal('closed'), // 正常状態
  Schema.Literal('open'), // 遮断状態
  Schema.Literal('half_open') // 半開状態
)

export const CircuitBreaker = Schema.Struct({
  _tag: Schema.Literal('CircuitBreaker'),
  id: Schema.String,
  state: CircuitBreakerState,
  failureCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  lastFailureTime: Schema.optional(Schema.Number),
  successCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  nextRetryTime: Schema.optional(Schema.Number),
})

// === Recovery Error ===

export const ErrorRecoveryServiceError = Schema.TaggedError<ErrorRecoveryServiceErrorType>()(
  'ErrorRecoveryServiceError',
  {
    message: Schema.String,
    recoveryId: Schema.String,
    errorContext: Schema.optional(JsonRecordSchema),
    cause: Schema.optional(JsonValueSchema),
  }
)

export interface ErrorRecoveryServiceErrorType extends Schema.Schema.Type<typeof ErrorRecoveryServiceError> {}

type RecoveryContextData = JsonRecord

type CheckpointState = JsonRecord

type RecoveryResult = JsonValue

type RecoveryTask = Effect.Effect<RecoveryResult, never>

type RecoveryStatistics = {
  readonly totalErrors: number
  readonly errorsByClassification: Partial<Record<Schema.Schema.Type<typeof ErrorClassification>, number>>
  readonly averageRetryCount: number
  readonly circuitBreakerStates: Partial<Record<Schema.Schema.Type<typeof CircuitBreaker>['state'], number>>
  readonly successfulRecoveries: number
}

// === Service Interface ===

export interface ErrorRecoveryService {
  /**
   * エラーを分類します
   */
  readonly classifyError: (
    error: Error,
    context: RecoveryContextData
  ) => Effect.Effect<ErrorClassification, ErrorRecoveryServiceErrorType>

  /**
   * 回復戦略を決定します
   */
  readonly determineRecoveryStrategy: (
    errorContext: Schema.Schema.Type<typeof ErrorContext>
  ) => Effect.Effect<Schema.Schema.Type<typeof RecoveryAction>, ErrorRecoveryServiceErrorType>

  /**
   * エラーから回復を試行します
   */
  readonly attemptRecovery: (
    errorContext: Schema.Schema.Type<typeof ErrorContext>,
    recoveryAction: Schema.Schema.Type<typeof RecoveryAction>,
    originalTask: RecoveryTask
  ) => Effect.Effect<RecoveryResult, ErrorRecoveryServiceErrorType>

  /**
   * チェックポイントを作成します
   */
  readonly createCheckpoint: (id: string, state: CheckpointState) => Effect.Effect<void, ErrorRecoveryServiceErrorType>

  /**
   * チェックポイントから復元します
   */
  readonly restoreFromCheckpoint: (id: string) => Effect.Effect<CheckpointState, ErrorRecoveryServiceErrorType>

  /**
   * サーキットブレーカーの状態を取得します
   */
  readonly getCircuitBreakerState: (
    id: string
  ) => Effect.Effect<Schema.Schema.Type<typeof CircuitBreaker>, ErrorRecoveryServiceErrorType>

  /**
   * サーキットブレーカーを実行します
   */
  readonly executeWithCircuitBreaker: <A, E>(
    id: string,
    task: Effect.Effect<A, E>
  ) => Effect.Effect<A, E | ErrorRecoveryServiceErrorType>

  /**
   * 回復統計を取得します
   */
  readonly getRecoveryStatistics: () => Effect.Effect<RecoveryStatistics, ErrorRecoveryServiceErrorType>

  /**
   * エラー履歴を取得します
   */
  readonly getErrorHistory: (
    limit?: number
  ) => Effect.Effect<Schema.Schema.Type<typeof ErrorContext>[], ErrorRecoveryServiceErrorType>
}

// === Live Implementation ===

const makeErrorRecoveryService = Effect.gen(function* () {
  // 内部状態管理
  const checkpoints = yield* Ref.make<Map<string, CheckpointState>>(new Map())
  const circuitBreakers = yield* Ref.make<Map<string, Schema.Schema.Type<typeof CircuitBreaker>>>(new Map())
  const errorHistory = yield* Ref.make<Schema.Schema.Type<typeof ErrorContext>[]>([])
  const recoveryConfig = yield* Ref.make<Schema.Schema.Type<typeof RecoveryConfiguration>>(DEFAULT_RECOVERY_CONFIG)

  const classifyError = (error: Error, context: RecoveryContextData) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(recoveryConfig)

      // エラーメッセージパターンマッチング
      const classification = Match.value(error.message).pipe(
        Match.when(
          (msg) => msg.includes('timeout'),
          () => 'timeout' as const
        ),
        Match.when(
          (msg) => msg.includes('memory'),
          () => 'resource' as const
        ),
        Match.when(
          (msg) => msg.includes('validation'),
          () => 'validation' as const
        ),
        Match.when(
          (msg) => msg.includes('network'),
          () => 'transient' as const
        ),
        Match.orElse(() => 'unknown' as const)
      )

      yield* Effect.logDebug(`エラー分類: ${error.message} -> ${classification}`)
      return classification
    })

  const determineRecoveryStrategy = (errorContext: Schema.Schema.Type<typeof ErrorContext>) =>
    Effect.gen(function* () {
      const config = yield* Ref.get(recoveryConfig)

      const strategy = yield* pipe(
        Option.fromNullable(config.recoveryStrategies[errorContext.classification]),
        Option.match({
          onNone: () =>
            Effect.fail({
              _tag: 'ErrorRecoveryServiceError' as const,
              message: `回復戦略が見つかりません: ${errorContext.classification}`,
              recoveryId: errorContext.errorId,
              errorContext,
            }),
          onSome: (strat) => Effect.succeed(strat),
        })
      )

      const adjustedStrategy = yield* pipe(
        Match.value(errorContext.retryCount >= strategy.maxAttempts),
        Match.when(
          (exceeded) => exceeded,
          () =>
            Effect.succeed({
              ...strategy,
              strategy: 'fallback' as const,
              maxAttempts: 1,
            })
        ),
        Match.orElse(() => Effect.succeed(strategy))
      )

      yield* Effect.logInfo(`回復戦略決定: ${errorContext.classification} -> ${adjustedStrategy.strategy}`)
      return adjustedStrategy
    })

  const attemptRecovery = (
    errorContext: Schema.Schema.Type<typeof ErrorContext>,
    recoveryAction: Schema.Schema.Type<typeof RecoveryAction>,
    originalTask: RecoveryTask
  ) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`回復試行開始: ${recoveryAction.strategy} (試行 ${errorContext.retryCount + 1})`)

      const startTime = yield* Clock.currentTimeMillis

      const result = yield* Match.value(recoveryAction.strategy).pipe(
        Match.when('retry', () => executeRetryStrategy(originalTask, recoveryAction)),
        Match.when('fallback', () => executeFallbackStrategy(errorContext, recoveryAction)),
        Match.when('skip', () => executeSkipStrategy()),
        Match.when('abort', () => executeAbortStrategy(errorContext)),
        Match.when('checkpoint_restore', () => executeCheckpointRestoreStrategy(errorContext)),
        Match.exhaustive
      )

      const duration = yield* Clock.currentTimeMillis - startTime

      // 回復試行履歴更新
      const updatedContext: Schema.Schema.Type<typeof ErrorContext> = {
        ...errorContext,
        retryCount: errorContext.retryCount + 1,
        previousAttempts: [
          ...errorContext.previousAttempts,
          {
            attempt: errorContext.retryCount + 1,
            strategy: recoveryAction.strategy,
            result: 'success',
            duration,
          },
        ],
      }

      yield* Ref.update(errorHistory, (history) =>
        history.map((ctx) => (ctx.errorId === errorContext.errorId ? updatedContext : ctx))
      )

      yield* Effect.logInfo(`回復試行完了: ${recoveryAction.strategy} (${duration}ms)`)
      return result
    })

  const createCheckpoint = (id: string, state: CheckpointState) =>
    Effect.gen(function* () {
      yield* Ref.update(checkpoints, (map) => map.set(id, structuredClone(state) satisfies CheckpointState))
      yield* Effect.logDebug(`チェックポイント作成: ${id}`)
    })

  const restoreFromCheckpoint = (id: string) =>
    Effect.gen(function* () {
      const checkpointMap = yield* Ref.get(checkpoints)

      return yield* pipe(
        Option.fromNullable(checkpointMap.get(id)),
        Option.match({
          onNone: () =>
            Effect.fail({
              _tag: 'ErrorRecoveryServiceError' as const,
              message: `チェックポイントが見つかりません: ${id}`,
              recoveryId: id,
            }),
          onSome: (checkpoint) =>
            Effect.gen(function* () {
              yield* Effect.logInfo(`チェックポイントから復元: ${id}`)
              return structuredClone(checkpoint) satisfies CheckpointState
            }),
        })
      )
    })

  const getCircuitBreakerState = (id: string) =>
    Effect.gen(function* () {
      const breakerMap = yield* Ref.get(circuitBreakers)

      return yield* pipe(
        Option.fromNullable(breakerMap.get(id)),
        Option.match({
          onNone: () =>
            Effect.gen(function* () {
              const newBreaker: Schema.Schema.Type<typeof CircuitBreaker> = {
                _tag: 'CircuitBreaker',
                id,
                state: 'closed',
                failureCount: 0,
                successCount: 0,
              }
              yield* Ref.update(circuitBreakers, (map) => map.set(id, newBreaker))
              return newBreaker
            }),
          onSome: (breaker) => Effect.succeed(breaker),
        })
      )
    })

  const executeWithCircuitBreaker = <A, E>(id: string, task: Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      const breaker = yield* getCircuitBreakerState(id)
      const config = yield* Ref.get(recoveryConfig)

      // サーキットブレーカー状態チェック
      yield* Match.value(breaker.state).pipe(
        Match.when('open', () =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis
            yield* pipe(
              Option.fromNullable(breaker.nextRetryTime),
              Option.match({
                onNone: () => Effect.void,
                onSome: (retryTime) =>
                  pipe(
                    Match.value(now < retryTime),
                    Match.when(
                      (shouldBlock) => shouldBlock,
                      () =>
                        Effect.fail<never, ErrorRecoveryServiceErrorType>({
                          _tag: 'ErrorRecoveryServiceError',
                          message: `サーキットブレーカーが開いています: ${id}`,
                          recoveryId: id,
                        })
                    ),
                    Match.orElse(() => Effect.void)
                  ),
              })
            )
            // 半開状態に移行
            yield* updateCircuitBreakerState(id, { state: 'half_open', successCount: 0 })
          })
        ),
        Match.orElse(() => Effect.void)
      )

      return yield* pipe(
        task,
        Effect.tap(() =>
          Match.value(breaker.state).pipe(
            Match.when('half_open', () =>
              Effect.gen(function* () {
                const newSuccessCount = breaker.successCount + 1
                const shouldClose = newSuccessCount >= config.circuitBreakerConfig.halfOpenMaxCalls

                yield* pipe(
                  Match.value(shouldClose),
                  Match.when(
                    (close) => close,
                    () =>
                      updateCircuitBreakerState(id, {
                        state: 'closed',
                        failureCount: 0,
                        successCount: 0,
                      })
                  ),
                  Match.orElse(() => updateCircuitBreakerState(id, { successCount: newSuccessCount }))
                )
              })
            ),
            Match.orElse(() => Effect.void)
          )
        ),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            const newFailureCount = breaker.failureCount + 1
            const shouldOpen = newFailureCount >= config.circuitBreakerConfig.failureThreshold

            yield* pipe(
              Match.value(shouldOpen),
              Match.when(
                (open) => open,
                () =>
                  Effect.gen(function* () {
                    const timestamp = yield* Clock.currentTimeMillis
                    return yield* updateCircuitBreakerState(id, {
                      state: 'open',
                      failureCount: newFailureCount,
                      lastFailureTime: timestamp,
                      nextRetryTime: timestamp,
                    })
                  })
              ),
              Match.orElse(() => updateCircuitBreakerState(id, { failureCount: newFailureCount }))
            )

            return yield* Effect.fail(error)
          })
        )
      )
    })

  const getRecoveryStatistics = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(errorHistory)
      const breakers = yield* Ref.get(circuitBreakers)

      const stats: RecoveryStatistics = {
        totalErrors: history.length,
        errorsByClassification: history.reduce(
          (acc, ctx) => {
            acc[ctx.classification] = (acc[ctx.classification] || 0) + 1
            return acc
          },
          {} satisfies Partial<Record<Schema.Schema.Type<typeof ErrorClassification>, number>>
        ),
        averageRetryCount: pipe(history.length > 0, (hasHistory) =>
          hasHistory ? history.reduce((sum, ctx) => sum + ctx.retryCount, 0) / history.length : 0
        ),
        circuitBreakerStates: Array.from(breakers.values()).reduce(
          (acc, breaker) => {
            acc[breaker.state] = (acc[breaker.state] || 0) + 1
            return acc
          },
          {} as Partial<Record<Schema.Schema.Type<typeof CircuitBreaker>['state'], number>>
        ),
        successfulRecoveries: history.filter((ctx) =>
          ctx.previousAttempts.some((attempt) => attempt.result === 'success')
        ).length,
      }

      return stats
    })

  const getErrorHistory = (limit: number = 100) =>
    Effect.gen(function* () {
      const history = yield* Ref.get(errorHistory)
      return history.slice(-limit)
    })

  // === Helper Functions ===

  const updateCircuitBreakerState = (id: string, update: Partial<Schema.Schema.Type<typeof CircuitBreaker>>) =>
    Ref.update(circuitBreakers, (map) =>
      pipe(
        Option.fromNullable(map.get(id)),
        Option.match({
          onNone: () => map,
          onSome: (current) => {
            map.set(id, { ...current, ...update })
            return map
          },
        })
      )
    )

  const executeRetryStrategy = (task: RecoveryTask, action: Schema.Schema.Type<typeof RecoveryAction>) =>
    pipe(
      task,
      Effect.retry({
        times: action.maxAttempts - 1,
        schedule: Effect.Schedule.exponential(`${action.backoffMs} millis`),
      })
    )

  const executeFallbackStrategy = (
    errorContext: Schema.Schema.Type<typeof ErrorContext>,
    action: Schema.Schema.Type<typeof RecoveryAction>
  ) =>
    Effect.gen(function* () {
      yield* Effect.logWarning(`フォールバック実行: ${errorContext.errorId}`)
      const timestamp = yield* Clock.currentTimeMillis
      // 最小限の結果を返す
      return { fallback: true, stage: errorContext.stage, timestamp }
    })

  const executeSkipStrategy = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('ステージスキップ実行')
      const timestamp = yield* Clock.currentTimeMillis
      return { skipped: true, timestamp }
    })

  const executeAbortStrategy = (errorContext: Schema.Schema.Type<typeof ErrorContext>) =>
    Effect.fail({
      _tag: 'ErrorRecoveryServiceError' as const,
      message: `処理中断: ${errorContext.errorId}`,
      recoveryId: errorContext.errorId,
      errorContext,
    })

  const executeCheckpointRestoreStrategy = (errorContext: Schema.Schema.Type<typeof ErrorContext>) =>
    Effect.gen(function* () {
      const checkpointId = `${errorContext.stage}_checkpoint`
      return yield* restoreFromCheckpoint(checkpointId)
    })

  return ErrorRecoveryService.of({
    classifyError,
    determineRecoveryStrategy,
    attemptRecovery,
    createCheckpoint,
    restoreFromCheckpoint,
    getCircuitBreakerState,
    executeWithCircuitBreaker,
    getRecoveryStatistics,
    getErrorHistory,
  })
})

// === Context Tag ===

export const ErrorRecoveryService = Context.GenericTag<ErrorRecoveryService>(
  '@minecraft/domain/world/ErrorRecoveryService'
)

// === Layer ===

export const ErrorRecoveryServiceLive = Layer.effect(ErrorRecoveryService, makeErrorRecoveryService)

// === Default Configuration ===

export const DEFAULT_RECOVERY_CONFIG: Schema.Schema.Type<typeof RecoveryConfiguration> = {
  _tag: 'RecoveryConfiguration',
  globalMaxRetries: 5,
  globalTimeout: 60000, // 1分
  errorClassificationRules: {
    timeout: 'timeout',
    memory: 'resource',
    validation: 'validation',
    network: 'transient',
  },
  recoveryStrategies: {
    transient: {
      _tag: 'RecoveryAction',
      strategy: 'retry',
      maxAttempts: 3,
      backoffMs: 1000,
      conditions: [],
      timeout: 30000,
    },
    resource: {
      _tag: 'RecoveryAction',
      strategy: 'fallback',
      maxAttempts: 2,
      backoffMs: 2000,
      conditions: [],
      timeout: 45000,
    },
    validation: {
      _tag: 'RecoveryAction',
      strategy: 'skip',
      maxAttempts: 1,
      backoffMs: 0,
      conditions: [],
      timeout: 10000,
    },
    timeout: {
      _tag: 'RecoveryAction',
      strategy: 'retry',
      maxAttempts: 2,
      backoffMs: 5000,
      conditions: [],
      timeout: 60000,
    },
    permanent: {
      _tag: 'RecoveryAction',
      strategy: 'abort',
      maxAttempts: 1,
      backoffMs: 0,
      conditions: [],
      timeout: 5000,
    },
    unknown: {
      _tag: 'RecoveryAction',
      strategy: 'checkpoint_restore',
      maxAttempts: 1,
      backoffMs: 1000,
      conditions: [],
      timeout: 20000,
    },
  },
  circuitBreakerConfig: {
    enabled: true,
    failureThreshold: 5,
    recoveryTimeout: 30000,
    halfOpenMaxCalls: 3,
  },
  alertingConfig: {
    enabled: true,
    severityThreshold: 'medium',
    channels: ['log'],
  },
}

export type {
  CircuitBreaker as CircuitBreakerType,
  ErrorContext as ErrorContextType,
  RecoveryAction as RecoveryActionType,
  RecoveryConfiguration as RecoveryConfigurationType,
  RecoveryStrategy as RecoveryStrategyType,
} from './error_recovery'
