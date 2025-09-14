---
title: "よくあるエラーと解決方法 - 包括的エラー対処ガイド"
description: "TypeScript Minecraftプロジェクトの25のよくあるエラーパターンと実践的解決策。実際のエラーメッセージ、原因分析、解決手順。"
category: "troubleshooting"
difficulty: "beginner"
tags: ["troubleshooting", "common-errors", "error-resolution", "typescript", "effect-ts"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals"]
estimated_reading_time: "25分"
related_patterns: ["error-handling-patterns", "service-patterns"]
related_docs: ["./debugging-guide.md", "./effect-ts-troubleshooting.md", "../../03-guides/04-error-resolution.md"]
status: "complete"
---

# よくあるエラーと解決方法

> **包括的エラー対処**: TypeScript Minecraft プロジェクトで遭遇する25のよくあるエラーパターンとその実践的解決策

TypeScript Minecraftプロジェクトで頻繁に発生するエラーとその段階的解決方法を詳しく解説します。実際のエラーメッセージ、原因分析、確実な解決手順、そして予防策を重点的に提供します。

## Effect-TS関連エラー

### Error: Cannot find module 'effect'

#### 症状
```bash
error TS2307: Cannot find module 'effect' or its corresponding type declarations.
```

#### 原因
- 依存関係がインストールされていない
- Node.js/pnpmのバージョン不一致

#### 解決方法
```bash
# 依存関係の再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Effect-TS の明示的インストール
pnpm add effect@3.17.13 @effect/schema@0.75.5 --save-exact
```

#### 予防策
```json
// package.json - 正確なバージョン指定
{
  "dependencies": {
    "effect": "3.17.13",
    "@effect/schema": "0.75.5"
  }
}
```

### Error: Type 'unknown' is not assignable to parameter

#### 症状
```bash
error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Player'
```

#### 原因
- Schema デコードの型注釈不足
- Effect.runSync での型推論失敗

#### 解決方法
```typescript
// ❌ 問題のあるコード
const player = Schema.decodeUnknownSync(PlayerSchema)(unknownData)

// ✅ 修正後
const player: Player = Schema.decodeUnknownSync(PlayerSchema)(unknownData)

// ✅ またはEffect内で使用
const getPlayer = (data: unknown): Effect.Effect<Player, ParseError> =>
  Schema.decodeUnknown(PlayerSchema)(data)
```

#### 予防策
- 常に Schema.TaggedError を使用
- Effect での型指定を明示的に行う

### Error: Context not found

#### 症状
```bash
error: Context not found: WorldService
```

#### 原因
- Layer が提供されていない
- Context.Tag の不一致

#### 解決方法
```typescript
// ❌ 問題のあるコード
const program = Effect.gen(function* () {
  const worldService = yield* WorldService
  // ...
})

Effect.runSync(program) // エラー

// ✅ 修正後
const program = Effect.gen(function* () {
  const worldService = yield* WorldService
  // ...
})

const layer = Layer.succeed(WorldService, {
  loadChunk: (coord) => Effect.succeed(new Chunk(coord))
})

Effect.runSync(Effect.provide(program, layer))
```

#### 予防策
```typescript
// テスト用のデフォルトレイヤー作成
export const TestWorldServiceLive = Layer.succeed(WorldService, {
  loadChunk: () => Effect.succeed(mockChunk),
  saveChunk: () => Effect.succeed(void 0)
})
```

## TypeScriptコンパイルエラー

### Error: Type 'string' is not assignable to type 'BlockType'

#### 症状
```bash
error TS2322: Type 'string' is not assignable to type 'BlockType'
```

#### 原因
- ブランド型の不適切な使用
- 文字列リテラル型の問題

#### 解決方法
```typescript
// ❌ 問題のあるコード
const blockType: BlockType = "stone" // エラー

// ✅ 修正後 - Schema使用
const BlockTypeSchema = Schema.Literal("stone", "dirt", "grass")
type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>

const createBlock = (type: string): Effect.Effect<Block, ValidationError> =>
  pipe(
    Schema.decodeUnknown(BlockTypeSchema)(type),
    Effect.map((blockType) => new Block(blockType))
  )

// ✅ またはブランド型使用
type BlockType = string & { readonly _tag: "BlockType" }
const BlockType = (value: string): BlockType => value as BlockType

const blockType = BlockType("stone")
```

#### 予防策
- すべての型定義をSchemaベースで行う
- ブランド型は最小限に抑制

### Error: Property does not exist on type

#### 症状
```bash
error TS2339: Property 'position' does not exist on type 'unknown'
```

#### 原因
- 型ガードの不足
- Schema バリデーションの省略

#### 解決方法
```typescript
// ❌ 問題のあるコード
const updatePosition = (entity: unknown, pos: Position) => {
  entity.position = pos // エラー
}

// ✅ 修正後 - Schema使用
const EntitySchema = Schema.Struct({
  id: Schema.String,
  position: PositionSchema
})

const updatePosition = (
  entity: unknown,
  pos: Position
): Effect.Effect<Entity, ValidationError> =>
  pipe(
    Schema.decodeUnknown(EntitySchema)(entity),
    Effect.map((validEntity) => ({ ...validEntity, position: pos }))
  )
```

#### 予防策
```typescript
// 型ガード関数の作成
const isEntity = Schema.is(EntitySchema)

if (isEntity(unknownValue)) {
  // TypeScriptが型を推論
  console.log(unknownValue.position)
}
```

## モジュール解決エラー

### Error: Cannot resolve module '@domain/player'

#### 症状
```bash
error TS2307: Cannot resolve module '@domain/player'
```

#### 原因
- tsconfig.json の paths 設定不備
- ファイルパスの不一致

#### 解決方法
```typescript
// tsconfig.json の確認
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"]
    }
  }
}

// vite.config.ts にも追加
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()]
})
```

#### 予防策
- 相対パスではなくエイリアスを使用
- IDE の import 補完を活用

### Error: Circular dependency detected

#### 症状
```bash
error: Circular dependency detected: src/domain/player.ts -> src/domain/world.ts -> src/domain/player.ts
```

#### 原因
- 相互参照の発生
- アーキテクチャ設計の問題

#### 解決方法
```typescript
// ❌ 循環依存のあるコード
// player.ts
import { World } from './world.ts'

// world.ts
import { Player } from './player.ts'

// ✅ 修正後 - 共通型ファイル分離
// types.ts
export interface PlayerId extends Schema.Brand<string, "PlayerId"> {}
export interface WorldId extends Schema.Brand<string, "WorldId"> {}

// player.ts
import { PlayerId, WorldId } from './types.ts'

// world.ts
import { PlayerId, WorldId } from './types.ts'
```

#### 予防策
```bash
# 循環依存の検出
npx madge --circular src/

# 依存関係の可視化
npx madge --image deps.svg src/
```

## 依存関係競合エラー

### Error: peer dep missing

#### 症状
```bash
npm ERR! peer dep missing: effect@^3.17.0, required by @effect/schema@^0.75.5
```

#### 原因
- peer dependency の不一致
- バージョン競合

#### 解決方法
```bash
# peer dependency の確認
npm ls effect

# 明示的インストール
pnpm add effect@3.17.13 --save-exact

# package.json での固定
{
  "resolutions": {
    "effect": "3.17.13"
  }
}
```

#### 予防策
```bash
# インストール前の互換性チェック
pnpm outdated
pnpm audit
```

### Error: Module not found after update

#### 症状
```bash
error: Module not found: Can't resolve '@effect/platform'
```

#### 原因
- 大幅なアップデートでの API 変更
- 新しい package 構造

#### 解決方法
```typescript
// ❌ 旧バージョンのインポート
import { HttpClient } from '@effect/platform/Http'

// ✅ 新バージョンのインポート
import { HttpClient } from '@effect/platform'

// または
import * as Http from '@effect/platform/HttpClient'
```

#### 予防策
- CHANGELOG の確認
- マイナーバージョンごとの段階的アップデート

## 実行時エラー

### Error: Cannot read properties of undefined

#### 症状
```javascript
TypeError: Cannot read properties of undefined (reading 'position')
```

#### 原因
- 初期化前のオブジェクト使用
- 非同期処理の競合状態

#### 解決方法
```typescript
// ❌ 問題のあるコード
const movePlayer = (player: Player, direction: Vector3) => {
  player.position.x += direction.x // player.position が undefined の可能性
}

// ✅ 修正後 - Option使用
const movePlayer = (
  player: Option.Option<Player>,
  direction: Vector3
): Effect.Effect<Player, PlayerError> =>
  pipe(
    player,
    Option.match({
      onNone: () => Effect.fail(new PlayerNotFoundError()),
      onSome: (p) => Effect.succeed({
        ...p,
        position: {
          x: p.position.x + direction.x,
          y: p.position.y + direction.y,
          z: p.position.z + direction.z
        }
      })
    })
  )
```

#### 予防策
```typescript
// デフォルト値の提供
const getPlayerPosition = (player: unknown): Position =>
  pipe(
    Schema.decodeUnknownOption(PlayerSchema)(player),
    Option.map(p => p.position),
    Option.getOrElse(() => ({ x: 0, y: 0, z: 0 }))
  )
```

## WebGL/Three.js エラー

### Error: WebGL context lost

#### 症状
```javascript
WebGLRenderingContext: GL_CONTEXT_LOST_WEBGL
```

#### 原因
- GPU メモリ不足
- ブラウザタブの非アクティブ化

#### 解決方法
```typescript
// WebGLコンテキストの復旧処理
const handleContextLost = (renderer: THREE.WebGLRenderer) => {
  const canvas = renderer.domElement

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    console.warn('WebGL context lost')
  })

  canvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored')
    // テクスチャとシェーダーの再初期化
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}
```

#### 予防策
- メモリ使用量の監視
- 不要なテクスチャの適切な破棄

### Error: Texture size exceeds maximum

#### 症状
```javascript
THREE.WebGLRenderer: Texture marked for update but image is incomplete
```

#### 原因
- テクスチャサイズの制限超過
- 非同期画像読み込みの未完了

#### 解決方法
```typescript
// テクスチャサイズの確認と調整
const createTexture = (image: HTMLImageElement): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.gen(function* () {
    const maxSize = renderer.capabilities.maxTextureSize

    if (image.width > maxSize || image.height > maxSize) {
      // リサイズ処理
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const scale = Math.min(maxSize / image.width, maxSize / image.height)
      canvas.width = image.width * scale
      canvas.height = image.height * scale

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

      const texture = new THREE.CanvasTexture(canvas)
      return texture
    }

    return new THREE.Texture(image)
  })
```

#### 予防策
- 事前のテクスチャサイズ検証
- Progressive JPEG の使用

## 予防のためのベストプラクティス

### 1. 型安全性の確保
```typescript
// すべての外部データはSchemaでバリデーション
const validatePlayerInput = (input: unknown): Effect.Effect<Player, ValidationError> =>
  Schema.decodeUnknown(PlayerSchema)(input)

// Effect型での明示的なエラーハンドリング
const safeOperation = (player: Player): Effect.Effect<Player, PlayerError> =>
  pipe(
    validatePlayer(player),
    Effect.flatMap(updatePosition),
    Effect.mapError(() => new PlayerUpdateError({ playerId: player.id }))
  )
```

### 2. 適切なエラーハンドリング
```typescript
// Schema.TaggedErrorの使用
class PlayerNotFoundError extends Schema.TaggedError<PlayerNotFoundError>()("PlayerNotFoundError", {
  playerId: Schema.String
}) {}

// リトライ戦略
const retryableOperation = pipe(
  riskyOperation,
  Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(3))))
)
```

### 3. テスト駆動開発
```typescript
// プロパティベーステスト
import * as fc from 'fast-check'
import { it } from '@effect/vitest'

it.prop([fc.integer(), fc.integer(), fc.integer()])("position should be valid", (x, y, z) => {
  const position = Position.create(x, y, z)
  expect(position.x).toBe(x)
  expect(position.y).toBe(y)
  expect(position.z).toBe(z)
})
```

### 4. パフォーマンス監視
```typescript
// Effect.withSpan によるトレーシング
const tracedOperation = pipe(
  expensiveOperation,
  Effect.withSpan("expensive-operation", { attributes: { entityCount: 100 } })
)

// メモリ使用量の監視
const monitorMemory = Effect.gen(function* () {
  const memBefore = performance.memory?.usedJSHeapSize || 0
  yield* operation
  const memAfter = performance.memory?.usedJSHeapSize || 0
  console.log(`Memory usage: ${(memAfter - memBefore) / 1024 / 1024}MB`)
})
```

### 5. プロアクティブエラー検出システム

```typescript
// 早期警告システム
const createProactiveMonitoring = Effect.gen(function* () {
  const healthCheckInterval = yield* Ref.make(30000) // 30秒

  const monitorSystemHealth = Effect.schedule(
    Effect.gen(function* () {
      // メモリ使用量チェック
      const memoryUsage = performance.memory?.usedJSHeapSize || 0
      const memoryLimit = performance.memory?.jsHeapSizeLimit || Infinity

      if (memoryUsage / memoryLimit > 0.8) {
        yield* Effect.logWarn("High memory usage detected", {
          usage: Math.round(memoryUsage / 1024 / 1024),
          limit: Math.round(memoryLimit / 1024 / 1024),
          percentage: Math.round((memoryUsage / memoryLimit) * 100)
        })
      }

      // WebGLコンテキスト健康状態
      const webglContext = document.querySelector('canvas')?.getContext('webgl2')
      if (webglContext?.isContextLost()) {
        yield* Effect.logError("WebGL context is lost")
      }

      // Effect Fiber の状態監視
      const activeEffects = /* Fiber監視ロジック */
      if (activeEffects > 100) {
        yield* Effect.logWarn("High number of active Effects", { count: activeEffects })
      }
    }),
    Schedule.fixed("30 seconds")
  )

  return { monitorSystemHealth }
})
```

## Three.js/WebGL関連エラー

### Error: "THREE is not defined"

#### 症状
```bash
ReferenceError: THREE is not defined
    at Object.<anonymous> (src/presentation/rendering/chunk-renderer.ts:12:5)
    at Module._compile (node:internal/modules/cjs/loader.js:1105:14)
```

#### 原因
- Three.js の不適切なインポート
- ES Module と CommonJS の混在
- Vite 設定での依存関係解決の問題

#### 段階的解決手順

1. **Three.js インポート方法の確認**
   ```typescript
   // ❌ 問題のあるインポート
   import THREE from 'three'

   // ❌ グローバルアクセスの試行
   const scene = new THREE.Scene()

   // ✅ 正しいインポート方法
   import * as THREE from 'three'
   // または名前付きインポート
   import { Scene, WebGLRenderer, PerspectiveCamera } from 'three'

   const scene = new Scene()
   const renderer = new WebGLRenderer()
   const camera = new PerspectiveCamera()
   ```

2. **Vite 設定の調整**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     optimizeDeps: {
       include: ['three'],
       exclude: []
     },
     build: {
       commonjsOptions: {
         include: [/three/, /node_modules/]
       }
     }
   })
   ```

3. **型定義の追加**
   ```bash
   pnpm add -D @types/three
   ```

#### 予防策
- Three.js は常に名前付きインポートを使用
- TypeScript 設定で`"moduleResolution": "bundler"`を設定
- Vite の依存関係最適化設定を適切に行う

### Error: "WebGL context lost"

#### 実際のエラーメッセージ
```bash
WebGLContextLostEvent {
  isTrusted: true,
  statusMessage: "",
  type: "webglcontextlost"
}
Error: WebGL context was lost. Cannot render scene.
```

#### 段階的解決手順

1. **WebGL コンテキスト復旧システムの実装**
   ```typescript
   // WebGL コンテキスト管理サービス
   export interface WebGLContextService {
     readonly setupContextRecovery: (
       renderer: THREE.WebGLRenderer
     ) => Effect.Effect<void, WebGLError>
     readonly isContextLost: () => Effect.Effect<boolean, never>
     readonly restoreContext: () => Effect.Effect<THREE.WebGLRenderer, WebGLError>
   }

   export const WebGLContextService = Context.GenericTag<WebGLContextService>(
     "@minecraft/WebGLContextService"
   )

   const WebGLContextServiceLive = Layer.effect(
     WebGLContextService,
     Effect.gen(function* () {
       const contextLostRef = yield* Ref.make(false)
       const rendererRef = yield* Ref.make<Option.Option<THREE.WebGLRenderer>>(Option.none())

       return WebGLContextService.of({
         setupContextRecovery: (renderer) =>
           Effect.gen(function* () {
             yield* Ref.set(rendererRef, Option.some(renderer))
             const canvas = renderer.domElement

             // コンテキストロストハンドラー
             const handleContextLost = (event: Event) => {
               event.preventDefault()
               Effect.runPromise(
                 Effect.gen(function* () {
                   yield* Ref.set(contextLostRef, true)
                   yield* Effect.logWarn("WebGL context lost - starting recovery")
                 })
               )
             }

             // コンテキスト復旧ハンドラー
             const handleContextRestore = () => {
               Effect.runPromise(
                 Effect.gen(function* () {
                   yield* Ref.set(contextLostRef, false)
                   yield* Effect.logInfo("WebGL context restored")

                   // リソース再初期化
                   yield* reinitializeRenderer(renderer)
                   yield* reloadAllTextures()
                   yield* rebuildAllGeometries()
                 })
               )
             }

             canvas.addEventListener('webglcontextlost', handleContextLost)
             canvas.addEventListener('webglcontextrestored', handleContextRestore)

             yield* Effect.addFinalizer(() =>
               Effect.sync(() => {
                 canvas.removeEventListener('webglcontextlost', handleContextLost)
                 canvas.removeEventListener('webglcontextrestored', handleContextRestore)
               })
             )
           }),

         isContextLost: () => Ref.get(contextLostRef),

         restoreContext: () =>
           Effect.gen(function* () {
             const maybeRenderer = yield* Ref.get(rendererRef)

             return yield* pipe(
               maybeRenderer,
               Option.match({
                 onNone: () => Effect.fail(new WebGLError({ reason: "No renderer available" })),
                 onSome: (renderer) => Effect.gen(function* () {
                   const gl = renderer.getContext()

                   if (gl.isContextLost()) {
                     yield* Effect.logInfo("Attempting to force context restore")
                     // 新しいレンダラーを作成
                     const newRenderer = new THREE.WebGLRenderer({
                       antialias: true,
                       alpha: false
                     })
                     yield* Ref.set(rendererRef, Option.some(newRenderer))
                     return newRenderer
                   }

                   return renderer
                 })
               })
             )
           })
       })
     })
   )
   ```

2. **リソース管理の改善**
   ```typescript
   // テクスチャとジオメトリの自動管理
   const createManagedRenderer = Effect.scoped(
     Effect.gen(function* () {
       const renderer = yield* Effect.acquireRelease(
         Effect.sync(() => new THREE.WebGLRenderer({ antialias: true })),
         (renderer) => Effect.sync(() => {
           renderer.dispose()
           console.log("WebGL renderer disposed")
         })
       )

       const webglService = yield* WebGLContextService
       yield* webglService.setupContextRecovery(renderer)

       // メモリ使用量の監視
       yield* Effect.fork(
         Effect.schedule(
           Effect.gen(function* () {
             const memInfo = renderer.info.memory
             if (memInfo.textures > 100) {
               yield* Effect.logWarn("High texture count detected", {
                 textures: memInfo.textures,
                 geometries: memInfo.geometries
               })
             }
           }),
           Schedule.fixed("30 seconds")
         )
       )

       return renderer
     })
   )
   ```

## Vite/Build関連エラー

### Error: "[vite] Internal server error: Failed to resolve import"

#### 実際のエラーメッセージ
```bash
[vite] Internal server error: Failed to resolve import "@domain/player" from "src/application/services/player-service.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /path/to/src/application/services/player-service.ts
```

#### 段階的解決手順

1. **パス設定の確認と修正**
   ```json
   // tsconfig.json - 正確なパス設定
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@domain/*": ["src/domain/*"],
         "@application/*": ["src/application/*"],
         "@infrastructure/*": ["src/infrastructure/*"],
         "@presentation/*": ["src/presentation/*"],
         "@shared/*": ["src/shared/*"]
       }
     }
   }
   ```

2. **Vite 設定の同期**
   ```typescript
   // vite.config.ts
   import tsconfigPaths from 'vite-tsconfig-paths'
   import path from 'path'

   export default defineConfig({
     plugins: [
       tsconfigPaths({
         root: './',
         projects: ['./tsconfig.json']
       })
     ],
     resolve: {
       alias: {
         '@domain': path.resolve(__dirname, 'src/domain'),
         '@application': path.resolve(__dirname, 'src/application'),
         '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
         '@presentation': path.resolve(__dirname, 'src/presentation'),
         '@shared': path.resolve(__dirname, 'src/shared')
       }
     }
   })
   ```

3. **ファイル構造の確認**
   ```bash
   # ファイル存在確認
   ls -la src/domain/player/

   # インデックスファイルの確認
   cat src/domain/index.ts

   # パッケージの再インストール
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

#### 予防策
- IDEのインポート補完機能を活用
- 相対パスではなくエイリアスを一貫して使用
- CI/CDでのパス解決テストを追加

### Error: "Cannot read properties of undefined (reading 'prototype')"

#### 実際のエラーメッセージ
```bash
TypeError: Cannot read properties of undefined (reading 'prototype')
    at /node_modules/effect/dist/cjs/internal/layer.js:89:23
    at Array.reduce (<anonymous>)
    at mergeAll (/node_modules/effect/dist/cjs/Layer.js:156:19)
```

#### 段階的解決手順

1. **Layer 構成の確認**
   ```typescript
   // ❌ 問題のある Layer 構成
   const MainLayer = Layer.mergeAll(
     WorldServiceLive,
     undefined, // undefined が混入
     PlayerServiceLive,
     null // null が混入
   )

   // ✅ 正しい Layer 構成
   const MainLayer = Layer.mergeAll(
     WorldServiceLive,
     PlayerServiceLive,
     ChunkServiceLive
   ).pipe(
     Layer.provide(ConfigServiceLive)
   )

   // ✅ より安全な Layer 構成
   const createMainLayer = Effect.gen(function* () {
     const layers = [
       WorldServiceLive,
       PlayerServiceLive,
       ChunkServiceLive
     ].filter(Boolean) // undefined/null を除外

     return Layer.mergeAll(...layers)
   })
   ```

2. **依存関係の循環確認**
   ```typescript
   // 循環依存の検出と回避
   export const WorldServiceLive = Layer.effect(
     WorldService,
     Effect.gen(function* () {
       // ❌ 循環依存を引き起こす可能性
       // const playerService = yield* PlayerService

       // ✅ 依存関係を最小化
       const chunkStorage = yield* ChunkStorageService
       const chunkGenerator = yield* ChunkGeneratorService

       return WorldService.of({
         loadChunk: (coord) =>
           pipe(
             chunkStorage.getChunk(coord),
             Effect.catchTag("ChunkNotFoundError", () =>
               chunkGenerator.generateChunk(coord)
             )
           ),

         saveChunk: (chunk) => chunkStorage.saveChunk(chunk)
       })
     })
   )
   ```

## TypeScript型エラー

### Error: "Type 'Effect<never, never, unknown>' is not assignable"

#### 実際のエラーメッセージ
```bash
TS2322: Type 'Effect<never, never, unknown>' is not assignable to type 'Effect<Player, PlayerError, PlayerService>'.
  Type 'never' is not assignable to type 'Player'.
```

#### 段階的解決手順

1. **Effect型の明示的な指定**
   ```typescript
   // ❌ 型推論に依存しすぎ
   const loadPlayer = (id: string) =>
     Effect.gen(function* () {
       const playerService = yield* PlayerService
       return yield* playerService.getPlayer(id)
     })

   // ✅ 明示的な型指定
   const loadPlayer = (
     id: string
   ): Effect.Effect<Player, PlayerError, PlayerService> =>
     Effect.gen(function* () {
       const playerService = yield* PlayerService
       const player = yield* playerService.getPlayer(id)

       // 型安全性を確保
       return player
     })
   ```

2. **Schema による型安全性の強化**
   ```typescript
   // より堅牢な型安全な実装
   const loadPlayerWithValidation = (
     input: unknown
   ): Effect.Effect<Player, PlayerError | ParseResult.ParseError, PlayerService> =>
     Effect.gen(function* () {
       // 入力値の検証
       const playerId = yield* pipe(
         input,
         Schema.decodeUnknown(Schema.String),
         Effect.mapError(() => new InvalidPlayerIdError({ input }))
       )

       const playerService = yield* PlayerService
       const player = yield* playerService.getPlayer(playerId)

       // レスポンスの検証
       const validatedPlayer = yield* pipe(
         player,
         Schema.decodeUnknown(PlayerSchema),
         Effect.mapError(() => new PlayerValidationError({ player }))
       )

       return validatedPlayer
     })
   ```

### Error: "Circular dependency detected"

#### 実際のエラーメッセージ
```bash
Error: Circular dependency detected:
  src/domain/world/world-service.ts ->
  src/domain/player/player-service.ts ->
  src/domain/world/world-service.ts
```

#### 段階的解決手順

1. **依存関係の可視化**
   ```bash
   # 循環依存の検出
   npx madge --circular src/

   # 依存関係グラフの生成
   npx madge --image dependency-graph.svg src/
   ```

2. **共有型の分離**
   ```typescript
   // ❌ 循環依存を引き起こす構造
   // world-service.ts
   import { PlayerService } from '../player/player-service'

   // player-service.ts
   import { WorldService } from '../world/world-service'

   // ✅ 共有型ファイルによる解決
   // shared/types.ts
   export interface PlayerId extends Schema.Brand<string, "PlayerId"> {}
   export interface WorldId extends Schema.Brand<string, "WorldId"> {}
   export interface ChunkCoordinate {
     readonly x: number
     readonly z: number
   }

   // world-service.ts
   import type { ChunkCoordinate, PlayerId } from '../shared/types'

   // player-service.ts
   import type { WorldId, ChunkCoordinate } from '../shared/types'
   ```

3. **インターフェース分離原則の適用**
   ```typescript
   // 小さなインターフェースに分割
   export interface ChunkLoader {
     readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkError>
   }

   export interface PlayerLocator {
     readonly getPlayerPosition: (id: PlayerId) => Effect.Effect<Position, PlayerError>
   }

   // 依存関係を最小化
   export const WorldServiceLive = Layer.effect(
     WorldService,
     Effect.gen(function* () {
       const chunkLoader = yield* ChunkLoader
       // PlayerService 全体ではなく、必要な部分のみを依存

       return WorldService.of({
         loadChunksAroundPlayer: (playerId) =>
           Effect.gen(function* () {
             // 直接的な依存を避けて間接的にアクセス
             const playerPosition = yield* getPlayerPositionFromEvent(playerId)
             const chunkCoords = getChunkCoordinatesInRadius(playerPosition, 5)

             return yield* Effect.forEach(chunkCoords, chunkLoader.loadChunk)
           })
       })
     })
   )
   ```

## パッケージ管理エラー

### Error: "peer dep missing"

#### 実際のエラーメッセージ
```bash
npm ERR! peer dep missing: effect@^3.17.0, required by @effect/schema@^0.75.5
npm ERR! peer dep missing: typescript@^5.0.0, required by effect@^3.17.13
```

#### 段階的解決手順

1. **依存関係の明示的管理**
   ```bash
   # 現在の依存関係確認
   pnpm ls --depth=1

   # peer dependency の解決
   pnpm add effect@3.17.13 typescript@5.3.3 --save-exact

   # Schema パッケージの対応バージョン確認
   pnpm info @effect/schema peerDependencies
   ```

2. **package.json での依存関係固定**
   ```json
   {
     "dependencies": {
       "effect": "3.17.13",
       "@effect/schema": "0.75.5",
       "three": "0.179.1"
     },
     "devDependencies": {
       "typescript": "5.3.3",
       "@types/three": "0.179.0"
     },
     "pnpm": {
       "overrides": {
         "effect": "3.17.13",
         "typescript": "5.3.3"
       }
     }
   }
   ```

3. **自動化された依存関係チェック**
   ```typescript
   // scripts/check-deps.ts
   import { Effect, pipe } from "effect"
   import { execSync } from "child_process"
   import * as fs from "fs"

   const checkDependencyVersions = Effect.gen(function* () {
     const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
     const lockfileContent = fs.readFileSync('pnpm-lock.yaml', 'utf-8')

     const requiredVersions = {
       'effect': '3.17.13',
       '@effect/schema': '0.75.5',
       'typescript': '5.3.3'
     }

     const issues: string[] = []

     for (const [pkg, expectedVersion] of Object.entries(requiredVersions)) {
       const currentVersion = packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]

       if (!currentVersion) {
         issues.push(`Missing package: ${pkg}`)
       } else if (!currentVersion.includes(expectedVersion)) {
         issues.push(`Version mismatch for ${pkg}: expected ${expectedVersion}, got ${currentVersion}`)
       }
     }

     if (issues.length > 0) {
       yield* Effect.fail(new DependencyError({ issues }))
     }

     yield* Effect.logInfo("All dependency versions are correct")
   })

   Effect.runPromise(checkDependencyVersions).catch(console.error)
   ```

## 統合エラーハンドリングシステム

### プロジェクト全体のエラー管理戦略

```typescript
// エラー分類とハンドリング
const createUnifiedErrorHandler = Effect.gen(function* () {
  const errorQueue = yield* Queue.bounded<ErrorLogEntry>(1000)
  const metrics = yield* MetricsService

  const handleError = (error: unknown, context: Record<string, unknown> = {}) =>
    Effect.gen(function* () {
      // エラーの分類
      const errorType = pipe(
        error,
        Match.value,
        Match.when(
          (e): e is TypeError => e instanceof TypeError,
          () => "type-error" as const
        ),
        Match.when(
          (e): e is ReferenceError => e instanceof ReferenceError,
          () => "reference-error" as const
        ),
        Match.when(
          (e): e is ParseResult.ParseError => Schema.is(ParseResult.ParseErrorSchema)(e),
          () => "validation-error" as const
        ),
        Match.when(
          (e): e is MinecraftError => e instanceof MinecraftError,
          () => "domain-error" as const
        ),
        Match.orElse(() => "unknown-error" as const)
      )

      // メトリクス記録
      yield* metrics.incrementCounter(`errors.${errorType}`, 1)

      // エラーログの作成
      const logEntry: ErrorLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: 'error',
        type: errorType,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context,
        service: 'ts-minecraft'
      }

      yield* Queue.offer(errorQueue, logEntry)

      // 重要度に応じた処理
      if (errorType === 'domain-error') {
        yield* Effect.logError("Critical domain error", logEntry)
        yield* sendErrorToMonitoring(logEntry)
      } else {
        yield* Effect.logWarn("Application error", logEntry)
      }
    })

  return { handleError, errorQueue }
})
```

## 関連リソース

### プロジェクト内関連ページ
- [Effect-TSトラブルシューティング](./effect-ts-troubleshooting.md) - Effect-TS特有の問題解決
- [デバッグガイド](./debugging-guide.md) - より詳細なデバッグ手法
- [パフォーマンス問題](./performance-issues.md) - パフォーマンス最適化
- [ビルド問題](./build-problems.md) - ビルド設定のトラブルシューティング
- [ランタイムエラー](./runtime-errors.md) - 実行時エラーの対処法

### 外部リソース
- [Effect-TS 公式ドキュメント](https://effect.website/) - 最新のAPI仕様
- [Three.js エラー解決](https://threejs.org/docs/#manual/introduction/FAQ) - Three.js特有の問題
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript詳細ガイド
- [Vite トラブルシューティング](https://vitejs.dev/guide/troubleshooting.html) - Vite設定問題

### 緊急時対応チェックリスト

#### システム全体が起動しない場合
- [ ] `pnpm install` で依存関係を再インストール
- [ ] `rm -rf node_modules pnpm-lock.yaml && pnpm install` でクリーンインストール
- [ ] TypeScript設定の確認（`npx tsc --showConfig`）
- [ ] Vite設定の確認（`npx vite --debug`）
- [ ] Effect-TS バージョンの確認（`pnpm list effect`）

#### レンダリングが停止した場合
- [ ] WebGLコンテキストの状態確認
- [ ] ブラウザのメモリ使用量確認
- [ ] コンソールエラーの確認
- [ ] Three.jsリソースの破棄状況確認