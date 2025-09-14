---
title: "プレイヤー移動実装 - Effect-TS + Three.js統合例"
description: "Effect-TS 3.17+とThree.jsを使った3Dプレイヤー移動システム。物理演算、衝突検出、状態管理の実装例。"
category: "examples"
difficulty: "beginner-intermediate"
tags: ["player", "movement", "three.js", "physics", "collision", "effect-ts"]
prerequisites: ["ブロック配置実装完了", "Three.js基礎", "3D数学基礎"]
estimated_reading_time: "30分"
last_updated: "2025-09-14"
version: "1.0.0"
learning_path: "基本実装パターン"
---

# 🏃 プレイヤー移動実装

## 🧭 スマートナビゲーション

> **📍 現在位置**: ホーム → 実例集 → 基本的な使用例 → プレイヤー移動
> **🎯 学習目標**: Effect-TS + Three.js統合と3D物理演算
> **⏱️ 所要時間**: 30分
> **👤 対象**: Effect-TS基礎習得済み

**Effect-TSとThree.jsを統合して、型安全な3Dプレイヤー移動システムを実装しましょう！**

## 🎯 学習目標

この実装例では以下を学習します：

- **Effect + Three.js統合**: 外部ライブラリとのシームレスな統合
- **Ref**: リアルタイム状態管理
- **Schedule**: 定期実行処理（ゲームループ）
- **Vector3演算**: 3D数学とEffect-TSの組み合わせ
- **衝突検出**: 物理演算の基本実装
- **入力処理**: キーボード入力の関数型処理

## 💡 実装アーキテクチャ

```mermaid
graph TB
    A[キーボード入力] --> B[入力処理サービス]
    B --> C[移動計算]
    C --> D[衝突検出]
    D --> E{衝突あり?}
    E -->|No| F[位置更新]
    E -->|Yes| G[移動キャンセル]
    F --> H[Three.jsレンダリング]
    G --> H
    H --> I[次フレーム]
    I --> A

    classDef input fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef process fill:#f1f8e9,stroke:#388e3c,stroke-width:2px
    classDef render fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef decision fill:#fce4ec,stroke:#e91e63,stroke-width:2px

    class A,B input
    class C,D,F,G process
    class H,I render
    class E decision
```

## 📝 完全実装コード

### 🧮 1. 3D数学ユーティリティ

```typescript
// src/domain/math/vector3.ts
import { Schema } from "@effect/schema"
import { Data, Equal, Hash, Brand } from "effect"

/**
 * Branded type for coordinate values (型安全性強化)
 */
export type Coordinate = number & Brand.Brand<"Coordinate">
export const Coordinate = Brand.nominal<Coordinate>()

/**
 * 3Dベクトルスキーマ（Branded Types使用）
 *
 * 🎯 学習ポイント：
 * - Branded Typesによる型安全性
 * - Schema定義による厳密な型チェック
 * - 座標値の意味的な区別
 */
export const Vector3 = Schema.Struct({
  x: Schema.Number.pipe(Schema.brand(Coordinate)),
  y: Schema.Number.pipe(Schema.brand(Coordinate)),
  z: Schema.Number.pipe(Schema.brand(Coordinate))
})

export type Vector3 = Schema.Schema.Type<typeof Vector3>

/**
 * Vector3用のData構造（不変・比較可能）
 */
export class Vector3Data extends Data.Struct<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  /**
   * ベクトル加算（Early Return実装）
   */
  add(other: Vector3Data): Vector3Data {
    // Early Return: ゼロベクトルの場合は即座に自身を返す
    if (other.x === 0 && other.y === 0 && other.z === 0) {
      return this
    }

    return new Vector3Data({
      x: Coordinate(this.x + other.x),
      y: Coordinate(this.y + other.y),
      z: Coordinate(this.z + other.z)
    })
  }

  /**
   * ベクトル減算（Early Return実装）
   */
  subtract(other: Vector3Data): Vector3Data {
    // Early Return: ゼロベクトルの場合は即座に自身を返す
    if (other.x === 0 && other.y === 0 && other.z === 0) {
      return this
    }

    return new Vector3Data({
      x: Coordinate(this.x - other.x),
      y: Coordinate(this.y - other.y),
      z: Coordinate(this.z - other.z)
    })
  }

  /**
   * スカラー倍（Early Return実装）
   */
  multiply(scalar: number): Vector3Data {
    // Early Return: スカラーが1の場合は即座に自身を返す
    if (scalar === 1) {
      return this
    }

    // Early Return: スカラーが0の場合はゼロベクトルを返す
    if (scalar === 0) {
      return ZERO_VECTOR
    }

    return new Vector3Data({
      x: Coordinate(this.x * scalar),
      y: Coordinate(this.y * scalar),
      z: Coordinate(this.z * scalar)
    })
  }

  /**
   * ベクトルの長さ
   */
  get magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  /**
   * ベクトルの正規化（Early Return実装）
   */
  normalize(): Vector3Data {
    const mag = this.magnitude

    // Early Return: ゼロベクトルの場合
    if (mag === 0) {
      return ZERO_VECTOR
    }

    // Early Return: 既に正規化済みの場合
    if (Math.abs(mag - 1) < Number.EPSILON) {
      return this
    }

    return this.multiply(1 / mag)
  }

  /**
   * 距離計算
   */
  distanceTo(other: Vector3Data): number {
    return this.subtract(other).magnitude
  }

  /**
   * Three.js Vector3への変換（Branded Types対応）
   */
  toThreeVector3(): THREE.Vector3 {
    return new THREE.Vector3(this.x, this.y, this.z)
  }

  /**
   * Three.js Vector3からの作成（Branded Types対応）
   */
  static fromThreeVector3(vec: THREE.Vector3): Vector3Data {
    return new Vector3Data({
      x: Coordinate(vec.x),
      y: Coordinate(vec.y),
      z: Coordinate(vec.z)
    })
  }
}

/**
 * ゼロベクトル定数（Branded Types対応）
 */
export const ZERO_VECTOR = new Vector3Data({
  x: Coordinate(0),
  y: Coordinate(0),
  z: Coordinate(0)
})

/**
 * 方向ベクトル定数（Branded Types対応）
 */
export const DIRECTION_VECTORS = {
  FORWARD: new Vector3Data({ x: Coordinate(0), y: Coordinate(0), z: Coordinate(-1) }),
  BACKWARD: new Vector3Data({ x: Coordinate(0), y: Coordinate(0), z: Coordinate(1) }),
  LEFT: new Vector3Data({ x: Coordinate(-1), y: Coordinate(0), z: Coordinate(0) }),
  RIGHT: new Vector3Data({ x: Coordinate(1), y: Coordinate(0), z: Coordinate(0) }),
  UP: new Vector3Data({ x: Coordinate(0), y: Coordinate(1), z: Coordinate(0) }),
  DOWN: new Vector3Data({ x: Coordinate(0), y: Coordinate(-1), z: Coordinate(0) })
} as const
```

### 🎮 2. 入力システム

```typescript
// src/infrastructure/input-system.ts
import { Context, Effect, Ref, Layer, Schema } from "effect"
import { Match } from "effect"

/**
 * キー状態の管理（Schema定義）
 */
export const KeyState = Schema.Struct({
  isPressed: Schema.Boolean,
  justPressed: Schema.Boolean,
  justReleased: Schema.Boolean
})

export type KeyState = Schema.Schema.Type<typeof KeyState>

/**
 * 移動入力エラー（TaggedError定義）
 */
export class InputSystemError extends Schema.TaggedError<InputSystemError>("InputSystemError")(
  "InputSystemError",
  {
    message: Schema.String
  }
) {}

/**
 * 入力システムサービス
 *
 * 🎯 学習ポイント：
 * - DOMイベントとEffect-TSの統合
 * - Refによるリアルタイム状態管理
 * - 関数型でのイベント処理
 */
/**
 * 移動入力スキーマ（型安全性強化）
 */
export const MovementInputState = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  run: Schema.Boolean
})

export type MovementInputState = Schema.Schema.Type<typeof MovementInputState>

/**
 * 入力システムサービス（Effect-TSパターン適用）
 */
export interface InputSystem {
  readonly getKeyState: (key: string) => Effect.Effect<KeyState, InputSystemError>
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, InputSystemError>
  readonly getMovementInput: () => Effect.Effect<MovementInputState, InputSystemError>
}

export const InputSystem = Context.GenericTag<InputSystem>("InputSystem")

/**
 * ブラウザ入力システムの実装
 */
class BrowserInputSystem implements InputSystem {
  private keyStates = new Map<string, Ref.Ref<KeyState>>()
  private initialized = false

  private initializeIfNeeded(): Effect.Effect<void, InputSystemError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: 既に初期化済みまたはサーバーサイド
      if (self.initialized || typeof window === 'undefined') {
        return
      }

      yield* Effect.sync(() => {
        // キーダウンイベント（Effect.catchTags使用）
        window.addEventListener('keydown', (event) => {
          const keyRef = self.getOrCreateKeyRef(event.code)

          Ref.update(keyRef, (current) => ({
            isPressed: true,
            justPressed: !current.isPressed,
            justReleased: false
          })).pipe(
            Effect.catchTags({
              // エラーハンドリング（従来のtry/catchをEffect.catchTagsに置換）
              UnknownException: (error) =>
                Effect.logError(`キーダウンイベント処理エラー: ${error.message}`)
            }),
            Effect.runSync
          )
        })

        // キーアップイベント（Effect.catchTags使用）
        window.addEventListener('keyup', (event) => {
          const keyRef = self.getOrCreateKeyRef(event.code)

          Ref.update(keyRef, (current) => ({
            isPressed: false,
            justPressed: false,
            justReleased: current.isPressed
          })).pipe(
            Effect.catchTags({
              // エラーハンドリング（従来のtry/catchをEffect.catchTagsに置換）
              UnknownException: (error) =>
                Effect.logError(`キーアップイベント処理エラー: ${error.message}`)
            }),
            Effect.runSync
          )
        })

        self.initialized = true
      })
    }).bind(this)
  }

  private getOrCreateKeyRef(key: string): Ref.Ref<KeyState> {
    let keyRef = this.keyStates.get(key)
    if (!keyRef) {
      keyRef = Ref.unsafeMake<KeyState>({
        isPressed: false,
        justPressed: false,
        justReleased: false
      })
      this.keyStates.set(key, keyRef)
    }
    return keyRef
  }

  getKeyState(key: string): Effect.Effect<KeyState, InputSystemError> {
    return Effect.gen(function* () {
      const self = this

      yield* self.initializeIfNeeded()
      const keyRef = self.getOrCreateKeyRef(key)
      return yield* Ref.get(keyRef)
    }).bind(this)
  }

  isKeyPressed(key: string): Effect.Effect<boolean, InputSystemError> {
    return Effect.gen(function* () {
      const self = this

      const state = yield* self.getKeyState(key)
      return state.isPressed
    }).bind(this)
  }

  getMovementInput(): Effect.Effect<MovementInputState, InputSystemError> {
    return Effect.gen(function* () {
      const self = this

      // Effect.allで移動処理を並列化
      const [forward, backward, left, right, jump, run] = yield* Effect.all([
        self.isKeyPressed('KeyW'),
        self.isKeyPressed('KeyS'),
        self.isKeyPressed('KeyA'),
        self.isKeyPressed('KeyD'),
        self.isKeyPressed('Space'),
        self.isKeyPressed('ShiftLeft')
      ])

      // Schema定義を使った型安全な返却値
      return Schema.decodeUnknownSync(MovementInputState)({
        forward, backward, left, right, jump, run
      })
    }).bind(this)
  }

  /**
   * フレーム終了時の状態リセット（justPressed/justReleasedフラグクリア）
   */
  resetFrameState(): Effect.Effect<void, InputSystemError> {
    return Effect.gen(function* () {
      const self = this

      // Effect.allでフレーム状態リセットを並列化
      const updates = Array.from(self.keyStates.values()).map(keyRef =>
        Ref.update(keyRef, (current) => ({
          ...current,
          justPressed: false,
          justReleased: false
        }))
      )

      yield* Effect.all(updates)
    }).bind(this)
  }
}

/**
 * InputSystemの実装を提供するLayer（サービス定義）
 */
export const BrowserInputSystemLive = Layer.effect(
  InputSystem,
  Effect.gen(function* () {
    const service = new BrowserInputSystem()
    yield* Effect.log('🎮 BrowserInputSystem初期化完了')
    return service
  })
)
```

### 👤 3. プレイヤーエンティティ

```typescript
// src/domain/entities/player.ts
import { Schema } from "@effect/schema"
import { Data, Brand } from "effect"
import { Vector3Data, Coordinate } from "../math/vector3.js"

/**
 * プレイヤーID（Branded Types使用）
 */
export type PlayerId = string & Brand.Brand<"PlayerId">
export const PlayerId = Brand.nominal<PlayerId>()

/**
 * 体力値（Branded Types使用）
 */
export type Health = number & Brand.Brand<"Health">
export const Health = Brand.nominal<Health>()

/**
 * プレイヤー状態スキーマ
 *
 * 🎯 学習ポイント：
 * - ゲームエンティティのデータモデリング
 * - 物理プロパティの型安全な表現
 * - ゲーム固有の制約の実装
 */
export const PlayerState = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerId)),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.brand(Coordinate)),
    y: Schema.Number.pipe(Schema.brand(Coordinate)),
    z: Schema.Number.pipe(Schema.brand(Coordinate))
  }),
  velocity: Schema.Struct({
    x: Schema.Number.pipe(Schema.brand(Coordinate)),
    y: Schema.Number.pipe(Schema.brand(Coordinate)),
    z: Schema.Number.pipe(Schema.brand(Coordinate))
  }),
  rotation: Schema.Struct({
    yaw: Schema.Number,   // 水平回転 (Y軸)
    pitch: Schema.Number  // 垂直回転 (X軸)
  }),
  isOnGround: Schema.Boolean,
  health: Schema.Number.pipe(Schema.brand(Health), Schema.positive()),
  isRunning: Schema.Boolean
})

export type PlayerState = Schema.Schema.Type<typeof PlayerState>

/**
 * プレイヤーエンティティクラス（不変データ構造）
 */
export class Player extends Data.Struct<{
  readonly state: PlayerState
}> {
  /**
   * プレイヤー作成（Branded Types対応）
   */
  static create(id: string, position: Vector3Data = ZERO_VECTOR): Player {
    return new Player({
      state: {
        id: PlayerId(id),
        position: {
          x: Coordinate(position.x),
          y: Coordinate(position.y),
          z: Coordinate(position.z)
        },
        velocity: {
          x: Coordinate(0),
          y: Coordinate(0),
          z: Coordinate(0)
        },
        rotation: { yaw: 0, pitch: 0 },
        isOnGround: true,
        health: Health(100),
        isRunning: false
      }
    })
  }

  /**
   * 位置の更新（Branded Types対応）
   */
  updatePosition(newPosition: Vector3Data): Player {
    return new Player({
      state: {
        ...this.state,
        position: {
          x: Coordinate(newPosition.x),
          y: Coordinate(newPosition.y),
          z: Coordinate(newPosition.z)
        }
      }
    })
  }

  /**
   * 速度の更新（Branded Types対応）
   */
  updateVelocity(newVelocity: Vector3Data): Player {
    return new Player({
      state: {
        ...this.state,
        velocity: {
          x: Coordinate(newVelocity.x),
          y: Coordinate(newVelocity.y),
          z: Coordinate(newVelocity.z)
        }
      }
    })
  }

  /**
   * 回転の更新
   */
  updateRotation(yaw: number, pitch: number): Player {
    return new Player({
      state: {
        ...this.state,
        rotation: { yaw, pitch }
      }
    })
  }

  /**
   * 地面接触状態の更新
   */
  setOnGround(onGround: boolean): Player {
    return new Player({
      state: {
        ...this.state,
        isOnGround: onGround
      }
    })
  }

  /**
   * 走行状態の更新
   */
  setRunning(running: boolean): Player {
    return new Player({
      state: {
        ...this.state,
        isRunning: running
      }
    })
  }

  /**
   * Vector3Dataとしての位置取得（Branded Types対応）
   */
  get position(): Vector3Data {
    return new Vector3Data({
      x: Coordinate(this.state.position.x),
      y: Coordinate(this.state.position.y),
      z: Coordinate(this.state.position.z)
    })
  }

  /**
   * Vector3Dataとしての速度取得（Branded Types対応）
   */
  get velocity(): Vector3Data {
    return new Vector3Data({
      x: Coordinate(this.state.velocity.x),
      y: Coordinate(this.state.velocity.y),
      z: Coordinate(this.state.velocity.z)
    })
  }

  /**
   * 前方向ベクトル計算（Branded Types対応）
   */
  get forwardVector(): Vector3Data {
    const yaw = this.state.rotation.yaw
    return new Vector3Data({
      x: Coordinate(Math.sin(yaw)),
      y: Coordinate(0),
      z: Coordinate(-Math.cos(yaw))
    }).normalize()
  }

  /**
   * 右方向ベクトル計算（Branded Types対応）
   */
  get rightVector(): Vector3Data {
    const yaw = this.state.rotation.yaw
    return new Vector3Data({
      x: Coordinate(Math.cos(yaw)),
      y: Coordinate(0),
      z: Coordinate(Math.sin(yaw))
    }).normalize()
  }
}

/**
 * 物理設定定数
 */
export const PLAYER_PHYSICS = {
  WALK_SPEED: 4.3,      // m/s
  RUN_SPEED: 5.6,       // m/s
  JUMP_VELOCITY: 7.2,   // m/s
  GRAVITY: -9.8,        // m/s²
  GROUND_FRICTION: 0.8,
  AIR_FRICTION: 0.98,
  MAX_FALL_SPEED: -20   // m/s
} as const
```

### 🏃 4. プレイヤー移動サービス

```typescript
// src/domain/services/player-movement-service.ts
import { Context, Effect, Ref, Layer, Schema, STM } from "effect"
import { Match } from "effect"
import { Player, PLAYER_PHYSICS } from "../entities/player.js"
import { Vector3Data, DIRECTION_VECTORS, Coordinate } from "../math/vector3.js"

/**
 * 移動エラー（TaggedError定義）
 */
export class MovementError extends Schema.TaggedError<MovementError>("MovementError")(
  "MovementError",
  {
    message: Schema.String
  }
) {}

/**
 * 衝突エラー（TaggedError定義）
 */
export class CollisionError extends Schema.TaggedError<CollisionError>("CollisionError")(
  "CollisionError",
  {
    message: Schema.String,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number
    })
  }
) {}

/**
 * 移動入力データ（Schema定義で型安全性強化）
 */
export const MovementInput = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  run: Schema.Boolean,
  deltaTime: Schema.Number.pipe(Schema.positive())
})

export type MovementInput = Schema.Schema.Type<typeof MovementInput>

/**
 * プレイヤー移動サービス
 *
 * 🎯 学習ポイント：
 * - 物理演算の実装
 * - フレームレート独立の移動計算
 * - 複雑な状態遷移の管理
 */
/**
 * プレイヤー移動サービス（Layer構造で定義）
 */
export interface PlayerMovementService {
  readonly updateMovement: (
    player: Player,
    input: MovementInput
  ) => Effect.Effect<Player, MovementError | CollisionError>

  readonly checkCollision: (
    currentPosition: Vector3Data,
    newPosition: Vector3Data
  ) => Effect.Effect<boolean, CollisionError>

  readonly validateMovementInput: (
    input: unknown
  ) => Effect.Effect<MovementInput, MovementError>
}

export const PlayerMovementService = Context.GenericTag<PlayerMovementService>(
  "PlayerMovementService"
)

/**
 * プレイヤー移動サービスの実装
 */
class PlayerMovementServiceImpl implements PlayerMovementService {
  validateMovementInput(input: unknown): Effect.Effect<MovementInput, MovementError> {
    return Effect.gen(function* () {
      try {
        return Schema.decodeUnknownSync(MovementInput)(input)
      } catch (error) {
        return yield* new MovementError({
          message: `無効な移動入力: ${error}`
        })
      }
    })
  }

  updateMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      // Early Return: 入力検証
      const validInput = yield* this.validateMovementInput(input)

      // Match.valueでパターンマッチング（if/elseの置換）
      const movementType = Match.value({
        hasInput: validInput.forward || validInput.backward || validInput.left || validInput.right,
        isJumping: validInput.jump && player.state.isOnGround,
        isRunning: validInput.run
      }).pipe(
        Match.when({ hasInput: true, isJumping: true, isRunning: true }, () => "SPRINT_JUMP" as const),
        Match.when({ hasInput: true, isJumping: true }, () => "JUMP" as const),
        Match.when({ hasInput: true, isRunning: true }, () => "SPRINT" as const),
        Match.when({ hasInput: true }, () => "WALK" as const),
        Match.when({ isJumping: true }, () => "JUMP_ONLY" as const),
        Match.orElse(() => "IDLE" as const)
      )

      // ネスト最大3レベルに制限した処理
      return yield* this.processMovement(player, validInput, movementType)
    }).bind(this)
  }

  checkCollision(currentPosition: Vector3Data, newPosition: Vector3Data): Effect.Effect<boolean, CollisionError> {
    return Effect.gen(function* () {
      // STM.atomicallyで衝突判定をアトミックに実行
      return yield* STM.atomically(
        STM.sync(() => {
          const WORLD_BOUNDARY = 50

          // パターンマッチングで衝突タイプを判定
          const collisionType = Match.value(newPosition).pipe(
            Match.when(
              (pos) => Math.abs(pos.x) > WORLD_BOUNDARY,
              () => "X_BOUNDARY" as const
            ),
            Match.when(
              (pos) => Math.abs(pos.z) > WORLD_BOUNDARY,
              () => "Z_BOUNDARY" as const
            ),
            Match.when(
              (pos) => pos.y < -10,
              () => "FALL_LIMIT" as const
            ),
            Match.when(
              (pos) => pos.y > 100,
              () => "HEIGHT_LIMIT" as const
            ),
            Match.orElse(() => "NONE" as const)
          )

          return collisionType !== "NONE"
        })
      )
    })
  }

  /**
   * 移動処理の実行（単一責務の原則に従い分離）
   */
  private processMovement(
    player: Player,
    input: MovementInput,
    movementType: "IDLE" | "WALK" | "SPRINT" | "JUMP_ONLY" | "JUMP" | "SPRINT_JUMP"
  ): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      // Match.typeでswitch文を置換
      return yield* Match.type<typeof movementType>().pipe(
        Match.tag("IDLE", () => this.processIdleMovement(player, input)),
        Match.tag("WALK", () => this.processWalkMovement(player, input)),
        Match.tag("SPRINT", () => this.processSprintMovement(player, input)),
        Match.tag("JUMP_ONLY", () => this.processJumpOnlyMovement(player, input)),
        Match.tag("JUMP", () => this.processJumpMovement(player, input)),
        Match.tag("SPRINT_JUMP", () => this.processSprintJumpMovement(player, input)),
        Match.exhaustive
      )(movementType)
    }).bind(this)
  }

  /**
   * 待機状態の処理（PBT対応の関数粒度）
   */
  private processIdleMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      let newPlayer = yield* applyGravity(player, input.deltaTime)
      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer)
    }).bind(this)
  }

  /**
   * 歩行状態の処理（PBT対応の関数粒度）
   */
  private processWalkMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      const inputDirection = calculateInputDirection(player, input)
      let newPlayer = yield* applyHorizontalMovement(player, inputDirection, input)
      newPlayer = yield* applyGravity(newPlayer, input.deltaTime)

      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer.setRunning(false))
    }).bind(this)
  }

  /**
   * 走行状態の処理（PBT対応の関数粒度）
   */
  private processSprintMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      const inputDirection = calculateInputDirection(player, input)
      let newPlayer = yield* applyHorizontalMovement(player, inputDirection, input)
      newPlayer = yield* applyGravity(newPlayer, input.deltaTime)

      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer.setRunning(true))
    }).bind(this)
  }

  /**
   * ジャンプのみの処理（PBT対応の関数粒度）
   */
  private processJumpOnlyMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      let newPlayer = player.updateVelocity(
        player.velocity.add(new Vector3Data({
          x: Coordinate(0),
          y: Coordinate(PLAYER_PHYSICS.JUMP_VELOCITY),
          z: Coordinate(0)
        }))
      ).setOnGround(false)

      newPlayer = yield* applyGravity(newPlayer, input.deltaTime)

      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer.setRunning(false))
    }).bind(this)
  }

  /**
   * 歩行ジャンプの処理（PBT対応の関数粒度）
   */
  private processJumpMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      const inputDirection = calculateInputDirection(player, input)
      let newPlayer = yield* applyHorizontalMovement(player, inputDirection, input)

      newPlayer = newPlayer.updateVelocity(
        newPlayer.velocity.add(new Vector3Data({
          x: Coordinate(0),
          y: Coordinate(PLAYER_PHYSICS.JUMP_VELOCITY),
          z: Coordinate(0)
        }))
      ).setOnGround(false)

      newPlayer = yield* applyGravity(newPlayer, input.deltaTime)

      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer.setRunning(false))
    }).bind(this)
  }

  /**
   * 走行ジャンプの処理（PBT対応の関数粒度）
   */
  private processSprintJumpMovement(player: Player, input: MovementInput): Effect.Effect<Player, MovementError | CollisionError> {
    return Effect.gen(function* () {
      const inputDirection = calculateInputDirection(player, input)
      let newPlayer = yield* applyHorizontalMovement(player, inputDirection, input)

      newPlayer = newPlayer.updateVelocity(
        newPlayer.velocity.add(new Vector3Data({
          x: Coordinate(0),
          y: Coordinate(PLAYER_PHYSICS.JUMP_VELOCITY),
          z: Coordinate(0)
        }))
      ).setOnGround(false)

      newPlayer = yield* applyGravity(newPlayer, input.deltaTime)

      const newPosition = newPlayer.position.add(
        newPlayer.velocity.multiply(input.deltaTime)
      )

      const hasCollision = yield* this.checkCollision(player.position, newPosition)
      if (!hasCollision) {
        newPlayer = newPlayer.updatePosition(newPosition)
      }

      return yield* this.applyGroundCheck(newPlayer.setRunning(true))
    }).bind(this)
  }

  /**
   * 地面接触判定の適用（PBT対応の関数粒度）
   */
  private applyGroundCheck(player: Player): Effect.Effect<Player, never> {
    return Effect.sync(() => {
      // Early Return: 既に地面より上にいる場合
      if (player.position.y > 0) {
        return player
      }

      // 地面に接触
      const groundPosition = new Vector3Data({
        x: player.position.x,
        y: Coordinate(0),
        z: player.position.z
      })

      const groundVelocity = new Vector3Data({
        x: player.velocity.x,
        y: Coordinate(0),
        z: player.velocity.z
      })

      return player
        .updatePosition(groundPosition)
        .updateVelocity(groundVelocity)
        .setOnGround(true)
    })
  }
}

/**
 * 入力方向の計算（Early Return実装とパターンマッチング）
 */
function calculateInputDirection(player: Player, input: MovementInput): Vector3Data {
  let direction = ZERO_VECTOR

  // Early Return: 入力がない場合
  if (!input.forward && !input.backward && !input.left && !input.right) {
    return direction
  }

  // パターンマッチングでの方向計算
  const horizontalInput = Match.value({ forward: input.forward, backward: input.backward }).pipe(
    Match.when({ forward: true, backward: false }, () => player.forwardVector),
    Match.when({ forward: false, backward: true }, () => player.forwardVector.multiply(-1)),
    Match.orElse(() => ZERO_VECTOR)
  )

  const verticalInput = Match.value({ left: input.left, right: input.right }).pipe(
    Match.when({ left: true, right: false }, () => player.rightVector.multiply(-1)),
    Match.when({ left: false, right: true }, () => player.rightVector),
    Match.orElse(() => ZERO_VECTOR)
  )

  direction = horizontalInput.add(verticalInput)

  // Early Return: 正規化が不要な場合
  return direction.magnitude > 0 ? direction.normalize() : direction
}

/**
 * 水平移動の適用（Early Return実装とパターンマッチング）
 */
function applyHorizontalMovement(
  player: Player,
  inputDirection: Vector3Data,
  input: MovementInput
): Effect.Effect<Player, never> {
  return Effect.sync(() => {
    // Early Return: 入力がない場合は摩擦のみ適用
    if (inputDirection.magnitude === 0) {
      const friction = player.state.isOnGround ? PLAYER_PHYSICS.GROUND_FRICTION : PLAYER_PHYSICS.AIR_FRICTION
      const currentHorizontalVelocity = new Vector3Data({
        x: player.velocity.x,
        y: Coordinate(0),
        z: player.velocity.z
      })

      const newHorizontalVelocity = currentHorizontalVelocity.multiply(friction)
      const newVelocity = new Vector3Data({
        x: newHorizontalVelocity.x,
        y: player.velocity.y,
        z: newHorizontalVelocity.z
      })

      return player.updateVelocity(newVelocity)
    }

    // パターンマッチングで速度とタイプを決定
    const movementParams = Match.value({ run: input.run, onGround: player.state.isOnGround }).pipe(
      Match.when(
        { run: true, onGround: true },
        () => ({ speed: PLAYER_PHYSICS.RUN_SPEED, friction: PLAYER_PHYSICS.GROUND_FRICTION })
      ),
      Match.when(
        { run: false, onGround: true },
        () => ({ speed: PLAYER_PHYSICS.WALK_SPEED, friction: PLAYER_PHYSICS.GROUND_FRICTION })
      ),
      Match.when(
        { run: true, onGround: false },
        () => ({ speed: PLAYER_PHYSICS.RUN_SPEED, friction: PLAYER_PHYSICS.AIR_FRICTION })
      ),
      Match.orElse(
        () => ({ speed: PLAYER_PHYSICS.WALK_SPEED, friction: PLAYER_PHYSICS.AIR_FRICTION })
      )
    )

    const targetVelocity = inputDirection.multiply(movementParams.speed)
    const currentHorizontalVelocity = new Vector3Data({
      x: player.velocity.x,
      y: Coordinate(0),
      z: player.velocity.z
    })

    const newHorizontalVelocity = currentHorizontalVelocity
      .add(targetVelocity.subtract(currentHorizontalVelocity).multiply(movementParams.friction))

    const newVelocity = new Vector3Data({
      x: newHorizontalVelocity.x,
      y: player.velocity.y,
      z: newHorizontalVelocity.z
    })

    return player.updateVelocity(newVelocity)
  })
}

/**
 * 重力の適用（Early Return実装）
 */
function applyGravity(player: Player, deltaTime: number): Effect.Effect<Player, never> {
  return Effect.sync(() => {
    // Early Return: 地面にいる場合は重力を適用しない
    if (player.state.isOnGround) {
      return player
    }

    const gravityVelocity = new Vector3Data({
      x: Coordinate(0),
      y: Coordinate(PLAYER_PHYSICS.GRAVITY * deltaTime),
      z: Coordinate(0)
    })

    let newVelocity = player.velocity.add(gravityVelocity)

    // Early Return: 最大落下速度制限チェック
    if (newVelocity.y >= PLAYER_PHYSICS.MAX_FALL_SPEED) {
      return player.updateVelocity(newVelocity)
    }

    // 最大落下速度で制限
    newVelocity = new Vector3Data({
      x: newVelocity.x,
      y: Coordinate(PLAYER_PHYSICS.MAX_FALL_SPEED),
      z: newVelocity.z
    })

    return player.updateVelocity(newVelocity)
  })
}

/**
 * 簡易衝突検出（削除 - ServiceのcheckCollisionメソッドに統合済み）
 */

/**
 * PlayerMovementServiceの実装を提供するLayer（サービス定義）
 */
export const PlayerMovementServiceLive = Layer.effect(
  PlayerMovementService,
  Effect.gen(function* () {
    const service = new PlayerMovementServiceImpl()
    yield* Effect.log('🏃 PlayerMovementService初期化完了')
    return service
  })
)
```

### 🎨 5. Three.js統合レンダラー

```typescript
// src/infrastructure/three-renderer.ts
import { Context, Effect, Ref, Layer, Schema } from "effect"
import { Match } from "effect"
import * as THREE from "three"
import { Player } from "../domain/entities/player.js"
import { Vector3Data, Coordinate } from "../domain/math/vector3.js"

/**
 * レンダラーエラー（TaggedError定義）
 */
export class RendererError extends Schema.TaggedError<RendererError>("RendererError")(
  "RendererError",
  {
    message: Schema.String
  }
) {}

/**
 * Three.jsレンダラーサービス
 *
 * 🎯 学習ポイント：
 * - 外部ライブラリとEffect-TSの統合
 * - 3Dシーンの管理
 * - レンダリングループの実装
 */
/**
 * Three.jsレンダラーサービス（Layer構造で定義）
 */
export interface ThreeRenderer {
  readonly initialize: (container: HTMLElement) => Effect.Effect<void, RendererError>
  readonly updatePlayer: (player: Player) => Effect.Effect<void, RendererError>
  readonly render: () => Effect.Effect<void, RendererError>
  readonly dispose: () => Effect.Effect<void, RendererError>
  readonly getCamera: () => Effect.Effect<THREE.Camera, RendererError>
  readonly getRenderer: () => Effect.Effect<THREE.WebGLRenderer | null, RendererError>
}

export const ThreeRenderer = Context.GenericTag<ThreeRenderer>("ThreeRenderer")

/**
 * Three.jsレンダラーの実装
 */
class ThreeRendererImpl implements ThreeRenderer {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  private renderer: THREE.WebGLRenderer | null = null
  private playerMesh: THREE.Mesh | null = null
  private groundMesh: THREE.Mesh | null = null

  initialize(container: HTMLElement): Effect.Effect<void, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: 既に初期化済みの場合
      if (self.renderer !== null) {
        yield* Effect.log('⚠️ Three.jsレンダラーは既に初期化済みです')
        return
      }

      // Effect.catchTagsでエラーハンドリング（従来のtry/catchを置換）
      yield* Effect.gen(function* () {
        // レンダラー作成
        self.renderer = new THREE.WebGLRenderer({ antialias: true })
        self.renderer.setSize(container.clientWidth, container.clientHeight)
        self.renderer.setClearColor(0x87CEEB) // 空色
        container.appendChild(self.renderer.domElement)

        // カメラ設定
        self.camera.aspect = container.clientWidth / container.clientHeight
        self.camera.position.set(0, 5, 10)
        self.camera.lookAt(0, 0, 0)

        // シーンの基本設定
        yield* self.setupScene()

        // リサイズイベント処理
        const handleResize = () => {
          if (self.renderer) {
            self.camera.aspect = container.clientWidth / container.clientHeight
            self.camera.updateProjectionMatrix()
            self.renderer.setSize(container.clientWidth, container.clientHeight)
          }
        }

        window.addEventListener('resize', handleResize)

        yield* Effect.log('✅ Three.jsレンダラー初期化完了')
      }).pipe(
        Effect.catchTags({
          UnknownException: (error) =>
            new RendererError({ message: `Three.jsレンダラー初期化エラー: ${error.message}` })
        })
      )
    }).bind(this)
  }

  /**
   * シーンの基本設定
   */
  private setupScene(): Effect.Effect<void, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Effect.allでシーンセットアップを並列実行
      yield* Effect.all([
        self.setupLights(),
        self.setupGround(),
        self.setupPlayer(),
        self.setupDebugHelpers()
      ])

      yield* Effect.log('🎨 Three.jsシーン作成完了')
    }).bind(this)
  }

  /**
   * ライト設定（単一責務の原則に従い分離）
   */
  private setupLights(): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(10, 10, 5)
      directionalLight.castShadow = true
      this.scene.add(directionalLight)
    })
  }

  /**
   * 地面設定（単一責務の原則に従い分離）
   */
  private setupGround(): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      const groundGeometry = new THREE.PlaneGeometry(100, 100)
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 })
      this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
      this.groundMesh.rotation.x = -Math.PI / 2
      this.groundMesh.receiveShadow = true
      this.scene.add(this.groundMesh)
    })
  }

  /**
   * プレイヤーメッシュ設定（単一責務の原則に従い分離）
   */
  private setupPlayer(): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      const playerGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.3)
      const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 })
      this.playerMesh = new THREE.Mesh(playerGeometry, playerMaterial)
      this.playerMesh.castShadow = true
      this.scene.add(this.playerMesh)
    })
  }

  /**
   * デバッグヘルパー設定（単一責務の原則に従い分離）
   */
  private setupDebugHelpers(): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      const gridHelper = new THREE.GridHelper(100, 50, 0x000000, 0x404040)
      this.scene.add(gridHelper)
    })
  }

  updatePlayer(player: Player): Effect.Effect<void, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: プレイヤーメッシュが存在しない場合
      if (!self.playerMesh) {
        return yield* new RendererError({ message: 'プレイヤーメッシュが初期化されていません' })
      }

      // Effect.allでプレイヤー更新処理を並列実行
      yield* Effect.all([
        self.updatePlayerPosition(player),
        self.updatePlayerRotation(player),
        self.updateCamera(player)
      ])
    }).bind(this)
  }

  /**
   * プレイヤー位置更新（単一責務の原則に従い分離）
   */
  private updatePlayerPosition(player: Player): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      if (!this.playerMesh) return

      this.playerMesh.position.set(
        player.position.x,
        player.position.y + 0.9,
        player.position.z
      )
    })
  }

  /**
   * プレイヤー回転更新（単一責務の原則に従い分離）
   */
  private updatePlayerRotation(player: Player): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      if (!this.playerMesh) return

      this.playerMesh.rotation.y = player.state.rotation.yaw
    })
  }

  /**
   * カメラ更新（単一責務の原則に従い分離）
   */
  private updateCamera(player: Player): Effect.Effect<void, RendererError> {
    return Effect.sync(() => {
      const cameraDistance = 8
      const cameraHeight = 5

      const cameraPosition = player.position
        .subtract(player.forwardVector.multiply(cameraDistance))
        .add(new Vector3Data({
          x: Coordinate(0),
          y: Coordinate(cameraHeight),
          z: Coordinate(0)
        }))

      this.camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
      this.camera.lookAt(player.position.x, player.position.y + 1, player.position.z)
    })
  }

  render(): Effect.Effect<void, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: レンダラーが存在しない場合
      if (!self.renderer) {
        return yield* new RendererError({ message: 'レンダラーが初期化されていません' })
      }

      yield* Effect.sync(() => {
        self.renderer!.render(self.scene, self.camera)
      })
    }).bind(this)
  }

  getCamera(): Effect.Effect<THREE.Camera, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: カメラが存在しない場合
      if (!self.camera) {
        return yield* new RendererError({ message: 'カメラが初期化されていません' })
      }

      return self.camera
    }).bind(this)
  }

  getRenderer(): Effect.Effect<THREE.WebGLRenderer | null, RendererError> {
    return Effect.succeed(this.renderer)
  }

  dispose(): Effect.Effect<void, RendererError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: 既に破棄済みの場合
      if (!self.renderer) {
        yield* Effect.log('⚠️ レンダラーは既に破棄されています')
        return
      }

      yield* Effect.sync(() => {
        self.renderer!.dispose()
        self.renderer = null
      })

      yield* Effect.log('🗑️ Three.jsレンダラー破棄完了')
    }).bind(this)
  }
}

/**
 * ThreeRendererの実装を提供するLayer（サービス定義）
 */
export const ThreeRendererLive = Layer.effect(
  ThreeRenderer,
  Effect.gen(function* () {
    const service = new ThreeRendererImpl()
    yield* Effect.log('🎨 ThreeRenderer初期化完了')
    return service
  })
)
```

### 🎮 6. ゲームループシステム

```typescript
// src/application/game-loop.ts
import { Context, Effect, Ref, Schedule, Layer, Schema } from "effect"
import { Match } from "effect"
import { Player, PlayerId } from "../domain/entities/player.js"
import { PlayerMovementService, MovementInput } from "../domain/services/player-movement-service.js"
import { InputSystem, MovementInputState } from "../infrastructure/input-system.js"
import { ThreeRenderer } from "../infrastructure/three-renderer.js"

/**
 * ゲームループエラー（TaggedError定義）
 */
export class GameLoopError extends Schema.TaggedError<GameLoopError>("GameLoopError")(
  "GameLoopError",
  {
    message: Schema.String
  }
) {}

/**
 * ゲームループサービス
 *
 * 🎯 学習ポイント：
 * - Scheduleによる定期実行
 * - Refによる状態管理
 * - 複数サービスの協調動作
 * - フレームレート管理
 */
/**
 * ゲームループサービス（Layer構造で定義）
 */
export interface GameLoop {
  readonly start: () => Effect.Effect<void, GameLoopError>
  readonly stop: () => Effect.Effect<void, GameLoopError>
  readonly getPlayer: () => Effect.Effect<Player, GameLoopError>
  readonly isRunning: () => Effect.Effect<boolean, GameLoopError>
}

export const GameLoop = Context.GenericTag<GameLoop>("GameLoop")

/**
 * ゲームループの実装
 */
class GameLoopImpl implements GameLoop {
  private player: Ref.Ref<Player>
  private isRunning: Ref.Ref<boolean>
  private lastTime: Ref.Ref<number>
  private frameCount: Ref.Ref<number>

  constructor() {
    this.player = Ref.unsafeMake(Player.create(PlayerId("player-1")))
    this.isRunning = Ref.unsafeMake(false)
    this.lastTime = Ref.unsafeMake(performance.now())
    this.frameCount = Ref.unsafeMake(0)
  }

  isRunning(): Effect.Effect<boolean, GameLoopError> {
    return Ref.get(this.isRunning)
  }

  start(): Effect.Effect<void, GameLoopError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: 既に実行中の場合
      const running = yield* Ref.get(self.isRunning)
      if (running) {
        yield* Effect.log('⚠️ ゲームループは既に実行中です')
        return
      }

      yield* Ref.set(self.isRunning, true)
      yield* Effect.log('🎮 ゲームループ開始')

      // メインゲームループ
      const gameLoop = Effect.gen(function* () {
        const running = yield* Ref.get(self.isRunning)

        // Early Return: 実行停止の場合
        if (!running) {
          return
        }

        // デルタタイム計算
        const currentTime = performance.now()
        const lastTime = yield* Ref.get(self.lastTime)
        const deltaTime = (currentTime - lastTime) / 1000
        yield* Ref.set(self.lastTime, currentTime)

        // フレームカウント更新
        yield* Ref.update(self.frameCount, (count) => count + 1)

        // パターンマッチングでFPS表示判定
        const frameCount = yield* Ref.get(self.frameCount)
        const shouldShowFPS = Match.value(frameCount % 60).pipe(
          Match.when(0, () => true),
          Match.orElse(() => false)
        )

        if (shouldShowFPS) {
          yield* Effect.log(`📊 FPS: ${Math.round(1 / deltaTime)}`)
        }

        // ゲーム更新処理
        yield* self.updateGame(deltaTime)
      })

      // 60FPSでループ実行
      yield* gameLoop.pipe(
        Effect.repeat(Schedule.fixed("16ms")),
        Effect.fork
      )
    }).bind(this)
  }

  /**
   * ゲーム更新処理（Effect.catchTagsでエラーハンドリング）
   */
  private updateGame(deltaTime: number): Effect.Effect<void, GameLoopError> {
    return Effect.gen(function* () {
      const self = this

      const inputSystem = yield* InputSystem
      const movementService = yield* PlayerMovementService
      const renderer = yield* ThreeRenderer

      // Early Return: デルタタイムが異常値の場合
      if (deltaTime <= 0 || deltaTime > 1) {
        yield* Effect.log(`⚠️ 異常なデルタタイム: ${deltaTime}秒`)
        return
      }

      // Effect.allで並列処理可能な部分を最適化
      const [movementInput, currentPlayer] = yield* Effect.all([
        inputSystem.getMovementInput(),
        Ref.get(self.player)
      ])

      // 移動入力の型安全な構築
      const input = Schema.decodeUnknownSync(MovementInput)({
        ...movementInput,
        deltaTime
      })

      // プレイヤー更新
      const updatedPlayer = yield* movementService.updateMovement(currentPlayer, input)
      yield* Ref.set(self.player, updatedPlayer)

      // Effect.allでレンダリング処理を並列化
      yield* Effect.all([
        renderer.updatePlayer(updatedPlayer),
        renderer.render(),
        inputSystem.resetFrameState()
      ])
    }).pipe(
      // Effect.catchTagsで各種エラーを処理（従来のtry/catchを置換）
      Effect.catchTags({
        InputSystemError: (error) =>
          new GameLoopError({ message: `入力システムエラー: ${error.message}` }),
        MovementError: (error) =>
          new GameLoopError({ message: `移動システムエラー: ${error.message}` }),
        CollisionError: (error) =>
          new GameLoopError({ message: `衝突検出エラー: ${error.message}` }),
        RendererError: (error) =>
          new GameLoopError({ message: `レンダラーエラー: ${error.message}` })
      })
    ).bind(this)
  }

  stop(): Effect.Effect<void, GameLoopError> {
    return Effect.gen(function* () {
      const self = this

      // Early Return: 既に停止済みの場合
      const running = yield* Ref.get(self.isRunning)
      if (!running) {
        yield* Effect.log('⚠️ ゲームループは既に停止しています')
        return
      }

      yield* Ref.set(self.isRunning, false)
      yield* Effect.log('⏹️ ゲームループ停止')
    }).bind(this)
  }

  getPlayer(): Effect.Effect<Player, GameLoopError> {
    return Effect.gen(function* () {
      const self = this

      return yield* Ref.get(self.player)
    }).bind(this)
  }
}

/**
 * GameLoopの実装を提供するLayer（サービス定義）
 */
export const GameLoopLive = Layer.effect(
  GameLoop,
  Effect.gen(function* () {
    const service = new GameLoopImpl()
    yield* Effect.log('🎮 GameLoop初期化完了')
    return service
  })
)
```

### 🚀 7. メインアプリケーション

```typescript
// src/main.ts
import { Effect, Layer, Console, Exit, Schema } from "effect"
import { Match } from "effect"
import { BrowserInputSystemLive } from "./infrastructure/input-system.js"
import { PlayerMovementServiceLive } from "./domain/services/player-movement-service.js"
import { ThreeRendererLive } from "./infrastructure/three-renderer.js"
import { GameLoopLive, GameLoop, GameLoopError } from "./application/game-loop.js"
import { ThreeRenderer, RendererError } from "./infrastructure/three-renderer.js"

/**
 * アプリケーションエラー（TaggedError定義）
 */
export class ApplicationError extends Schema.TaggedError<ApplicationError>("ApplicationError")(
  "ApplicationError",
  {
    message: Schema.String
  }
) {}

/**
 * メインアプリケーション（Effect-TSパターン適用）
 */
const program = Effect.gen(function* () {
  yield* Console.log('🚀 プレイヤー移動システム起動中...')

  // DOM要素の取得（Early Return実装）
  const container = yield* Effect.gen(function* () {
    const element = document.getElementById('game-container')

    // Early Return: DOM要素が見つからない場合
    if (!element) {
      return yield* new ApplicationError({
        message: 'game-container要素が見つかりません'
      })
    }

    return element
  })

  // Effect.allでサービス取得を並列化
  const [renderer, gameLoop] = yield* Effect.all([
    ThreeRenderer,
    GameLoop
  ])

  // Effect.allで初期化処理を並列実行
  yield* Effect.all([
    renderer.initialize(container),
    Effect.log('🎨 レンダラー初期化中...')
  ])

  // ゲームループ開始
  yield* gameLoop.start()

  yield* Effect.all([
    Console.log('✅ アプリケーション起動完了'),
    Console.log('🎮 操作方法:'),
    Console.log('  - WASD: 移動'),
    Console.log('  - Shift: 走行'),
    Console.log('  - Space: ジャンプ')
  ])

  // 10秒後に停止（デモ用）
  yield* Effect.sleep("10s")

  // Effect.allで終了処理を並列実行
  yield* Effect.all([
    gameLoop.stop(),
    renderer.dispose()
  ])

  yield* Console.log('🎯 デモ完了！')
}).pipe(
  // Effect.catchTagsで各種エラーを処理（従来のtry/catchを置換）
  Effect.catchTags({
    ApplicationError: (error) => Console.error(`❌ アプリケーションエラー: ${error.message}`),
    GameLoopError: (error) => Console.error(`❌ ゲームループエラー: ${error.message}`),
    RendererError: (error) => Console.error(`❌ レンダラーエラー: ${error.message}`)
  })
)

/**
 * HTMLページの作成
 */
const createHTML = (): string => `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>プレイヤー移動システム - Effect-TS + Three.js</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            font-family: Arial, sans-serif;
            overflow: hidden;
        }
        #game-container {
            width: 100vw;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #ui-overlay {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            z-index: 1000;
            font-size: 14px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div id="ui-overlay">
        <h3>🎮 プレイヤー移動システム</h3>
        <p>WASD: 移動 | Shift: 走行 | Space: ジャンプ</p>
        <p>青いボックスがプレイヤーです</p>
    </div>
    <div id="game-container"></div>
</body>
</html>
`

/**
 * アプリケーション実行
 */
const runnable = program.pipe(
  Effect.provide(GameLoopLive),
  Effect.provide(ThreeRendererLive),
  Effect.provide(PlayerMovementServiceLive),
  Effect.provide(BrowserInputSystemLive)
)

// ブラウザ環境でのみ実行（パターンマッチング適用）
const runApplication = Match.value(typeof window !== 'undefined').pipe(
  Match.when(true, () =>
    Effect.gen(function* () {
      // Early Return: HTMLが既に読み込まれている場合
      if (!document.getElementById('game-container')) {
        document.write(createHTML())
      }

      const exit = yield* Effect.runPromiseExit(runnable)

      // パターンマッチングで実行結果を処理
      const result = Match.value(Exit.isFailure(exit)).pipe(
        Match.when(true, () =>
          console.error('❌ アプリケーション実行エラー:', exit.cause)
        ),
        Match.when(false, () =>
          console.log('✅ アプリケーション正常終了')
        )
      )

      return result
    })
  ),
  Match.when(false, () =>
    Effect.sync(() => console.log('⚠️ このデモはブラウザ環境で実行してください'))
  )
)

// アプリケーション実行
Effect.runPromise(runApplication)
```

## 🧪 実行方法

### 1️⃣ 開発サーバー起動

```bash
# Vite開発サーバーで実行
pnpm dev

# または、簡単なHTTPサーバーで実行
npx serve . -p 3000
```

### 2️⃣ ブラウザでアクセス

```
http://localhost:3000
```

### 3️⃣ 操作確認

- **WASD**: プレイヤー移動
- **Shift**: 走行（速度アップ）
- **Space**: ジャンプ
- **カメラ**: 自動的にプレイヤーを追従

## 🎯 学習ポイント

### 1️⃣ **Effect-TS + Three.js統合**

```typescript
// ✅ 外部ライブラリの安全な統合
const updateRenderer = (player: Player): Effect.Effect<void, never> =>
  Effect.sync(() => {
    playerMesh.position.set(player.position.x, player.position.y, player.position.z)
  })
```

### 2️⃣ **リアルタイム状態管理**

```typescript
// ✅ Refによる可変状態の管理
const gameState = Ref.unsafeMake({ player, isRunning: true })

// ✅ 不変データ構造による状態更新
const newPlayer = player.updatePosition(newPosition)
```

### 3️⃣ **スケジューリング**

```typescript
// ✅ 定期実行による60FPSゲームループ
gameLoop.pipe(
  Effect.repeat(Schedule.fixed("16ms")),
  Effect.fork
)
```

## 🔧 カスタマイズアイデア

### 🎮 1. 操作拡張

```typescript
// マウス視点操作の追加
interface MouseInput {
  readonly deltaX: number
  readonly deltaY: number
  readonly sensitivity: number
}

// カメラ視点更新
const updateCameraRotation = (player: Player, mouse: MouseInput): Player =>
  player.updateRotation(
    player.state.rotation.yaw + mouse.deltaX * mouse.sensitivity,
    player.state.rotation.pitch + mouse.deltaY * mouse.sensitivity
  )
```

### 🌍 2. ワールド統合

```typescript
// ブロック配置システムとの統合
const checkBlockCollision = (position: Vector3Data): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const blockService = yield* BlockService
    const block = yield* blockService.getBlock(position)
    return block !== null
  })
```

### ⚡ 3. パフォーマンス最適化

```typescript
// フラスタム カリングの実装
const optimizeRendering = (player: Player): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // 視界外オブジェクトの描画スキップ
    objects.forEach(obj => {
      obj.visible = isInViewFrustum(obj, camera)
    })
  })
```

## 🔗 次のステップ

1. **[インベントリ管理](./03-inventory-management.md)** - UI統合とデータ管理
2. **[高度なパターン](../02-advanced-patterns/README.md)** - Effect合成の応用
3. **[統合例](../03-integration-examples/README.md)** - 完全なゲームシステム

---

**🎉 素晴らしい！3Dプレイヤー移動システムが完成しました！**
**Effect-TSとThree.jsの強力な組み合わせを体験できましたね。**