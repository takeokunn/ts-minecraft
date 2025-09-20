/**
 * ECS SystemRegistry - システムの登録と管理
 *
 * システムの動的な登録、削除、優先度管理を提供
 * Effect-TSのRefを使用した安全な状態管理
 */

import { Context, Data, Effect, Layer, Ref, Schema } from 'effect'
import type { System, SystemMetadata, SystemPriority } from './System.js'
import { priorityToNumber, runSystems, SystemError, SystemExecutionState } from './System.js'
import type { World } from './World.js'

/**
 * システムレジストリエラー
 */
export class SystemRegistryError extends Data.TaggedError('SystemRegistryError')<{
  readonly message: string
  readonly systemName?: string
  readonly cause?: unknown
}> {}

/**
 * 登録されたシステムのエントリ
 */
interface SystemEntry {
  readonly system: System
  readonly metadata: SystemMetadata
  readonly executionState: SystemExecutionState
}

/**
 * システムレジストリの状態
 */
interface RegistryState {
  readonly systems: Map<string, SystemEntry>
  readonly executionOrder: readonly string[]
  readonly globalEnabled: boolean
}

/**
 * システムレジストリサービス
 */
export interface SystemRegistryService {
  /**
   * システムを登録
   */
  readonly register: (
    system: System,
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
  readonly getSystems: Effect.Effect<readonly System[], never>

  /**
   * 実行順序でソートされたシステムを取得
   */
  readonly getOrderedSystems: Effect.Effect<readonly System[], never>

  /**
   * すべての有効なシステムを実行
   */
  readonly update: (world: World, deltaTime: number) => Effect.Effect<void, SystemError>

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
export const SystemRegistryService = Context.GenericTag<SystemRegistryService>('@minecraft/ecs/SystemRegistryService')

/**
 * 実行順序を計算
 */
const calculateExecutionOrder = (systems: Map<string, SystemEntry>): readonly string[] => {
  const entries = Array.from(systems.entries())

  // 優先度と順序でソート
  entries.sort(([, a], [, b]) => {
    const aPriority = priorityToNumber(a.metadata.priority)
    const bPriority = priorityToNumber(b.metadata.priority)

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    return a.metadata.order - b.metadata.order
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
    const initialState: RegistryState = {
      systems: new Map(),
      executionOrder: [],
      globalEnabled: true,
    }

    const stateRef = yield* Ref.make(initialState)

    /**
     * システムを登録
     */
    const register = (system: System, priority: SystemPriority = 'normal', order = 500) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          if (state.systems.has(system.name)) {
            return state
          }

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

          const entry: SystemEntry = {
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
        })

        yield* Effect.logInfo(`System registered: ${system.name} (priority: ${priority})`)
      })

    /**
     * システムを削除
     */
    const unregister = (name: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.systems.has(name)) {
          return yield* Effect.fail(
            new SystemRegistryError({
              message: `System not found: ${name}`,
              systemName: name,
            })
          )
        }

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
          if (!entry) return state

          const newEntry: SystemEntry = {
            ...entry,
            metadata: { ...entry.metadata, enabled },
          }

          const newSystems = new Map(state.systems)
          newSystems.set(name, newEntry)

          return { ...state, systems: newSystems }
        })
      })

    /**
     * システムの優先度を変更
     */
    const setPriority = (name: string, priority: SystemPriority, order?: number) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const entry = state.systems.get(name)
          if (!entry) return state

          const newEntry: SystemEntry = {
            ...entry,
            metadata: {
              ...entry.metadata,
              priority,
              order: order ?? entry.metadata.order,
            },
          }

          const newSystems = new Map(state.systems)
          newSystems.set(name, newEntry)

          return {
            ...state,
            systems: newSystems,
            executionOrder: calculateExecutionOrder(newSystems),
          }
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
        .filter((entry): entry is SystemEntry => entry !== undefined && entry.metadata.enabled)
        .map((entry) => entry.system)
    })

    /**
     * すべての有効なシステムを実行
     */
    const update = (world: World, deltaTime: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.globalEnabled) {
          return
        }

        const systems = yield* getOrderedSystems

        // 各システムを実行し、統計を更新
        for (const system of systems) {
          const startTime = Date.now()

          const result = yield* Effect.either(system.update(world, deltaTime))
          const duration = Date.now() - startTime

          if (result._tag === 'Right') {
            // 成功時: 統計を更新
            yield* Ref.update(stateRef, (s) => {
              const entry = s.systems.get(system.name)
              if (!entry) return s

              const newState = entry.executionState
              const newCount = newState.executionCount + 1
              const newTotal = newState.totalDuration + duration

              const newExecutionState: SystemExecutionState = {
                ...newState,
                executionCount: newCount,
                totalDuration: newTotal,
                averageDuration: newTotal / newCount,
                maxDuration: Math.max(newState.maxDuration, duration),
                lastExecutionTime: Date.now(),
              }

              const newEntry: SystemEntry = {
                ...entry,
                executionState: newExecutionState,
              }

              const newSystems = new Map(s.systems)
              newSystems.set(system.name, newEntry)

              return { ...s, systems: newSystems }
            })
          } else {
            // エラー時: エラーを記録して再度スロー
            const error = result.left

            yield* Ref.update(stateRef, (s) => {
              const entry = s.systems.get(system.name)
              if (!entry) return s

              const errorMessage =
                error instanceof SystemError ? `${error.systemName}: ${error.message}` : String(error)

              const newExecutionState: SystemExecutionState = {
                ...entry.executionState,
                errors: [...entry.executionState.errors, errorMessage].slice(-10), // 最新10件のエラーを保持
              }

              const newEntry: SystemEntry = {
                ...entry,
                executionState: newExecutionState,
              }

              const newSystems = new Map(s.systems)
              newSystems.set(system.name, newEntry)

              return { ...s, systems: newSystems }
            })

            yield* Effect.fail(error)
          }
        }
      })

    /**
     * システムの実行統計を取得
     */
    const getStats = (name: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const entry = state.systems.get(name)

        if (!entry) {
          return yield* Effect.fail(
            new SystemRegistryError({
              message: `System not found: ${name}`,
              systemName: name,
            })
          )
        }

        return entry.executionState
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
