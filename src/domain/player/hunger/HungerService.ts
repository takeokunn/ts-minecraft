import { Context, Effect } from 'effect'
import type { PlayerId } from '../../../shared/types/index.js'
import type {
  HungerState,
  FoodItem,
  HungerLevel,
  HungerDecreaseReason,
  ConsumeError,
  HungerError,
  PlayerNotFoundError,
} from './HungerTypes.js'

/**
 * HungerService Interface
 * プレイヤーの空腹度管理を担当するサービス
 * Effect-TSのContext.GenericTagパターンを使用
 */
export interface HungerService {
  /**
   * 食料を消費して空腹度と満腹度を回復
   */
  readonly consumeFood: (
    playerId: PlayerId,
    foodItem: FoodItem
  ) => Effect.Effect<HungerState, ConsumeError | PlayerNotFoundError>

  /**
   * 空腹度を減少させる
   * 各種アクションに応じて適切な量を減少
   */
  readonly decreaseHunger: (
    playerId: PlayerId,
    reason: HungerDecreaseReason
  ) => Effect.Effect<HungerLevel, HungerError | PlayerNotFoundError>

  /**
   * プレイヤーの現在の空腹状態を取得
   */
  readonly getHungerState: (playerId: PlayerId) => Effect.Effect<HungerState, PlayerNotFoundError>

  /**
   * プレイヤーの空腹状態を初期化
   */
  readonly initializePlayer: (playerId: PlayerId) => Effect.Effect<HungerState, never>

  /**
   * スプリント可能かどうかを判定
   * 空腹度が7以上の場合にtrue
   */
  readonly canSprint: (playerId: PlayerId) => Effect.Effect<boolean, PlayerNotFoundError>

  /**
   * 自然回復が可能かどうかを判定
   * 空腹度が18以上の場合にtrue
   */
  readonly shouldRegenerateHealth: (playerId: PlayerId) => Effect.Effect<boolean, PlayerNotFoundError>

  /**
   * 飢餓状態かどうかを判定
   * 空腹度が0の場合にtrue
   */
  readonly isStarving: (playerId: PlayerId) => Effect.Effect<boolean, PlayerNotFoundError>

  /**
   * 疲労度を増加させる
   * 4に達すると空腹度が1減少してリセット
   */
  readonly addExhaustion: (
    playerId: PlayerId,
    amount: number
  ) => Effect.Effect<HungerState, HungerError | PlayerNotFoundError>
}

/**
 * HungerService Tag
 * 依存性注入用のタグ定義
 */
export const HungerService = Context.GenericTag<HungerService>('@minecraft/domain/HungerService')
