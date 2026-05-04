---
title: 'Effect-TS Match パターン - 高度なパターンマッチング'
description: 'Effect-TS 3.17+ Match モジュールによる条件分岐の完全置換。if/else/switch を使わない宣言的プログラミング実践ガイド。'
category: 'architecture'
difficulty: 'advanced'
tags: ['effect-ts', 'pattern-matching', 'match', 'functional-programming', 'type-safety']
prerequisites: ['effect-ts-basics', 'typescript-advanced', 'discriminated-unions']
estimated_reading_time: '30分'
---

# Effect-TS Match パターン - 高度なパターンマッチング

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [アーキテクチャ](./README.md) → **Effect-TS Matchパターン**
>
> **🎯 学習目標**: if/else/switch を完全に排除した宣言的パターンマッチング
>
> **⏱️ 所要時間**: 30分（実践的理解）
>
> **📚 前提知識**: [Effect-TSパターン](./06-effect-ts-patterns.md) → [エラーハンドリング](./06c-effect-ts-error-handling.md)

---

## 1. Match モジュール概要

Effect-TS の `Match` モジュールは、TypeScript における **完全な型安全パターンマッチング** を提供します。比較対象の if/else/switch 文を完全に置き換え、より宣言的で保守性の高いコードを実現します。

### 1.1 なぜ Match を使うのか

```typescript
import { Match, Effect, pipe, Option } from 'effect'

// ❌ 比較対象のアプローチ: 命令的で型安全性が不完全
// if/else/switchを使った古いパターン - 使用禁止
const processValueOld = (value: number | string | boolean) => {
  // 絶対に使わない: if/else の連鎖
  // TypeScriptの型絞り込みが不完全
  // 網羅性チェックなし
  return 'deprecated pattern'
}

// ✅ Match アプローチ: 宣言的で完全な型安全性
const processValue = (value: number | string | boolean) =>
  pipe(
    Match.value(value),
    Match.when(Match.number, (n) =>
      pipe(
        Match.value(n),
        Match.when(
          (x) => x > 100,
          () => 'large'
        ),
        Match.when(
          (x) => x > 50,
          () => 'medium'
        ),
        Match.orElse(() => 'small')
      )
    ),
    Match.when(Match.string, (s) => s.toUpperCase()),
    Match.when(Match.boolean, (b) => (b ? 'true' : 'false')),
    Match.exhaustive
  )
```

## 2. 基本パターン

### 2.1 値によるマッチング

```typescript
import { Match, pipe } from 'effect'

// 単純な値マッチング
const gradeToScore = (grade: string) =>
  pipe(
    Match.value(grade),
    Match.when('A', () => 100),
    Match.when('B', () => 80),
    Match.when('C', () => 60),
    Match.when('D', () => 40),
    Match.orElse(() => 0)
  )

// 複数値のマッチング
const dayType = (day: string) =>
  pipe(
    Match.value(day),
    Match.when('Saturday', 'Sunday', () => 'weekend'),
    Match.when('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', () => 'weekday'),
    Match.exhaustive
  )
```

### 2.2 述語によるマッチング

```typescript
// ✅ 条件関数によるマッチング - if/elseチェーンの完全な代替
// もはやif/else if/elseは一切不要
const categorizeAge = (age: number) =>
  pipe(
    Match.value(age),
    Match.when(
      (a) => a < 0,
      () => 'invalid'
    ),
    Match.when(
      (a) => a < 13,
      () => 'child'
    ),
    Match.when(
      (a) => a < 20,
      () => 'teenager'
    ),
    Match.when(
      (a) => a < 60,
      () => 'adult'
    ),
    Match.orElse(() => 'senior')
  )

// 複雑な条件の組み合わせ
type User = { age: number; role: 'admin' | 'user' | 'guest' }

const getUserPermissions = (user: User) =>
  pipe(
    Match.type<User>(),
    Match.whenAnd({ age: (a) => a >= 18 }, { role: 'admin' }, () => ['read', 'write', 'delete', 'admin']),
    Match.whenAnd({ age: (a) => a >= 18 }, { role: 'user' }, () => ['read', 'write']),
    Match.when({ role: 'guest' }, () => ['read']),
    Match.orElse(() => [])
  )(user)
```

## 3. 判別可能ユニオン（Discriminated Unions）

### 3.1 タグベースマッチング

```typescript
import { Schema, Match, Effect, pipe } from 'effect'

// スキーマ定義
const GameEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerMove'),
    playerId: Schema.String,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('BlockPlace'),
    playerId: Schema.String,
    blockType: Schema.String,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('EntitySpawn'),
    entityType: Schema.String,
    position: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }),
    health: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ChatMessage'),
    playerId: Schema.String,
    message: Schema.String,
    timestamp: Schema.Number,
  })
)
type GameEvent = Schema.Schema.Type<typeof GameEvent>

// タグによる網羅的マッチング
const handleGameEvent = (event: GameEvent): Effect.Effect<void> =>
  pipe(
    Match.value(event),
    Match.tag('PlayerMove', ({ playerId, position }) =>
      Effect.gen(function* () {
        yield* Effect.log(`Player ${playerId} moved to ${position.x}, ${position.y}, ${position.z}`)
        // 移動処理
      })
    ),
    Match.tag('BlockPlace', ({ playerId, blockType, position }) =>
      Effect.gen(function* () {
        yield* Effect.log(`Player ${playerId} placed ${blockType} at ${position.x}, ${position.y}, ${position.z}`)
        // ブロック配置処理
      })
    ),
    Match.tag('EntitySpawn', ({ entityType, position, health }) =>
      Effect.gen(function* () {
        yield* Effect.log(`Spawned ${entityType} with ${health} HP at ${position.x}, ${position.y}, ${position.z}`)
        // エンティティスポーン処理
      })
    ),
    Match.tag('ChatMessage', ({ playerId, message, timestamp }) =>
      Effect.gen(function* () {
        yield* Effect.log(`[${new Date(timestamp).toISOString()}] ${playerId}: ${message}`)
        // チャットメッセージ処理
      })
    ),
    Match.exhaustive
  )
```

### 3.2 タグプレフィックスマッチング

```typescript
// 階層的なタグ構造
type HierarchicalEvent =
  | { _tag: 'System.Start'; timestamp: number }
  | { _tag: 'System.Stop'; timestamp: number; reason: string }
  | { _tag: 'System.Error'; error: Error }
  | { _tag: 'Game.PlayerJoin'; playerId: string }
  | { _tag: 'Game.PlayerLeave'; playerId: string }
  | { _tag: 'Game.WorldSave'; worldId: string }

const handleHierarchicalEvent = (event: HierarchicalEvent) =>
  pipe(
    Match.value(event),
    // System.* にマッチ
    Match.tagStartsWith('System', (systemEvent) =>
      Effect.gen(function* () {
        yield* Effect.log(`System event: ${systemEvent._tag}`)
        // システムイベント処理
      })
    ),
    // Game.* にマッチ
    Match.tagStartsWith('Game', (gameEvent) =>
      Effect.gen(function* () {
        yield* Effect.log(`Game event: ${gameEvent._tag}`)
        // ゲームイベント処理
      })
    ),
    Match.exhaustive
  )
```

## 4. 高度なパターン

### 4.1 複合条件マッチング（whenOr / whenAnd）

```typescript
import { Match, Effect, pipe } from 'effect'

type PlayerAction =
  | { type: 'move'; speed: number; stamina: number }
  | { type: 'attack'; damage: number; weapon: string }
  | { type: 'defend'; shield: number; armor: number }
  | { type: 'heal'; amount: number; potions: number }

// whenOr: 複数条件のいずれかにマッチ
const categorizeAction = (action: PlayerAction) =>
  pipe(
    Match.type<PlayerAction>(),
    // 攻撃的アクション（攻撃または高速移動）
    Match.whenOr({ type: 'attack' }, { type: 'move', speed: (s) => s > 5 }, () => 'offensive'),
    // 防御的アクション
    Match.whenOr({ type: 'defend' }, { type: 'heal' }, () => 'defensive'),
    Match.orElse(() => 'neutral')
  )(action)

// whenAnd: 複数条件すべてにマッチ
type CombatState = {
  health: number
  mana: number
  stamina: number
  inCombat: boolean
}

const determineAbility = (state: CombatState) =>
  pipe(
    Match.type<CombatState>(),
    // 究極技発動条件：すべての条件を満たす
    Match.whenAnd(
      { health: (h) => h > 50 },
      { mana: (m) => m >= 100 },
      { stamina: (s) => s >= 30 },
      { inCombat: true },
      () => 'ultimate_available'
    ),
    // 通常攻撃条件
    Match.whenAnd({ stamina: (s) => s >= 10 }, { inCombat: true }, () => 'normal_attack'),
    Match.orElse(() => 'rest_required')
  )(state)
```

### 4.2 Discriminatorベースの高度なマッチング

```typescript
// discriminator: カスタムフィールドでの判別
type NetworkPacket =
  | { protocol: 'HTTP'; method: 'GET' | 'POST'; url: string }
  | { protocol: 'WebSocket'; event: string; data: unknown }
  | { protocol: 'TCP'; port: number; payload: Buffer }

const handlePacket = pipe(
  Match.type<NetworkPacket>(),
  Match.discriminator('protocol')('HTTP', ({ method, url }) => `HTTP ${method} ${url}`),
  Match.discriminator('protocol')('WebSocket', ({ event, data }) => `WS Event: ${event}`),
  Match.discriminator('protocol')('TCP', ({ port }) => `TCP on port ${port}`),
  Match.exhaustive
)

// discriminatorStartsWith: 階層的な判別
type GameCommand =
  | { command: 'player.move'; x: number; y: number }
  | { command: 'player.attack'; target: string }
  | { command: 'player.inventory.add'; item: string }
  | { command: 'system.save'; slot: number }
  | { command: 'system.load'; slot: number }
  | { command: 'system.config.graphics'; quality: string }

const processCommand = (cmd: GameCommand) =>
  pipe(
    Match.value(cmd),
    // player.* コマンドをまとめて処理
    Match.discriminatorStartsWith('command')('player', (playerCmd) =>
      Effect.gen(function* () {
        yield* Effect.log(`Player command: ${playerCmd.command}`)
        // プレイヤー関連の共通処理
        return handlePlayerCommand(playerCmd)
      })
    ),
    // system.* コマンドをまとめて処理
    Match.discriminatorStartsWith('command')('system', (sysCmd) =>
      Effect.gen(function* () {
        yield* Effect.log(`System command: ${sysCmd.command}`)
        // システム関連の共通処理
        return handleSystemCommand(sysCmd)
      })
    ),
    Match.exhaustive
  )
```

### 4.3 discriminatorsExhaustive: 完全な網羅性保証

```typescript
type RenderStage =
  | { stage: 'init'; canvas: HTMLCanvasElement }
  | { stage: 'loading'; progress: number; assets: string[] }
  | { stage: 'ready'; renderer: WebGLRenderer }
  | { stage: 'error'; message: string; code: number }

// すべてのケースを必須で処理（exhaustive不要）
const renderPipeline = pipe(
  Match.type<RenderStage>(),
  Match.discriminatorsExhaustive('stage')({
    init: ({ canvas }) =>
      Effect.gen(function* () {
        yield* Effect.log('Initializing renderer...')
        return yield* initializeWebGL(canvas)
      }),
    loading: ({ progress, assets }) =>
      Effect.gen(function* () {
        yield* Effect.log(`Loading: ${progress}%`)
        return yield* loadAssets(assets)
      }),
    ready: ({ renderer }) =>
      Effect.gen(function* () {
        yield* Effect.log('Renderer ready')
        return yield* startRenderLoop(renderer)
      }),
    error: ({ message, code }) => Effect.fail(new RendererError(message, code)),
  })
  // Match.exhaustive は不要 - コンパイル時に網羅性が保証される
)
```

### 4.4 型述語とインスタンスマッチング

```typescript
import { Match, pipe, Option, Effect } from "effect"

// カスタムクラスのインスタンスマッチング
interface PlayerEntity {
  constructor(readonly id: string, readonly level: number) {}
}

interface NPCEntity {
  constructor(readonly name: string, readonly dialogue: string[]) {}
}

interface ItemEntity {
  constructor(readonly itemId: string, readonly quantity: number) {}
}

type GameObject = PlayerEntity | NPCEntity | ItemEntity | { type: "block"; id: number }

const processGameObject = (obj: GameObject) =>
  pipe(
    Match.value(obj),
    Match.when(
      Match.instanceOf(PlayerEntity),
      (player) => `Player ${player.id} (Level ${player.level})`
    ),
    Match.when(
      Match.instanceOf(NPCEntity),
      (npc) => `NPC: ${npc.name}`
    ),
    Match.when(
      Match.instanceOf(ItemEntity),
      (item) => `Item: ${item.itemId} x${item.quantity}`
    ),
    Match.when(
      { type: "block" },
      (block) => `Block #${block.id}`
    ),
    Match.exhaustive
  )

// 型ガード組み合わせ
const validateInput = (input: unknown): Effect.Effect<GameObject> =>
  pipe(
    Match.value(input),
    Match.when(Match.string, (s) =>
      Effect.fail(new Error(`String input not supported: ${s}`))
    ),
    Match.when(Match.number, (n) =>
      Effect.succeed({ type: "block" as const, id: n })
    ),
    Match.when(Match.record, (obj) =>
      pipe(
        Match.value(obj),
        Match.when(
          { id: Match.string, level: Match.number },
          ({ id, level }) => Effect.succeed(new PlayerEntity(id, level))
        ),
        Match.when(
          { name: Match.string },
          ({ name }) => Effect.succeed(new NPCEntity(name, []))
        ),
        Match.orElse(() => Effect.fail(new Error("Invalid object structure")))
      )
    ),
    Match.orElse(() => Effect.fail(new Error("Unsupported input type")))
  )
```

### 4.5 非nullableパターンと安全な絞り込み

```typescript
// defined: null/undefined を除外
const processOptionalData = (data: string | number | null | undefined) =>
  pipe(
    Match.value(data),
    Match.when(Match.defined, (definedValue) =>
      // definedValue は string | number 型
      pipe(
        Match.value(definedValue),
        Match.when(Match.string, (s) => s.toUpperCase()),
        Match.when(Match.number, (n) => n.toString()),
        Match.exhaustive
      )
    ),
    Match.orElse(() => 'No data')
  )

// nonEmptyString: 空文字列を除外
const validateUsername = (input: string) =>
  pipe(
    Match.value(input),
    Match.when(Match.nonEmptyString, (username) => Effect.succeed({ username, valid: true })),
    Match.orElse(() => Effect.fail(new Error('Username cannot be empty')))
  )

// not: 特定の値を除外
type ServerStatus = 'running' | 'stopped' | 'maintenance' | 'error'

const canAcceptConnections = (status: ServerStatus) =>
  pipe(
    Match.value(status),
    Match.not(
      'error',
      'maintenance',
      (safeStatus) =>
        // safeStatus は "running" | "stopped" 型
        safeStatus === 'running'
    ),
    Match.orElse(() => false)
  )
```

### 4.6 Option/Either との統合

```typescript
import { Option, Either, Match, pipe } from 'effect'

// Option とのマッチング
const processOptionalValue = <A>(opt: Option.Option<A>) =>
  pipe(
    opt,
    Option.match({
      onNone: () => 'No value present',
      onSome: (value) => `Value: ${value}`,
    })
  )

// Either とのマッチング
const processResult = <E, A>(result: Either.Either<A, E>) =>
  pipe(
    result,
    Either.match({
      onLeft: (error) => `Error: ${error}`,
      onRight: (value) => `Success: ${value}`,
    })
  )

// 複合的なマッチング
type LoadResult<T> =
  | { _tag: 'Loading' }
  | { _tag: 'Success'; data: T }
  | { _tag: 'Error'; error: Error }
  | { _tag: 'Empty' }

const renderLoadResult = <T>(result: LoadResult<T>, renderData: (data: T) => string): string =>
  pipe(
    Match.value(result),
    Match.tag('Loading', () => 'Loading...'),
    Match.tag('Success', ({ data }) => renderData(data)),
    Match.tag('Error', ({ error }) => `Error: ${error.message}`),
    Match.tag('Empty', () => 'No data available'),
    Match.exhaustive
  )
```

## 5. Result型パターンと高度な制御フロー

### 5.1 Match.option / Match.either による結果ラッピング

```typescript
import { Match, Option, Either, pipe } from 'effect'

type ValidationResult = { type: 'valid'; data: unknown } | { type: 'invalid'; errors: string[] } | { type: 'pending' }

// Option でラップ - マッチしない場合は None
const validateWithOption = pipe(
  Match.type<ValidationResult>(),
  Match.when({ type: 'valid' }, ({ data }) => data),
  Match.option // Option<unknown> を返す
)

const result1 = validateWithOption({ type: 'valid', data: 'test' })
// Some("test")

const result2 = validateWithOption({ type: 'pending' })
// None

// Either でラップ - マッチしない場合は Left
const validateWithEither = pipe(
  Match.type<ValidationResult>(),
  Match.when({ type: 'valid' }, ({ data }) => data),
  Match.either // Either<unknown, ValidationResult> を返す
)

const result3 = validateWithEither({ type: 'valid', data: 'test' })
// Right("test")

const result4 = validateWithEither({ type: 'invalid', errors: ['error'] })
// Left({ type: "invalid", errors: ["error"] })
```

### 5.2 Match.orElseAbsurd による厳密な網羅性

```typescript
// 絶対にすべてのケースを処理する必要がある場合
type CriticalSystemState = 'initializing' | 'running' | 'shutting_down'

const handleCriticalState = (state: CriticalSystemState) =>
  pipe(
    Match.value(state),
    Match.when('initializing', () => startSystem()),
    Match.when('running', () => continueOperation()),
    Match.when('shutting_down', () => cleanupResources()),
    Match.orElseAbsurd // 未処理のケースがあれば実行時エラー
  )

// 開発中のデバッグに有用
type DebugEvent = { type: 'log' } | { type: 'error' } | { type: 'warning' }

const debugHandler = pipe(
  Match.type<DebugEvent>(),
  Match.when({ type: 'log' }, () => console.log),
  Match.when({ type: 'error' }, () => console.error),
  // type: "warning" を処理し忘れている
  Match.orElseAbsurd // 開発時に即座にエラーで気付ける
)
```

## 6. 実践的な例

### 6.1 ゲームループの状態管理

```typescript
type GameState =
  | { _tag: 'Menu'; selectedOption: number }
  | { _tag: 'Playing'; world: World; isPaused: boolean }
  | { _tag: 'Loading'; progress: number; target: 'world' | 'resources' }
  | { _tag: 'Error'; message: string; canRetry: boolean }
  | { _tag: 'Exiting'; saveProgress: number }

const updateGameState = (state: GameState, input: InputEvent): Effect.Effect<GameState> =>
  pipe(
    Match.value(state),
    Match.tag('Menu', ({ selectedOption }) =>
      pipe(
        Match.value(input.type),
        Match.when('keyDown', () =>
          pipe(
            Match.value(input.key),
            Match.when('ArrowUp', () =>
              Effect.succeed({
                _tag: 'Menu' as const,
                selectedOption: Math.max(0, selectedOption - 1),
              })
            ),
            Match.when('ArrowDown', () =>
              Effect.succeed({
                _tag: 'Menu' as const,
                selectedOption: Math.min(3, selectedOption + 1),
              })
            ),
            Match.when('Enter', () =>
              pipe(
                Match.value(selectedOption),
                Match.when(0, () => startNewGame()),
                Match.when(1, () => loadSavedGame()),
                Match.when(2, () => openSettings()),
                Match.orElse(() => exitGame())
              )
            ),
            Match.orElse(() => Effect.succeed(state))
          )
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.tag('Playing', ({ world, isPaused }) =>
      pipe(
        Match.value(isPaused),
        Match.when(true, () =>
          pipe(
            Match.value(input.type),
            Match.when('keyDown', () =>
              pipe(
                Match.value(input.key),
                Match.when('Escape', () =>
                  Effect.succeed({
                    _tag: 'Playing' as const,
                    world,
                    isPaused: false,
                  })
                ),
                Match.orElse(() => Effect.succeed(state))
              )
            ),
            Match.orElse(() => Effect.succeed(state))
          )
        ),
        Match.orElse(() => handleGameplay(world, input))
      )
    ),
    Match.tag('Loading', ({ progress, target }) =>
      pipe(
        Match.value(progress),
        Match.when(
          (p) => p >= 100,
          () =>
            pipe(
              Match.value(target),
              Match.when('world', () => enterWorld()),
              Match.when('resources', () => continueLoading()),
              Match.exhaustive
            )
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.tag('Error', ({ message, canRetry }) =>
      pipe(
        Match.value(input.type),
        Match.when('keyDown', () =>
          pipe(
            Match.value(input.key),
            Match.whenAnd(
              'Enter',
              () => canRetry,
              () => retryLastAction()
            ),
            Match.when('Escape', () => returnToMenu()),
            Match.orElse(() => Effect.succeed(state))
          )
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.tag('Exiting', ({ saveProgress }) =>
      pipe(
        Match.value(saveProgress),
        Match.when(
          (p) => p >= 100,
          () => Effect.succeed(state)
        ),
        Match.orElse(() =>
          Effect.succeed({
            _tag: 'Exiting' as const,
            saveProgress: Math.min(100, saveProgress + 10),
          })
        )
      )
    ),
    Match.exhaustive
  )
```

### 6.2 リソース管理とキャッシング

```typescript
type ResourceState<T> =
  | { _tag: 'NotLoaded' }
  | { _tag: 'Loading'; startTime: number }
  | { _tag: 'Loaded'; data: T; lastAccessed: number }
  | { _tag: 'Failed'; error: Error; attempts: number }
  | { _tag: 'Expired'; data: T }

const manageResource = <T>(state: ResourceState<T>, action: ResourceAction): Effect.Effect<ResourceState<T>> =>
  pipe(
    Match.value(action),
    Match.tag('Load', () =>
      pipe(
        Match.value(state),
        Match.tag('NotLoaded', 'Failed', 'Expired', () =>
          Effect.succeed({
            _tag: 'Loading' as const,
            startTime: Date.now(),
          })
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.tag('LoadSuccess', ({ data }) =>
      Effect.succeed({
        _tag: 'Loaded' as const,
        data,
        lastAccessed: Date.now(),
      })
    ),
    Match.tag('LoadFailure', ({ error }) =>
      pipe(
        Match.value(state),
        Match.tag('Failed', ({ attempts }) =>
          Effect.succeed({
            _tag: 'Failed' as const,
            error,
            attempts: attempts + 1,
          })
        ),
        Match.orElse(() =>
          Effect.succeed({
            _tag: 'Failed' as const,
            error,
            attempts: 1,
          })
        )
      )
    ),
    Match.tag('Access', () =>
      pipe(
        Match.value(state),
        Match.tag('Loaded', ({ data }) =>
          Effect.succeed({
            _tag: 'Loaded' as const,
            data,
            lastAccessed: Date.now(),
          })
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.tag('CheckExpiry', ({ maxAge }) =>
      pipe(
        Match.value(state),
        Match.tag('Loaded', ({ data, lastAccessed }) =>
          pipe(
            Match.value(Date.now() - lastAccessed > maxAge),
            Match.when(true, () =>
              Effect.succeed({
                _tag: 'Expired' as const,
                data,
              })
            ),
            Match.orElse(() => Effect.succeed(state))
          )
        ),
        Match.orElse(() => Effect.succeed(state))
      )
    ),
    Match.exhaustive
  )
```

## 6. forループの完全置換 - Effect-TSの反復パターン

### 6.1 Array.forEach による基本的な反復

```typescript
import { Array, Effect, pipe } from 'effect'

// ❌ 絶対に使わない: forループ
// for (let i = 0; i < items.length; i++) { ... }
// for (const item of items) { ... }

// ✅ Array.forEach - 副作用を伴う反復
const processItems = (items: ReadonlyArray<Item>) =>
  Array.forEach(items, (item, index) => {
    console.log(`Processing item ${index}: ${item.name}`)
    // 副作用のある処理
  })

// ✅ Effect.forEach - エフェクトフルな反復
const processItemsEffect = (items: ReadonlyArray<Item>) =>
  Effect.forEach(items, (item) =>
    Effect.gen(function* () {
      yield* Effect.log(`Processing: ${item.name}`)
      const result = yield* processItem(item)
      return result
    })
  )
```

### 6.2 Array.map/filter/reduce - 変換と集約

```typescript
// ✅ 関数型の反復パターン - forループを完全に排除
const transformData = (data: ReadonlyArray<RawData>) =>
  pipe(
    data,
    // map: 各要素の変換
    Array.map((item) => ({
      ...item,
      processed: true,
      timestamp: Date.now(),
    })),
    // filter: 条件に合う要素の抽出
    Array.filter((item) => item.valid === true),
    // reduce: 集約処理
    Array.reduce({ total: 0, items: [] as ProcessedData[] }, (acc, item) => ({
      total: acc.total + item.value,
      items: [...acc.items, item],
    }))
  )

// ✅ Array.flatMap - ネストした反復の平坦化
const expandItems = (categories: ReadonlyArray<Category>) =>
  pipe(
    categories,
    Array.flatMap((category) =>
      pipe(
        category.items,
        Array.map((item) => ({
          categoryId: category.id,
          itemId: item.id,
          combined: `${category.name}-${item.name}`,
        }))
      )
    )
  )
```

### 6.3 Effect.iterate - 条件付き反復

```typescript
// ✅ Effect.iterate - while/do-whileループの代替
const countdown = Effect.iterate(
  10, // 初期値
  {
    while: (n) => n > 0, // 継続条件
    body: (n) =>
      Effect.gen(function* () {
        yield* Effect.log(`Count: ${n}`)
        yield* Effect.sleep('100 millis')
        return n - 1
      }),
  }
)

// ✅ STM.iterate - トランザクショナルな反復
import { STM, TRef } from 'effect'

const atomicCounter = (ref: TRef.TRef<number>) =>
  STM.iterate(0, {
    while: (count) => count < 100,
    body: (count) =>
      STM.gen(function* () {
        yield* TRef.update(ref, (n) => n + 1)
        return count + 1
      }),
  })
```

### 6.4 Stream による無限反復とチャンク処理

```typescript
import { Stream, Chunk } from 'effect'

// ✅ Stream.iterate - 無限シーケンスの生成
const fibonacci = Stream.iterate([0, 1] as const, ([a, b]) => [b, a + b] as const).pipe(
  Stream.map(([a]) => a),
  Stream.take(100) // 最初の100要素のみ
)

// ✅ Chunk.forEach - 効率的なチャンク反復
const processChunks = (chunk: Chunk.Chunk<Data>) =>
  Chunk.forEach(chunk, (data, index) => {
    // Chunkは配列より効率的な内部表現
    console.log(`Chunk item ${index}: ${data.id}`)
  })

// ✅ Stream.fromIterable - イテラブルからストリームへ
const processLargeDataset = (data: Iterable<Record>) =>
  Stream.fromIterable(data).pipe(
    Stream.chunksOf(1000), // 1000要素ずつのチャンクに分割
    Stream.mapEffect((chunk) =>
      Effect.gen(function* () {
        yield* Effect.log(`Processing chunk of ${Chunk.size(chunk)} items`)
        return yield* processBatch(chunk)
      })
    ),
    Stream.runDrain
  )
```

### 6.5 再帰的反復パターン

```typescript
// ✅ 再帰によるツリー走査 - forループなしで実現
const traverseTree = <A, B>(tree: Tree<A>, f: (value: A) => Effect.Effect<B>): Effect.Effect<Tree<B>> =>
  pipe(
    Match.value(tree),
    Match.when({ type: 'leaf' }, ({ value }) =>
      pipe(
        f(value),
        Effect.map((b) => ({ type: 'leaf' as const, value: b }))
      )
    ),
    Match.when({ type: 'branch' }, ({ left, right }) =>
      Effect.gen(function* () {
        // 並列処理で子ノードを走査
        const [newLeft, newRight] = yield* Effect.all([traverseTree(left, f), traverseTree(right, f)])
        return { type: 'branch' as const, left: newLeft, right: newRight }
      })
    ),
    Match.exhaustive
  )

// ✅ Array.unfold - 条件に基づく配列生成
const generateSequence = Array.unfold(1, (n) => (n <= 100 ? Option.some([n * 2, n + 1] as const) : Option.none()))
```

### 6.6 並列反復パターン

```typescript
// ✅ Effect.forEach with concurrency - 並列処理
const processInParallel = (urls: ReadonlyArray<string>) =>
  Effect.forEach(
    urls,
    (url) =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* httpClient.get(url)
        return yield* response.json
      }).pipe(Effect.catchAll((e) => Effect.fail(new FetchError(String(e))))),
    { concurrency: 5 } // 最大5並列
  )

// ✅ Effect.all - すべての要素を並列処理
const parallelComputation = (inputs: ReadonlyArray<Input>) =>
  pipe(
    inputs,
    Array.map((input) => computeAsync(input)),
    Effect.all,
    Effect.map((results) => results.reduce((acc, result) => acc + result, 0))
  )
```

## 7. 実践的な高度パターン

### 7.1 カスタム述語の合成とパターン構築

```typescript
import { Match, pipe, Predicate } from 'effect'

// カスタム述語の定義
const isPositiveNumber = (n: unknown): n is number => typeof n === 'number' && n > 0

const isValidEmail = (s: unknown): s is string => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

const hasRequiredFields =
  <T extends Record<string, unknown>>(fields: Array<keyof T>) =>
  (obj: unknown): obj is T =>
    typeof obj === 'object' && obj !== null && fields.every((field) => field in obj)

// 述語を組み合わせた高度なマッチング
type UserInput = {
  email?: string
  age?: number
  name?: string
  role?: 'admin' | 'user'
}

const validateUserInput = (input: unknown): Effect.Effect<ValidatedUser> =>
  pipe(
    Match.value(input),
    // 複数の述語を組み合わせた検証
    Match.when(
      Predicate.and(
        hasRequiredFields<{ email: string; age: number }>(['email', 'age']),
        (obj) => isValidEmail(obj.email) && isPositiveNumber(obj.age)
      ),
      (validInput) =>
        Effect.succeed({
          email: validInput.email,
          age: validInput.age,
          validated: true,
        })
    ),
    Match.orElse(() => Effect.fail(new ValidationError('Invalid user input')))
  )

// SafeRefinement を使用した型安全な絞り込み
const createSafeNumberMatcher = (min: number, max: number) =>
  Match.when(
    (n: unknown): n is number => typeof n === 'number' && n >= min && n <= max,
    (n) => `Number ${n} is within range [${min}, ${max}]`
  )

const rangeValidator = pipe(
  Match.type<unknown>(),
  createSafeNumberMatcher(0, 100),
  createSafeNumberMatcher(101, 1000),
  Match.orElse(() => 'Out of range')
)
```

### 7.2 ネストしたパターンマッチングの最適化

```typescript
// 深くネストしたオブジェクトの効率的なマッチング
type NestedGameData = {
  player: {
    stats: {
      health: number
      mana: number
      level: number
    }
    inventory: {
      items: Array<{ id: string; quantity: number }>
      capacity: number
    }
  }
  world: {
    difficulty: 'easy' | 'normal' | 'hard'
    time: number
  }
}

// フラット化したマッチング構造
const analyzeGameState = (data: NestedGameData) =>
  pipe(
    Match.value(data),
    // 複数のネストしたプロパティを同時にチェック
    Match.when(
      {
        player: {
          stats: { health: (h) => h < 20, mana: (m) => m < 10 },
          inventory: { items: (items) => items.length === 0 },
        },
        world: { difficulty: 'hard' },
      },
      () => 'Critical: Low resources in hard mode!'
    ),
    Match.when(
      {
        player: {
          stats: { level: (l) => l >= 50 },
          inventory: { capacity: (c) => c >= 100 },
        },
      },
      () => 'End-game player detected'
    ),
    Match.orElse(() => 'Normal game state')
  )

// パスベースのマッチング
const getNestedValue = <T>(path: string[], obj: any): T | undefined => {
  return path.reduce((acc, key) => acc?.[key], obj)
}

const pathMatcher =
  <T>(path: string[], predicate: (value: T) => boolean) =>
  (obj: unknown) => {
    const value = getNestedValue<T>(path, obj)
    return value !== undefined && predicate(value)
  }

const advancedPathMatching = pipe(
  Match.type<NestedGameData>(),
  Match.when(
    pathMatcher<number>(['player', 'stats', 'health'], (h) => h > 80),
    () => 'Healthy player'
  ),
  Match.when(
    pathMatcher<string>(['world', 'difficulty'], (d) => d === 'easy'),
    () => 'Easy mode'
  ),
  Match.orElse(() => 'Default state')
)
```

### 7.3 動的パターンとランタイム型生成

```typescript
import { Schema, Match, pipe } from 'effect'

// 動的にパターンを構築
const createDynamicMatcher = <T extends string>(validValues: readonly T[]) => {
  const matchers = validValues.map((value) => Match.when(value as T, () => `Matched: ${value}`))

  return (input: T | unknown) => matchers.reduce((acc, matcher) => matcher(acc), Match.value(input))
}

// 実行時に決定されるパターン
const runtimePatterns = ['alpha', 'beta', 'gamma'] as const
const dynamicMatcher = createDynamicMatcher(runtimePatterns)

// Schema からの自動パターン生成
const UserSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Admin'),
    permissions: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('User'),
    email: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Guest'),
    sessionId: Schema.String,
  })
)

type User = Schema.Schema.Type<typeof UserSchema>

// Schema の構造を活用した自動マッチング
const autoGeneratedMatcher = (user: User) => {
  const handlers = {
    Admin: (admin: Extract<User, { _tag: 'Admin' }>) => `Admin with ${admin.permissions.length} permissions`,
    User: (user: Extract<User, { _tag: 'User' }>) => `User: ${user.email}`,
    Guest: (guest: Extract<User, { _tag: 'Guest' }>) => `Guest session: ${guest.sessionId}`,
  }

  return pipe(Match.value(user), Match.tags(handlers), Match.exhaustive)
}
```

### 7.4 非同期パターンマッチングとEffect統合

```typescript
import { Effect, Match, pipe, Option, Either } from 'effect'

// 非同期処理を含むマッチング
type AsyncOperation =
  | { type: 'fetch'; url: string }
  | { type: 'compute'; data: number[] }
  | { type: 'validate'; input: unknown }

const executeAsyncOperation = (op: AsyncOperation): Effect.Effect<string> =>
  pipe(
    Match.value(op),
    Match.when({ type: 'fetch' }, ({ url }) =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* httpClient.get(url)
        return yield* response.text
      }).pipe(Effect.catchAll((e) => Effect.fail(new Error(`Fetch failed: ${e}`))))
    ),
    Match.when({ type: 'compute' }, ({ data }) =>
      Effect.gen(function* () {
        yield* Effect.log('Starting computation...')
        const result = data.reduce((sum, n) => sum + n, 0)
        yield* Effect.sleep('100 millis')
        return `Computed: ${result}`
      })
    ),
    Match.when({ type: 'validate' }, ({ input }) =>
      pipe(
        Match.value(input),
        Match.when(Match.string, (s) => Effect.succeed(`Valid string: ${s}`)),
        Match.when(Match.number, (n) => Effect.succeed(`Valid number: ${n}`)),
        Match.orElse(() => Effect.fail(new Error('Invalid input')))
      )
    ),
    Match.exhaustive
  )

// Stream との統合
import { Stream } from 'effect'

type StreamEvent = { _tag: 'Data'; value: number } | { _tag: 'Error'; message: string } | { _tag: 'Complete' }

const processEventStream = Stream.mapEffect((event: StreamEvent) =>
  pipe(
    Match.value(event),
    Match.tag('Data', ({ value }) =>
      Effect.gen(function* () {
        const processed = yield* processData(value)
        return { type: 'processed' as const, data: processed }
      })
    ),
    Match.tag('Error', ({ message }) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Stream error: ${message}`)
        return { type: 'error' as const, message }
      })
    ),
    Match.tag('Complete', () =>
      Effect.gen(function* () {
        yield* Effect.log('Stream completed')
        return { type: 'complete' as const }
      })
    ),
    Match.exhaustive
  )
)
```

### 7.5 再帰的パターンマッチング

```typescript
// 再帰的なデータ構造のマッチング
type Tree<T> = { type: 'leaf'; value: T } | { type: 'branch'; left: Tree<T>; right: Tree<T> }

const traverseTree = <T, R>(tree: Tree<T>, leafHandler: (value: T) => R, branchHandler: (left: R, right: R) => R): R =>
  pipe(
    Match.value(tree),
    Match.when({ type: 'leaf' }, ({ value }) => leafHandler(value)),
    Match.when({ type: 'branch' }, ({ left, right }) =>
      branchHandler(traverseTree(left, leafHandler, branchHandler), traverseTree(right, leafHandler, branchHandler))
    ),
    Match.exhaustive
  )

// 使用例
const sumTree = (tree: Tree<number>): number =>
  traverseTree(
    tree,
    (value) => value,
    (left, right) => left + right
  )

const treeToString = (tree: Tree<string>): string =>
  traverseTree(
    tree,
    (value) => value,
    (left, right) => `(${left} ${right})`
  )

// 相互再帰的なパターン
type Expression =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: Expression; right: Expression }
  | { type: 'unary'; op: '-' | '!'; expr: Expression }

const evaluate = (expr: Expression, variables: Record<string, number>): Effect.Effect<number> =>
  pipe(
    Match.value(expr),
    Match.when({ type: 'number' }, ({ value }) => Effect.succeed(value)),
    Match.when({ type: 'variable' }, ({ name }) =>
      name in variables ? Effect.succeed(variables[name]) : Effect.fail(new Error(`Undefined variable: ${name}`))
    ),
    Match.when({ type: 'binary' }, ({ op, left, right }) =>
      Effect.gen(function* () {
        const l = yield* evaluate(left, variables)
        const r = yield* evaluate(right, variables)
        return pipe(
          Match.value(op),
          Match.when('+', () => l + r),
          Match.when('-', () => l - r),
          Match.when('*', () => l * r),
          Match.when('/', () => (r === 0 ? Effect.fail(new Error('Division by zero')) : Effect.succeed(l / r))),
          Match.exhaustive
        )
      }).pipe(Effect.flatten)
    ),
    Match.when({ type: 'unary' }, ({ op, expr }) =>
      Effect.gen(function* () {
        const value = yield* evaluate(expr, variables)
        return pipe(
          Match.value(op),
          Match.when('-', () => -value),
          Match.when('!', () => (value === 0 ? 1 : 0)),
          Match.exhaustive
        )
      })
    ),
    Match.exhaustive
  )
```

## 8. パフォーマンス最適化パターン

### 8.1 早期リターンの最適化

```typescript
// Match.whenによる早期リターン
const validateAndProcess = (data: unknown): Effect.Effect<ProcessedData> =>
  pipe(
    Match.value(data),
    // null/undefined チェック
    Match.when(
      (d) => d == null,
      () => Effect.fail(new Error('Data is null or undefined'))
    ),
    // 型チェック
    Match.when(
      (d) => typeof d !== 'object',
      () => Effect.fail(new Error('Data must be an object'))
    ),
    // 必須フィールドチェック
    Match.when(
      (d) => !('id' in (d as any)),
      () => Effect.fail(new Error('Missing required field: id'))
    ),
    // 正常処理
    Match.orElse((d) => Effect.succeed(processData(d as ValidData)))
  )
```

### 8.2 メモ化とキャッシング

```typescript
import { Cache, Duration } from 'effect'

// パターンマッチング結果のキャッシング
const memoizedPatternMatch = Cache.make({
  capacity: 1000,
  timeToLive: Duration.minutes(5),
  lookup: (input: GameEvent) =>
    pipe(
      Match.value(input),
      Match.tag('PlayerMove', memoizePlayerMove),
      Match.tag('BlockPlace', memoizeBlockPlace),
      Match.tag('EntitySpawn', memoizeEntitySpawn),
      Match.tag('ChatMessage', memorizeChatMessage),
      Match.exhaustive
    ),
})
```

## 9. 高度な型レベルパターンマッチング

### 9.1 条件型とMatchの組み合わせ

```typescript
import { Match, pipe } from 'effect'

// 条件型による型レベルマッチング
type InferMatchResult<T> = T extends { _tag: infer Tag }
  ? Tag extends 'Success'
    ? { result: 'ok'; data: Extract<T, { _tag: 'Success' }>['value'] }
    : Tag extends 'Error'
      ? { result: 'error'; error: Extract<T, { _tag: 'Error' }>['message'] }
      : never
  : never

// 型レベルで結果を推論
type Result<T, E> = { _tag: 'Success'; value: T } | { _tag: 'Error'; message: E }

const processWithTypeInference = <T, E>(result: Result<T, E>): InferMatchResult<Result<T, E>> =>
  pipe(
    Match.value(result),
    Match.tag('Success', ({ value }) => ({
      result: 'ok' as const,
      data: value,
    })),
    Match.tag('Error', ({ message }) => ({
      result: 'error' as const,
      error: message,
    })),
    Match.exhaustive
  ) as InferMatchResult<Result<T, E>>

// Template Literal Types とのマッチング
type CommandString = `cmd:${'move' | 'attack' | 'defend'}:${string}`

const parseCommand = (cmd: CommandString) =>
  pipe(
    Match.value(cmd),
    Match.when(
      (s): s is `cmd:move:${string}` => s.startsWith('cmd:move:'),
      (moveCmd) => {
        const target = moveCmd.slice(9)
        return { action: 'move' as const, target }
      }
    ),
    Match.when(
      (s): s is `cmd:attack:${string}` => s.startsWith('cmd:attack:'),
      (attackCmd) => {
        const target = attackCmd.slice(11)
        return { action: 'attack' as const, target }
      }
    ),
    Match.orElse((defendCmd) => {
      const target = defendCmd.slice(11)
      return { action: 'defend' as const, target }
    })
  )
```

### 9.2 Branded Types とパターンマッチング

```typescript
import { Brand, Match, pipe } from 'effect'

// Branded Types の定義
type UserId = string & Brand.Brand<'UserId'>
type SessionId = string & Brand.Brand<'SessionId'>
type ApiKey = string & Brand.Brand<'ApiKey'>

const UserId = Brand.nominal<UserId>()
const SessionId = Brand.nominal<SessionId>()
const ApiKey = Brand.nominal<ApiKey>()

// Branded Types を使用した安全なマッチング
type AuthToken = UserId | SessionId | ApiKey

const validateToken = (token: string): Effect.Effect<AuthToken> =>
  pipe(
    Match.value(token),
    Match.when(
      (t) => t.startsWith('user_'),
      (t) => Effect.succeed(UserId(t))
    ),
    Match.when(
      (t) => t.startsWith('session_'),
      (t) => Effect.succeed(SessionId(t))
    ),
    Match.when(
      (t) => t.startsWith('api_'),
      (t) => Effect.succeed(ApiKey(t))
    ),
    Match.orElse(() => Effect.fail(new Error('Invalid token format')))
  )

// Branded Types の判別
const processAuthToken = (token: AuthToken) => {
  // Brand を使った型安全な判別
  return pipe(
    token,
    Match.value,
    Match.when(UserId.is, () => `User authentication: ${token}`),
    Match.when(SessionId.is, () => `Session validation: ${token}`),
    Match.orElse(() => `API key verification: ${token}`)
  )
}
```

### 9.3 Opaque Types とのパターンマッチング

```typescript
import { Match, pipe, Data } from 'effect'

// Opaque Type の実装
const Password = (() => {
  const _Password = Data.tagged<{ readonly value: string }>('Password')

  return Object.assign(_Password, {
    make: (value: string) => {
      return pipe(
        value.length < 8,
        Match.boolean({
          onTrue: () => {
            throw new Error('Password must be at least 8 characters')
          },
          onFalse: () => _Password({ value }),
        })
      )
    },

    validate: (password: ReturnType<typeof _Password>) =>
      pipe(
        Match.value(password.value),
        Match.when(
          (p) => p.length < 8,
          () => ({ valid: false, reason: 'Too short' })
        ),
        Match.when(
          (p) => !/[A-Z]/.test(p),
          () => ({ valid: false, reason: 'No uppercase' })
        ),
        Match.when(
          (p) => !/[0-9]/.test(p),
          () => ({ valid: false, reason: 'No numbers' })
        ),
        Match.orElse(() => ({ valid: true }))
      ),
  })
})()

type Password = ReturnType<typeof Password.make>
```

## 10. テストパターン

### 10.1 Match のテスト

```typescript
import { describe, it, expect } from '@effect/vitest'
import { Effect, Match, pipe } from 'effect'

describe('GameEvent Handler', () => {
  it('すべてのイベントタイプを処理する', () =>
    Effect.gen(function* () {
      const events: GameEvent[] = [
        { _tag: 'PlayerMove', playerId: 'p1', position: { x: 0, y: 0, z: 0 } },
        { _tag: 'BlockPlace', playerId: 'p1', blockType: 'stone', position: { x: 1, y: 1, z: 1 } },
        { _tag: 'EntitySpawn', entityType: 'zombie', position: { x: 2, y: 2, z: 2 }, health: 20 },
        { _tag: 'ChatMessage', playerId: 'p1', message: 'Hello', timestamp: Date.now() },
      ]

      // ✅ Effect-TSのArray.forEach - forループの完全な代替
      // forループは使用禁止: 代わりにArray.forEach, Effect.forEach, Stream.forEachを使用
      const results = yield* Effect.forEach(events, (event) =>
        handleGameEvent(event).pipe(Effect.tap((result) => Effect.sync(() => expect(result).toBeDefined())))
      )
    }))

  it('網羅性チェックがコンパイル時に機能する', () => {
    // このテストはコンパイル時にチェックされる
    const _exhaustiveCheck = (event: GameEvent) =>
      pipe(
        Match.value(event),
        Match.tag('PlayerMove', () => 'move'),
        Match.tag('BlockPlace', () => 'place'),
        Match.tag('EntitySpawn', () => 'spawn'),
        Match.tag('ChatMessage', () => 'chat'),
        Match.exhaustive // すべてのケースが処理されていることを保証
      )
  })
})
```

## 11. ベストプラクティス

### 11.1 Match 使用の原則

1. **常に exhaustive を使用**: 可能な限り `Match.exhaustive` で網羅性を保証
2. **早期リターンパターン**: 異常系を先に処理して正常系を最後に
3. **ネストを避ける**: 複雑な条件は `whenAnd` や別関数に分離
4. **型の絞り込み**: `Match.when` で型ガードを活用
5. **再利用可能なマッチャー**: 頻出パターンは関数として抽出

### 11.2 アンチパターンの回避

```typescript
// ❌ 避けるべき: ネストした Match
const bad = pipe(
  Match.value(x),
  Match.when(1, () =>
    pipe(
      Match.value(y),
      Match.when(2, () => 'result'),
      Match.orElse(() => 'default')
    )
  ),
  Match.orElse(() => 'default')
)

// ✅ 推奨: フラットな構造
const good = pipe(
  Match.value({ x, y }),
  Match.when({ x: 1, y: 2 }, () => 'result'),
  Match.orElse(() => 'default')
)
```

## まとめ

Effect-TS の Match モジュールは、比較対象の if/else/switch 文を完全に置き換える強力なツールです。以下の高度な機能により、型安全で宣言的なコードを実現します：

### 主要な機能

1. **複合条件マッチング**: `whenOr` / `whenAnd` による柔軟な条件組み合わせ
2. **Discriminator パターン**: カスタムフィールドによる判別とプレフィックスマッチング
3. **完全な網羅性保証**: `discriminatorsExhaustive` によるコンパイル時チェック
4. **型述語とインスタンス判定**: `instanceOf` / `defined` / `nonEmptyString` / `not`
5. **Result 型統合**: `option` / `either` / `orElseAbsurd` による結果ハンドリング

### なぜ Match を使うべきか

- **型安全性**: TypeScript の型システムを最大限活用
- **網羅性チェック**: すべてのケースの処理をコンパイル時に保証
- **宣言的な記述**: 意図が明確で読みやすいコード
- **保守性**: パターンの追加・変更が容易
- **バグの削減**: 処理漏れや型エラーを未然に防止

すべての条件分岐において Match パターンを採用することで、コードベース全体の品質と一貫性が大幅に向上します。Effect-TS 3.17+ の最新機能を活用し、より安全で保守性の高いアプリケーションを構築しましょう。
