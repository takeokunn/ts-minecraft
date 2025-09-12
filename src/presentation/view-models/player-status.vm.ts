import { Effect, Context, Layer, Ref } from 'effect'
import { QueryHandlers } from '@application/handlers/query-handlers'

/**
 * Player Status View Model - Simplified
 * プレイヤーの状態情報をプレゼンテーション層向けに変換・提供
 * クエリハンドラーからデータを取得し、表示用に変換
 */
export interface PlayerStatusViewModelInterface {
  readonly getPlayerStatus: (entityId: string) => Effect.Effect<PlayerStatusView, Error, never>
  readonly updateLocalState: (entityId: string) => Effect.Effect<void, Error, never>
}

export interface PlayerStatusView {
  readonly position: Position3D
  readonly health: HealthStatus
  readonly isOnGround: boolean
  readonly currentBiome: string
}

export interface Position3D {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly formatted: string // "X: 123, Y: 64, Z: -456"
}

export interface HealthStatus {
  readonly current: number
  readonly maximum: number
  readonly percentage: number
  readonly status: 'healthy' | 'injured' | 'critical' | 'dead'
}

const PlayerStatusViewModelLive = Effect.gen(function* ($) {
  const queryHandlers = yield* $(QueryHandlers)

  // 表示用の純粋変換関数
  const formatPosition = (pos: { x: number; y: number; z: number }): Position3D => ({
    ...pos,
    formatted: `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}, Z: ${Math.round(pos.z)}`,
  })

  const calculateHealthStatus = (current: number, maximum: number): HealthStatus => {
    const percentage = Math.round((current / maximum) * 100)
    let status: HealthStatus['status'] = 'healthy'

    if (current <= 0) status = 'dead'
    else if (percentage <= 25) status = 'critical'
    else if (percentage <= 50) status = 'injured'

    return { current, maximum, percentage, status }
  }

  const getPlayerStatus = (entityId: string) =>
    Effect.gen(function* ($) {
      // クエリハンドラーからプレイヤーデータを取得
      const playerData = yield* $(queryHandlers.getPlayerState({ entityId }))

      // 表示用データ変換（純粋な変換処理のみ）
      return {
        position: formatPosition(playerData.position),
        health: calculateHealthStatus(playerData.health, 20), // デフォルト最大値
        isOnGround: true, // プレイヤーデータから取得すべき
        currentBiome: 'Plains', // ワールドデータから取得すべき
      }
    })

  const updateLocalState = (entityId: string) =>
    Effect.gen(function* ($) {
      // 必要に応じてローカル表示状態を更新
      // 現在は何もしない（将来の拡張用）
      yield* $(Effect.log(`Local state updated for player ${entityId}`))
    })

  return {
    getPlayerStatus,
    updateLocalState,
  }
})

// Create context tag for dependency injection
export const PlayerStatusViewModel = Context.GenericTag<PlayerStatusViewModelInterface>('PlayerStatusViewModel')

// Layer for dependency injection
export const PlayerStatusViewModelLive: Layer.Layer<PlayerStatusViewModel, never, QueryHandlers> = Layer.effect(PlayerStatusViewModel, PlayerStatusViewModelLive)

// Factory function for direct usage
export const createPlayerStatusViewModel = (queryHandlers: QueryHandlers) => Effect.runSync(Effect.provide(PlayerStatusViewModelLive, Layer.succeed(QueryHandlers, queryHandlers)))
