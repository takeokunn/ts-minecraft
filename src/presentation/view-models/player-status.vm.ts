import { Effect, Context } from 'effect'
import { World } from '@/infrastructure/layers'

/**
 * Player Status View Model
 * プレイヤーの状態情報をプレゼンテーション層向けに変換・提供
 * 健康状態、位置、インベントリなどの表示用データを整形
 */
export interface PlayerStatusViewModelInterface {
  readonly getPlayerStatus: () => Effect.Effect<PlayerStatusView, never, never>
  readonly getPlayerPosition: () => Effect.Effect<Position3D, never, never>
  readonly getPlayerHealth: () => Effect.Effect<HealthStatus, never, never>
  readonly getPlayerInventory: () => Effect.Effect<InventoryView, never, never>
}

export interface PlayerStatusView {
  readonly position: Position3D
  readonly rotation: Rotation3D
  readonly health: HealthStatus
  readonly inventory: InventoryView
  readonly isOnGround: boolean
  readonly isInWater: boolean
  readonly currentBiome: string
  readonly lightLevel: number
}

export interface Position3D {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly formatted: string // "X: 123, Y: 64, Z: -456"
}

export interface Rotation3D {
  readonly pitch: number
  readonly yaw: number
  readonly roll: number
}

export interface HealthStatus {
  readonly current: number
  readonly maximum: number
  readonly percentage: number
  readonly status: 'healthy' | 'injured' | 'critical' | 'dead'
}

export interface InventoryView {
  readonly totalSlots: number
  readonly usedSlots: number
  readonly freeSlots: number
  readonly hotbar: InventoryItem[]
  readonly items: InventoryItem[]
}

export interface InventoryItem {
  readonly id: string
  readonly type: string
  readonly name: string
  readonly count: number
  readonly maxStack: number
  readonly durability?: number
  readonly maxDurability?: number
}

const PlayerStatusViewModelLive = Effect.gen(function* ($) {
  const world = yield* $(World)

  const getPlayerStatus = () =>
    Effect.gen(function* ($) {
      // Since the current World service doesn't have player query functionality,
      // we'll return default values for now. This would need to be connected
      // to a proper entity/player management system.
      return createDefaultPlayerStatus()
    })

  const getPlayerPosition = () =>
    Effect.gen(function* ($) {
      const status = yield* $(getPlayerStatus())
      return status.position
    })

  const getPlayerHealth = () =>
    Effect.gen(function* ($) {
      const status = yield* $(getPlayerStatus())
      return status.health
    })

  const getPlayerInventory = () =>
    Effect.gen(function* ($) {
      const status = yield* $(getPlayerStatus())
      return status.inventory
    })

  return {
    getPlayerStatus,
    getPlayerPosition,
    getPlayerHealth,
    getPlayerInventory,
  }
})

// ヘルパー関数
const getHealthStatus = (current: number, maximum: number): HealthStatus['status'] => {
  const percentage = (current / maximum) * 100
  if (current <= 0) return 'dead'
  if (percentage <= 25) return 'critical'
  if (percentage <= 50) return 'injured'
  return 'healthy'
}

const formatInventoryItem = (item: any): InventoryItem => ({
  id: item.id || 'unknown',
  type: item.type || 'item',
  name: item.name || 'Unknown Item',
  count: item.count || 1,
  maxStack: item.maxStack || 64,
  durability: item.durability,
  maxDurability: item.maxDurability,
})

const createDefaultPlayerStatus = (): PlayerStatusView => ({
  position: {
    x: 0,
    y: 0,
    z: 0,
    formatted: 'X: 0, Y: 0, Z: 0',
  },
  rotation: {
    pitch: 0,
    yaw: 0,
    roll: 0,
  },
  health: {
    current: 20,
    maximum: 20,
    percentage: 100,
    status: 'healthy',
  },
  inventory: {
    totalSlots: 36,
    usedSlots: 0,
    freeSlots: 36,
    hotbar: [],
    items: [],
  },
  isOnGround: true,
  isInWater: false,
  currentBiome: 'Plains',
  lightLevel: 15,
})

export class PlayerStatusViewModel extends Context.GenericTag('PlayerStatusViewModel')<
  PlayerStatusViewModel,
  PlayerStatusViewModelInterface
>() {
  static readonly Live = PlayerStatusViewModelLive.pipe(Effect.map(PlayerStatusViewModel.of))
}