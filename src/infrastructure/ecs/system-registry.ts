/**
 * ECS SystemRegistry - システムの登録と管理
 *
 * システムの動的な登録、削除、優先度管理を提供
 * Effect-TSのRefを使用した安全な状態管理
 */

import { toErrorCause, type ErrorCause } from '@shared/schema/error'
import { Clock, Context, Data, Effect, Layer, Match, Option, pipe, Ref } from 'effect'
import type { System, SystemError, SystemMetadata, SystemPriority } from './system'
import { isSystemError, makeSystemError, priorityToNumber, SystemExecutionState } from './system'

/**
 * システムレジストリエラー
 */
export const SystemRegistryError = Data.tagged<{
  readonly message: string
  readonly systemName: Option.Option<string>
  readonly cause: Option.Option<ErrorCause>
}>('SystemRegistryError')

export type SystemRegistryError = ReturnType<typeof SystemRegistryError>

type ErrorMessageRecord = {
  readonly message: string
}

const isErrorMessageRecord = (value: unknown): value is ErrorMessageRecord =>
  Match.value(value).pipe(
    Match.when((candidate) => typeof candidate !== 'object' || candidate === null, () => false),
    Match.orElse(() =>
      pipe(
        value as Record<string, unknown>,
        (record) => 'message' in record && typeof record.message === 'string'
      )
    ),
    Match.exhaustive
  )

export const makeSystemRegistryError = (
  message: string,
  systemName?: string,
  cause?: Error | ErrorCause | undefined
): SystemRegistryError =>
  SystemRegistryError({
    message,
    systemName: Option.fromNullable(systemName),
    cause: Option.fromNullable(toErrorCause(cause)),
  })

export const isSystemRegistryError = (error: unknown): error is SystemRegistryError =>
  typeof error === 'object' && error !== null && (error as { readonly _tag?: string })._tag === 'SystemRegistryError'

/**
 * 登録されたシステムのエントリ
 */
interface SystemEntry<Context> {
  readonly system: System<Context>
  readonly metadata: SystemMetadata
  readonly executionState: SystemExecutionState
}

/**
 * システムレジストリの状態
 */
interface RegistryState<Context> {
  readonly systems: Map<string, SystemEntry<Context>>
  readonly executionOrder: readonly string[]
  readonly globalEnabled: boolean
}

/**
 * システムレジストリサービス
 */
export interface SystemRegistryService<Context = unknown> {
  /**
   * システムを登録
   */
  readonly register: (
    system: System<Context>,
    priority?: SystemPriority,
    order?: number
  ) => Effect.Effect<void, SystemRegistryError>

  /**
   * システムを削除
   */
  readonly unregister: (name: string) => Effect.Effect<void, SystemRegistryError>

  /**
   * システムの有効/無効を切り替え
   */
  readonly setEnabled: (name: string, enabled: boolean) => Effect.Effect<void, SystemRegistryError>

  /**
   * システムの優先度を変更
   */
  readonly setPriority: (
    name: string,
    priority: SystemPriority,
    order?: number
  ) => Effect.Effect<void, SystemRegistryError>

  /**
   * 登録されたすべてのシステムを取得
   */
  readonly getSystems: Effect.Effect<readonly System<Context>[], never>

  /**
   * 実行順序でソートされたシステムを取得
   */
  readonly getOrderedSystems: Effect.Effect<readonly System<Context>[], never>

  /**
   * すべての有効なシステムを実行
   */
  readonly update: (context: Context, deltaTime: number) => Effect.Effect<void, SystemError>

  /**
   * システムの実行統計を取得
   */
  readonly getStats: (name: string) => Effect.Effect<SystemExecutionState, SystemRegistryError>

  /**
   * グローバルな有効/無効状態を設定
   */
  readonly setGlobalEnabled: (enabled: boolean) => Effect.Effect<void, never>

  /**
   * レジストリをクリア
   */
  readonly clear: Effect.Effect<void, never>
}

/**
 * システムレジストリサービスタグ
 */
export const SystemRegistryService = Context.GenericTag<SystemRegistryService>(
  '@minecraft/infrastructure/SystemRegistryService'
)

/**
 * 実行順序を計算
 */
const calculateExecutionOrder = <Context>(systems: Map<string, SystemEntry<Context>>): readonly string[] => {
  const entries = Array.from(systems.entries())

  // 優先度と順序でソート
  entries.sort(([, a], [, b]) => {
    const aPriority = priorityToNumber(a.metadata.priority)
    const bPriority = priorityToNumber(b.metadata.priority)

    // if文をMatch.valueパターンに置き換え
    return pipe(
      aPriority === bPriority,
      Match.value,
      Match.when(false, () => aPriority - bPriority),
      Match.when(true, () => a.metadata.order - b.metadata.order),
      Match.exhaustive
    )
  })

  return entries.map(([name]) => name)
}

/**
 * システムレジストリの実装
 */
export const SystemRegistryServiceLive = Layer.effect(
  SystemRegistryService,
  Effect.gen(function* () {
    // 初期状態
    const initialState: RegistryState<unknown> = {
      systems: new Map(),
      executionOrder: [],
      globalEnabled: true,
    }

    const stateRef = yield* Ref.make(initialState)

    /**
     * システムを登録
     */
    const register = (system: System<unknown>, priority: SystemPriority = 'normal', order = 500) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) =>
          pipe(
            state.systems.has(system.name),
            Match.value,
            Match.when(true, () => state),
            Match.when(false, () => {
              const metadata: SystemMetadata = {
                name: system.name,
                priority,
                enabled: true,
                order,
              }

              const executionState: SystemExecutionState = {
                systemName: system.name,
                executionCount: 0,
                totalDuration: 0,
                averageDuration: 0,
                maxDuration: 0,
                lastExecutionTime: 0,
                errors: [],
              }

              const entry: SystemEntry<unknown> = {
                system,
                metadata,
                executionState,
              }

              const newSystems = new Map(state.systems)
              newSystems.set(system.name, entry)

              return {
                ...state,
                systems: newSystems,
                executionOrder: calculateExecutionOrder(newSystems),
              }
            }),
            Match.exhaustive
          )
        )

        yield* Effect.logInfo(`System registered: ${system.name} (priority: ${priority})`)
      })

    /**
     * システムを削除
     */
    const unregister = (name: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        yield* Match.value(state.systems.has(name)).pipe(
          Match.when(false, () => Effect.fail(makeSystemRegistryError(`System not found: ${name}`, name))),
          Match.orElse(() => Effect.unit()),
          Match.exhaustive
        )

        yield* Ref.update(stateRef, (s) => {
          const newSystems = new Map(s.systems)
          newSystems.delete(name)

          return {
            ...s,
            systems: newSystems,
            executionOrder: calculateExecutionOrder(newSystems),
          }
        })

        yield* Effect.logInfo(`System unregistered: ${name}`)
      })

    /**
     * システムの有効/無効を切り替え
     */
    const setEnabled = (name: string, enabled: boolean) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const entry = state.systems.get(name)
          return Option.match(Option.fromNullable(entry), {
            onNone: () => state,
            onSome: (value) => {
              const newEntry: SystemEntry<unknown> = {
                ...value,
                metadata: { ...value.metadata, enabled },
              }

              const newSystems = new Map(state.systems)
              newSystems.set(name, newEntry)

              return { ...state, systems: newSystems }
            },
          })
        })
      })

    /**
     * システムの優先度を変更
     */
    const setPriority = (name: string, priority: SystemPriority, order?: number) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const entry = state.systems.get(name)
          return Option.match(Option.fromNullable(entry), {
            onNone: () => state,
            onSome: (value) => {
              const newEntry: SystemEntry<unknown> = {
                ...value,
                metadata: {
                  ...value.metadata,
                  priority,
                  order: order ?? value.metadata.order,
                },
              }

              const newSystems = new Map(state.systems)
              newSystems.set(name, newEntry)

              return {
                ...state,
                systems: newSystems,
                executionOrder: calculateExecutionOrder(newSystems),
              }
            },
          })
        })
      })

    /**
     * すべてのシステムを取得
     */
    const getSystems = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return Array.from(state.systems.values()).map((entry) => entry.system)
    })

    /**
     * 実行順序でソートされたシステムを取得
     */
    const getOrderedSystems = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.executionOrder
        .map((name) => state.systems.get(name))
        .filter((entry): entry is SystemEntry<unknown> => entry !== undefined && entry.metadata.enabled)
        .map((entry) => entry.system)
    })

    const recordFailure = (systemName: string, error: SystemError) =>
      Ref.update(stateRef, (state) =>
        pipe(
          Option.fromNullable(state.systems.get(systemName)),
          Option.match({
            onNone: () => state,
            onSome: (entry) => {
              const errorMessage = pipe(
                error.cause,
                Option.flatMap((cause) =>
                  pipe(
                    Match.value(cause),
                    Match.when(
                      (candidate): candidate is Error => candidate instanceof Error,
                      (candidate) => Option.some(candidate.message)
                    ),
                    Match.when(
                      (candidate): candidate is string => typeof candidate === 'string',
                      (candidate) => Option.some(candidate)
                    ),
                    Match.when(isErrorMessageRecord, (candidate) => Option.some(candidate.message)),
                    Match.orElse(() => Option.none<string>())
                  )
                ),
                Option.getOrElse(() => error.message)
              )
              const newExecutionState: SystemExecutionState = {
                ...entry.executionState,
                errors: [...entry.executionState.errors, errorMessage].slice(-10),
              }

              const newEntry: SystemEntry<unknown> = {
                ...entry,
                executionState: newExecutionState,
              }

              const newSystems = new Map(state.systems)
              newSystems.set(systemName, newEntry)

              return { ...state, systems: newSystems }
            },
          })
        )
      ).pipe(Effect.zipRight(Effect.logError(`System ${error.systemName} failed: ${error.message}`)))

    const recordSuccess = (systemName: string, duration: number, completedAt: number) =>
      Ref.update(stateRef, (state) =>
        pipe(
          Option.fromNullable(state.systems.get(systemName)),
          Option.match({
            onNone: () => state,
            onSome: (entry) => {
              const stats = entry.executionState
              const newCount = stats.executionCount + 1
              const newTotal = stats.totalDuration + duration

              const newExecutionState: SystemExecutionState = {
                ...stats,
                executionCount: newCount,
                totalDuration: newTotal,
                averageDuration: newTotal / newCount,
                maxDuration: Math.max(stats.maxDuration, duration),
                lastExecutionTime: completedAt,
              }

              const newEntry: SystemEntry<unknown> = {
                ...entry,
                executionState: newExecutionState,
              }

              const newSystems = new Map(state.systems)
              newSystems.set(systemName, newEntry)

              return { ...state, systems: newSystems }
            },
          })
        )
      )

    /**
     * すべての有効なシステムを実行
     */
    const update = (context: Record<string, never>, deltaTime: number) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)

        yield* pipe(
          Match.value(currentState.globalEnabled),
          Match.when(false, () => Effect.succeed<void>(undefined)),
          Match.orElse(() =>
            Effect.gen(function* () {
              const systems = yield* getOrderedSystems

              yield* Effect.forEach(
                systems,
                (system) =>
                  Effect.gen(function* () {
                    const startTime = yield* Clock.currentTimeMillis

                    yield* system.update(context, deltaTime).pipe(
                      Effect.mapError((error) =>
                        isSystemError(error)
                          ? error
                          : makeSystemError(system.name, 'Unknown error in system execution', error)
                      ),
                      Effect.tap(() =>
                        Effect.gen(function* () {
                          const endTime = yield* Clock.currentTimeMillis
                          yield* recordSuccess(system.name, endTime - startTime, endTime)
                        })
                      ),
                      Effect.tapError((error) => recordFailure(system.name, error))
                    )
                  }),
                { concurrency: 1 }
              )
            })
          )
        )
      })

    /**
     * システムの実行統計を取得
     */
    const getStats = (name: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const entry = state.systems.get(name)

        return yield* pipe(
          Option.fromNullable(entry),
          Option.match({
            onNone: () => Effect.fail(makeSystemRegistryError(`System not found: ${name}`, name)),
            onSome: (entry) => Effect.succeed(entry.executionState),
          })
        )
      })

    /**
     * グローバルな有効/無効状態を設定
     */
    const setGlobalEnabled = (enabled: boolean) =>
      Ref.update(stateRef, (state) => ({ ...state, globalEnabled: enabled }))

    /**
     * レジストリをクリア
     */
    const clear = Ref.set(stateRef, initialState)

    return SystemRegistryService.of({
      register,
      unregister,
      setEnabled,
      setPriority,
      getSystems,
      getOrderedSystems,
      update,
      getStats,
      setGlobalEnabled,
      clear,
    })
  })
)
