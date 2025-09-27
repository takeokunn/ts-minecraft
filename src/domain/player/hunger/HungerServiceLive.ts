import { Effect, Layer, Stream, Match, pipe, Schedule, HashMap, Option, Ref } from 'effect'
import type { PlayerId } from '@domain/core/types/brands'
import { HungerService } from './HungerService'
import type {
  HungerState,
  FoodItem,
  HungerLevel,
  SaturationLevel,
  ExhaustionLevel,
  HungerDecreaseReason,
  HungerEvent,
  StatusEffect,
} from './HungerTypes'
import { ConsumeError, HungerError, PlayerNotFoundError, HUNGER_CONSTANTS } from './HungerTypes'

/**
 * HungerServiceLive Implementation
 * Refを使用した並行安全な空腹度管理システム
 */
const makeHungerService = Effect.gen(function* () {
  // 並行安全な状態管理
  const hungerStatesRef = yield* Ref.make(HashMap.empty<PlayerId, HungerState>())

  // イベント履歴の保存（簡易実装）
  const eventsRef = yield* Ref.make<Array<HungerEvent>>([])

  // プレイヤーの初期化
  const initializePlayer = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const initialState: HungerState = {
        playerId,
        hunger: 20 as HungerLevel,
        saturation: 5 as SaturationLevel,
        exhaustion: 0 as ExhaustionLevel,
        isStarving: false,
        lastFoodEaten: Option.none(),
        lastUpdateTime: Date.now(),
      }

      const states = yield* Ref.get(hungerStatesRef)
      yield* Ref.set(hungerStatesRef, HashMap.set(states, playerId, initialState))

      return initialState
    })

  // 食料消費処理
  const consumeFood = (playerId: PlayerId, foodItem: FoodItem) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(hungerStatesRef)
      const stateOption = HashMap.get(states, playerId)

      if (Option.isNone(stateOption)) {
        return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
      }

      const state = stateOption.value

      // 満腹度計算
      const newHunger = Math.min(HUNGER_CONSTANTS.MAX_HUNGER, state.hunger + foodItem.nutrition) as HungerLevel

      const newSaturation = Math.min(
        newHunger, // 満腹度は空腹度を超えない
        state.saturation + foodItem.saturation
      ) as SaturationLevel

      const newState: HungerState = {
        ...state,
        hunger: newHunger,
        saturation: newSaturation,
        exhaustion: 0 as ExhaustionLevel, // 食事後は疲労度リセット
        isStarving: false,
        lastFoodEaten: Option.some(foodItem),
        lastUpdateTime: Date.now(),
      }

      yield* Ref.set(hungerStatesRef, HashMap.set(states, playerId, newState))

      // イベント記録
      const event: HungerEvent = {
        _tag: 'FoodConsumed',
        playerId,
        foodItem,
        hungerRestored: newHunger,
        saturationRestored: newSaturation,
        timestamp: Date.now(),
      }

      const events = yield* Ref.get(eventsRef)
      yield* Ref.set(eventsRef, Array.from([...events, event]))

      // 食料効果の適用（TODO: StatusEffectServiceとの連携）
      yield* applyFoodEffects(playerId, foodItem.effects)

      return newState
    })

  // 空腹度減少処理
  const decreaseHunger = (
    playerId: PlayerId,
    reason: HungerDecreaseReason
  ): Effect.Effect<HungerLevel, PlayerNotFoundError, never> =>
    Effect.gen(function* () {
      // 各アクションに応じた疲労度計算
      let exhaustionAmount: number = 0

      if (reason._tag === 'Movement') {
        exhaustionAmount = reason.distance * 0.01
      } else if (reason._tag === 'Combat') {
        exhaustionAmount = 0.1 * reason.damage
      } else if (reason._tag === 'Mining') {
        exhaustionAmount = 0.005 * reason.blockHardness
      } else if (reason._tag === 'Regeneration') {
        exhaustionAmount = reason.healthRestored * 0.3
      } else if (reason._tag === 'Swimming') {
        exhaustionAmount = reason.duration * 0.01
      } else if (reason._tag === 'Sprinting') {
        exhaustionAmount = reason.distance * 0.1
      }

      const state = yield* addExhaustion(playerId, exhaustionAmount)

      // イベント記録（空腹度が実際に減少した場合）
      const prevState = yield* getHungerState(playerId)
      if (state.hunger < prevState.hunger) {
        const event: HungerEvent = {
          _tag: 'HungerDecreased',
          playerId,
          amount: (prevState.hunger - state.hunger) as HungerLevel,
          reason,
          timestamp: Date.now(),
        }

        const events = yield* Ref.get(eventsRef)
        yield* Ref.set(eventsRef, Array.from([...events, event]))
      }

      return state.hunger
    })

  // 疲労度追加
  const addExhaustion = (playerId: PlayerId, amount: number) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(hungerStatesRef)
      const stateOption = HashMap.get(states, playerId)

      if (Option.isNone(stateOption)) {
        return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
      }

      const state = stateOption.value

      // 負の値は0にクランプ
      let newExhaustion = Math.max(0, state.exhaustion + amount)
      let newHunger = state.hunger
      let newSaturation = state.saturation

      // 疲労度が4を超えたら空腹度減少
      while (newExhaustion >= HUNGER_CONSTANTS.EXHAUSTION_THRESHOLD) {
        newExhaustion -= HUNGER_CONSTANTS.EXHAUSTION_THRESHOLD

        if (newSaturation > 0) {
          // まず満腹度から減少
          newSaturation = Math.max(0, newSaturation - 1) as SaturationLevel
        } else if (newHunger > 0) {
          // 満腹度が0なら空腹度から減少
          newHunger = Math.max(0, newHunger - 1) as HungerLevel
        }
      }

      const newState: HungerState = {
        ...state,
        hunger: newHunger,
        saturation: newSaturation,
        exhaustion: newExhaustion as ExhaustionLevel,
        isStarving: newHunger === 0,
        lastUpdateTime: Date.now(),
      }

      yield* Ref.set(hungerStatesRef, HashMap.set(states, playerId, newState))

      return newState
    })

  // 現在の空腹状態取得
  const getHungerState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const states = yield* Ref.get(hungerStatesRef)
      const stateOption = HashMap.get(states, playerId)

      if (Option.isNone(stateOption)) {
        return yield* Effect.fail(new PlayerNotFoundError({ playerId }))
      }

      return stateOption.value
    })

  // スプリント可能判定
  const canSprint = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const state = yield* getHungerState(playerId)
      return state.hunger > HUNGER_CONSTANTS.MIN_SPRINT_HUNGER - 1
    })

  // 自然回復可能判定
  const shouldRegenerateHealth = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const state = yield* getHungerState(playerId)
      return state.hunger >= HUNGER_CONSTANTS.REGENERATION_HUNGER
    })

  // 飢餓状態判定
  const isStarving = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const state = yield* getHungerState(playerId)
      return state.isStarving
    })

  // 食料効果適用（簡易実装）
  const applyFoodEffects = (playerId: PlayerId, effects: ReadonlyArray<StatusEffect>) =>
    Effect.gen(function* () {
      // TODO: StatusEffectServiceと連携して実装
      yield* Effect.logDebug(`Applying ${effects.length} effects to player ${playerId}`)
    })

  // 定期的な飢餓ダメージ処理（Streamで実装）
  const starvationDamageEffect = Effect.gen(function* () {
    const states = yield* Ref.get(hungerStatesRef)

    // 全プレイヤーの飢餓状態をチェック
    const starvingPlayers = HashMap.filter(states, (state) => state.isStarving)

    yield* Effect.forEach(HashMap.values(starvingPlayers), (state) =>
      Effect.gen(function* () {
        // TODO: HealthServiceと連携してダメージを与える
        yield* Effect.logDebug(`Player ${state.playerId} is taking starvation damage`)

        // 飢餓開始イベント
        const event: HungerEvent = {
          _tag: 'StarvationStarted',
          playerId: state.playerId,
          timestamp: Date.now(),
        }

        const events = yield* Ref.get(eventsRef)
        yield* Ref.set(eventsRef, Array.from([...events, event]))
      })
    )
  })

  const starvationDamageStream = Stream.repeatEffect(starvationDamageEffect)

  // バックグラウンドタスクの起動
  yield* Effect.forkDaemon(Stream.runDrain(starvationDamageStream))

  return HungerService.of({
    consumeFood,
    decreaseHunger,
    getHungerState,
    initializePlayer,
    canSprint,
    shouldRegenerateHealth,
    isStarving,
    addExhaustion,
  })
})

/**
 * HungerServiceLive Layer
 * 依存サービスの注入と初期化
 */
export const HungerServiceLive = Layer.effect(HungerService, makeHungerService)
