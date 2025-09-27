# サンプル実行計画書Issue

> **このファイルは、AI実行計画書テンプレートの使用例です。ROADMAPタスク「P1-012: 基本ブロックシステム」を例にした具体的なIssue作成例を示しています。**

---

## 🤖 AI実行計画書

**Issue番号**: #123
**タイトル**: [EXECUTION] P1-012: 基本ブロックシステム実装

### 📋 入力情報

- **📍 ROADMAP タスクID**: P1-012
- **📏 実装サイズ**: M (4-5時間)
- **🏗️ アーキテクチャ層**: Domain (ビジネスロジック)
- **🚨 優先度**: High (Phase目標達成に必須)
- **⏱️ 見積もり時間**: 4.5

---

## 🎯 機能概要

Minecraftのゲームワールドにおける基本ブロックシステムを実装します。

### 技術的要件

- Effect-TS Service/Layerパターン使用
- Schema.Struct による型安全性確保
- DDD/ECS統合アーキテクチャ
- ブロック配置・削除・取得の基本操作
- テクスチャ管理との連携

### 対象ブロック種類

- Air (空気)
- Stone (石)
- Dirt (土)
- Grass (草ブロック)
- Wood (木材)

---

## 🔍 Pre-Step: 実装前必須確認

### ✅ 完了済み確認項目

#### 📚 ドキュメント確認

- [x] `@docs/INDEX.md` - プロジェクト全体方針確認
- [x] `@docs/tutorials/effect-ts-fundamentals/` - Effect-TSパターン確認
- [x] `@docs/explanations/design-patterns/` - 設計パターン確認
- [x] `@docs/how-to/development/development-conventions.md` - 開発規約確認

#### 🧠 メモリ確認

- [x] `list_memories` 実行 - 過去の実装パターン確認
- [x] `read_memory effect-ts-scene-patterns` - シーン管理パターン確認
- [x] `read_memory service-patterns-catalog` - Service実装パターン確認

#### 📦 ライブラリ仕様確認

- [x] Context7 MCP - Effect-TS 3.17+ 最新仕様確認
- [x] Context7 MCP - @effect/schema 最新API確認
- [x] Context7 MCP - Three.js BoxGeometry/MeshBasicMaterial API確認

#### 🔗 依存関係確認

- [x] ConfigService実装完了確認 (#P0-009)
- [x] Three.js統合完了確認 (#P0-003)
- [x] 基本ECS基盤確認 (#P1-008)

---

## 🔍 Step 1: 事前調査・分析

### ✅ 実装対象の詳細分析

- [x] ブロック識別システム（BlockType enum）
- [x] ブロック配置座標系（World座標 → Chunk座標変換）
- [x] ブロック状態管理（placed/air状態）
- [x] テクスチャマッピング（BlockType → TextureId）

### ✅ アーキテクチャ設計

```typescript
// Service設計
const BlockService = Context.GenericTag<BlockService>('@minecraft/domain/BlockService')

// Schema設計
const BlockSchema = Schema.Struct({
  _tag: Schema.Literal('Block'),
  type: BlockTypeSchema,
  position: Vector3Schema,
  metadata: BlockMetadataSchema,
})

// Layer構成
const BlockServiceLayer = Layer.effect(BlockService, ...)
```

### ✅ 実装ファイル一覧

```typescript
// 作成予定ファイル
;-src / domain / blocks / BlockService.ts -
  src / domain / blocks / schemas / BlockSchema.ts -
  src / domain / blocks / types / BlockTypes.ts -
  src / domain / blocks / BlockService.test.ts -
  src / domain / blocks / systems / BlockRenderSystem.ts -
  src / infrastructure / blocks / BlockLayer.ts
```

### ✅ ECS統合設計

- BlockComponent: ブロック種類・位置情報
- BlockRenderSystem: ブロック描画・メッシュ生成
- BlockInteractionSystem: プレイヤー相互作用（今後Phase）

---

## 📁 Step 2: ディレクトリ構造作成

### ✅ 実行済みコマンド

```bash
mkdir -p src/domain/blocks/{services,schemas,types,systems}
mkdir -p src/infrastructure/blocks
mkdir -p src/domain/blocks/__tests__
```

### ✅ ファイル骨格作成

- [x] `src/domain/blocks/index.ts` - エクスポート統合
- [x] `src/domain/blocks/types/index.ts` - 型定義
- [x] 上位ディレクトリの `index.ts` 更新
- [x] TypeScriptコンパイルエラー確認

---

## 📝 Step 3: 型定義・データ構造

### ✅ Branded型定義

```typescript
// 実装済み
type BlockId = string & { readonly _brand: 'BlockId' }
type BlockTypeId = string & { readonly _brand: 'BlockTypeId' }
type ChunkPosition = { x: number; y: number; z: number } & { readonly _brand: 'ChunkPosition' }

const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))
const BlockTypeIdSchema = Schema.String.pipe(Schema.brand('BlockTypeId'))
```

### ✅ Core Schema定義

```typescript
// BlockType enum
const BlockTypeSchema = Schema.Literal('air', 'stone', 'dirt', 'grass', 'wood')
type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>

// メインブロックエンティティ
const BlockSchema = Schema.Struct({
  _tag: Schema.Literal('Block'),
  id: BlockIdSchema,
  type: BlockTypeSchema,
  position: Vector3Schema,
  metadata: BlockMetadataSchema,
  timestamp: Schema.Number, // 配置時刻
}).annotations({
  identifier: 'Block',
  description: 'ゲームワールドの基本ブロック定義',
})

type Block = Schema.Schema.Type<typeof BlockSchema>
```

### ✅ 設定Schema

```typescript
const BlockConfigSchema = Schema.Struct({
  textureAtlasPath: Schema.String,
  blockSize: Schema.Number, // 1.0 = 1x1x1ブロック
  renderDistance: Schema.Number,
  maxBlocksPerChunk: Schema.Number,
})
```

---

## ⚙️ Step 4: Service実装

### ✅ Context.GenericTag定義

```typescript
// 実装済み Service定義
export const BlockService = Context.GenericTag<BlockService>('@minecraft/domain/BlockService')

export interface BlockService {
  readonly placeBlock: (type: BlockType, position: Vector3) => Effect.Effect<Block, BlockError>
  readonly removeBlock: (position: Vector3) => Effect.Effect<void, BlockError>
  readonly getBlock: (position: Vector3) => Effect.Effect<Option.Option<Block>, BlockError>
  readonly getBlocksInRange: (min: Vector3, max: Vector3) => Effect.Effect<ReadonlyArray<Block>, BlockError>
  readonly isValidPosition: (position: Vector3) => Effect.Effect<boolean, never>
}
```

### ✅ Service実装

```typescript
class BlockServiceImpl implements BlockService {
  readonly placeBlock = (type: BlockType, position: Vector3) =>
    Effect.gen(function* () {
      // 1. 位置バリデーション
      const isValid = yield* this.isValidPosition(position)
      if (!isValid) {
        return yield* Effect.fail(new InvalidPositionError({ position }))
      }

      // 2. 既存ブロック確認
      const existing = yield* this.getBlock(position)
      if (Option.isSome(existing) && existing.value.type !== 'air') {
        return yield* Effect.fail(new BlockAlreadyExistsError({ position }))
      }

      // 3. ブロック作成
      const blockId = yield* generateBlockId()
      const block = {
        _tag: 'Block' as const,
        id: blockId,
        type,
        position,
        metadata: { hardness: getBlockHardness(type) },
        timestamp: Date.now(),
      }

      // 4. ワールドに追加
      yield* worldStorage.setBlock(position, block)
      yield* Effect.log(`Block placed: ${type} at ${formatVector3(position)}`)

      return block
    })

  // 他のメソッド実装...
}
```

### ✅ Layer実装

```typescript
export const BlockServiceLayer = Layer.effect(
  BlockService,
  Effect.gen(function* () {
    const logger = yield* LoggerService
    const config = yield* ConfigService
    const worldStorage = yield* WorldStorageService

    yield* logger.info('BlockService initializing...')

    return new BlockServiceImpl()
  })
)

export const BlockServiceLive = BlockServiceLayer.pipe(
  Layer.provide(LoggerServiceLayer),
  Layer.provide(ConfigServiceLayer),
  Layer.provide(WorldStorageServiceLayer)
)
```

### ✅ エラーハンドリング

```typescript
export class BlockError extends Data.TaggedError('BlockError')<{
  readonly cause: unknown
  readonly message: string
}> {}

export class InvalidPositionError extends Data.TaggedError('InvalidPositionError')<{
  readonly position: Vector3
}> {}

export class BlockAlreadyExistsError extends Data.TaggedError('BlockAlreadyExistsError')<{
  readonly position: Vector3
}> {}
```

---

## 🎮 Step 5: ECSシステム統合

### ✅ Component定義

```typescript
// ECS Block Component
const BlockComponent = Schema.Struct({
  _tag: Schema.Literal('BlockComponent'),
  blockId: BlockIdSchema,
  blockType: BlockTypeSchema,
  mesh: Schema.Optional(ThreeMeshSchema), // Three.js Mesh参照
  needsRender: Schema.Boolean,
}).annotations({
  identifier: 'BlockComponent',
})

type BlockComponent = Schema.Schema.Type<typeof BlockComponent>
```

### ✅ Render System実装

```typescript
export const BlockRenderSystem = System.create('BlockRenderSystem', {
  components: [BlockComponent, TransformComponent] as const,

  update: (entities, deltaTime) =>
    Effect.gen(function* () {
      const renderer = yield* RendererService
      const textureManager = yield* TextureManagerService

      for (const entity of entities) {
        const blockComp = entity.get(BlockComponent)
        const transform = entity.get(TransformComponent)

        // レンダリングが必要な場合のみ処理
        if (blockComp.needsRender) {
          // メッシュ生成
          const texture = yield* textureManager.getBlockTexture(blockComp.blockType)
          const geometry = new THREE.BoxGeometry(1, 1, 1)
          const material = new THREE.MeshBasicMaterial({ map: texture })
          const mesh = new THREE.Mesh(geometry, material)

          // 位置設定
          mesh.position.copy(transform.position)

          // シーンに追加
          yield* renderer.addToScene(mesh)

          // コンポーネント更新
          yield* entity.updateComponent(BlockComponent, {
            ...blockComp,
            mesh: Option.some(mesh),
            needsRender: false,
          })
        }
      }
    }),
})
```

### ✅ Entity操作ヘルパー

```typescript
export const createBlockEntity = (block: Block) =>
  Effect.gen(function* () {
    const entityManager = yield* EntityManager

    const entity = yield* entityManager.createEntity()

    yield* entity.addComponent(BlockComponent, {
      _tag: 'BlockComponent',
      blockId: block.id,
      blockType: block.type,
      mesh: Option.none(),
      needsRender: true,
    })

    yield* entity.addComponent(TransformComponent, {
      position: block.position,
      rotation: Vector3.zero,
      scale: Vector3.one,
    })

    return entity
  })
```

---

## 🧪 Step 6: テスト実装

### ✅ テスト設定

```typescript
// BlockService.test.ts
import { Effect, TestContext, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import * as fc from '@effect/vitest'

const testLayer = Layer.mergeAll(BlockServiceLayer, TestLoggerLayer, TestConfigLayer, TestWorldStorageLayer)
```

### ✅ 単体テスト

```typescript
describe('BlockService', () => {
  it('should place block at valid position', async () => {
    const program = Effect.gen(function* () {
      const service = yield* BlockService
      const position = { x: 0, y: 0, z: 0 }

      const block = yield* service.placeBlock('stone', position)

      expect(block.type).toBe('stone')
      expect(block.position).toEqual(position)
      expect(block.id).toBeDefined()
    })

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
  })

  it('should fail when placing block at occupied position', async () => {
    const program = Effect.gen(function* () {
      const service = yield* BlockService
      const position = { x: 0, y: 0, z: 0 }

      yield* service.placeBlock('stone', position)

      const result = yield* service.placeBlock('dirt', position).pipe(
        Effect.flip,
        Effect.match({
          onFailure: (error) => error,
          onSuccess: () => new Error('Should have failed'),
        })
      )

      expect(result).toBeInstanceOf(BlockAlreadyExistsError)
    })

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
  })

  it('should remove block successfully', async () => {
    const program = Effect.gen(function* () {
      const service = yield* BlockService
      const position = { x: 1, y: 1, z: 1 }

      yield* service.placeBlock('wood', position)
      yield* service.removeBlock(position)

      const result = yield* service.getBlock(position)
      expect(Option.isNone(result)).toBe(true)
    })

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
  })
})
```

### ✅ Property-based Testing

```typescript
describe('BlockService Property Tests', () => {
  it('place then get should return same block', async () => {
    await it.prop(
      fc.asyncProperty(
        fc.record({
          x: fc.integer({ min: -100, max: 100 }),
          y: fc.integer({ min: 0, max: 255 }),
          z: fc.integer({ min: -100, max: 100 }),
        }),
        fc.constantFrom('stone', 'dirt', 'grass', 'wood'),
        async (position, blockType) => {
          const program = Effect.gen(function* () {
            const service = yield* BlockService

            const placed = yield* service.placeBlock(blockType, position)
            const retrieved = yield* service.getBlock(position)

            expect(Option.isSome(retrieved)).toBe(true)
            if (Option.isSome(retrieved)) {
              expect(retrieved.value.type).toBe(blockType)
              expect(retrieved.value.position).toEqual(position)
            }
          })

          await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
        }
      )
    )
  })
})
```

### ✅ カバレッジ確認結果

- ステートメントカバレッジ: 87%
- ブランチカバレッジ: 82%
- 関数カバレッジ: 100%
- エラーケース完全テスト済み

---

## 🔗 Step 7: 統合・エクスポート

### ✅ モジュールエクスポート

```typescript
// src/domain/blocks/index.ts
export * from './services/BlockService'
export * from './schemas/BlockSchema'
export * from './types/BlockTypes'
export * from './systems/BlockRenderSystem'

// 型のみエクスポート
export type { Block, BlockType, BlockConfig, BlockId } from './types'

// Layer統合エクスポート
export { BlockServiceLive as BlockLayer } from './services/BlockService'
export { BlockRenderSystem } from './systems/BlockRenderSystem'
```

### ✅ 上位モジュール統合

```typescript
// src/domain/index.ts に追加
export * from './blocks'

// src/index.ts に追加
export * from './domain/blocks'
```

### ✅ アプリケーション統合

```typescript
// src/application/WorldManagement.ts での使用例
export const placeBlockUseCase = (type: BlockType, position: Vector3) =>
  Effect.gen(function* () {
    const blockService = yield* BlockService
    const block = yield* blockService.placeBlock(type, position)

    // ECSエンティティ作成
    const entity = yield* createBlockEntity(block)

    yield* Effect.log(`Block placed successfully: ${block.id}`)
    return { block, entity }
  })
```

---

## ✅ Step 8: 品質確認・最適化

### ✅ コード品質チェック結果

```bash
# 型チェック
✅ pnpm typecheck
# → TypeScriptエラー0件

# Lint・フォーマット
✅ pnpm check
# → oxlint, Prettierエラー0件

# テスト実行
✅ pnpm test
# → 全テスト PASS、カバレッジ 87%

# ビルド確認
✅ pnpm build
# → ビルド成功
```

### ✅ パフォーマンス確認

- [x] メモリリーク検査: 問題なし
- [x] 1000ブロック配置時の動作: 60FPS維持
- [x] Bundle size影響: +15KB（許容範囲内）

### ✅ ドキュメント更新

```markdown
# 更新完了ドキュメント

✅ docs/reference/api/BlockAPI.md - API仕様書
✅ docs/explanations/design-patterns/BlockPattern.md - 実装パターン
✅ docs/how-to/blocks/placing-blocks.md - 使用方法
✅ CHANGELOG.md - v0.1.0 機能追加記録
```

---

## 🎉 Post-Step: 完了後処理

### ✅ Issue完了確認

- [x] 全Acceptance Criteria達成確認
- [x] 全Step実行完了確認
- [x] CI/CD完全PASS確認

### ✅ 依存関係更新

- [x] #P1-013 (チャンクシステム) を "ready" 状態に更新
- [x] #P1-014 (ワールド生成) を "ready" 状態に更新
- [x] 関連IssueへのBlockService実装完了リンク

### ✅ ナレッジ保存

```typescript
// write_memory 実行済み
memory_name: "block-system-implementation-patterns"
content: |
  # ブロックシステム実装パターン

  ## Service/Layer構成
  - Context.GenericTag: @minecraft/domain/BlockService
  - Schema.Struct: BlockSchema, BlockConfigSchema, BlockComponent
  - Layer.effect: 依存注入（Logger, Config, WorldStorage）

  ## ECS統合
  - Component: BlockComponent (blockId, blockType, mesh, needsRender)
  - System: BlockRenderSystem (Three.js メッシュ生成・更新)

  ## テストパターン
  - Property-based testing: position/blockType組み合わせ
  - カバレッジ: 87%達成

  ## パフォーマンス
  - 1000ブロック: 60FPS維持
  - メモリ: 追加15MB (許容範囲)

  ## 学習事項
  - Vector3位置の正規化が重要（整数座標強制）
  - Option型活用でブロック存在判定の安全性確保
  - Three.js Mesh生成のバッチ処理でパフォーマンス向上
```

### ✅ PR作成・CI確認

- [x] PR #123 作成: "feat: implement basic block system (P1-012)"
- [x] GitHub Actions CI完全成功
- [x] 全品質ゲートPASS
- [x] レビュー準備完了

---

## ✅ Acceptance Criteria（達成確認）

### ✅ 機能要件

- [x] ブロック配置機能（5種類対応: air, stone, dirt, grass, wood）
- [x] ブロック削除機能
- [x] ブロック取得機能（位置指定）
- [x] 範囲内ブロック一覧取得機能
- [x] 位置バリデーション機能

### ✅ 技術要件

- [x] TypeScript型エラー0件
- [x] テストカバレッジ ≥80% (実績: 87%)
- [x] CI/CDパイプライン成功
- [x] BlockService API完全ドキュメント化

### ✅ 品質要件

- [x] パフォーマンス目標達成（60FPS維持）
- [x] メモリ使用量 ≤2GB（実績: +15MB）
- [x] コードレビュー準備完了

---

## 🔗 依存関係（最終状態）

### ✅ 事前完了済み（Completed Dependencies）

- [x] #P0-009 - ConfigService実装
- [x] #P0-003 - Three.js統合
- [x] #P1-008 - ECS基盤実装

### 🟢 このIssue完了により Ready となる Issues

- [x] #P1-013 - チャンクシステム実装
- [x] #P1-014 - ワールド生成システム
- [x] #P1-015 - プレイヤーブロック相互作用

### 🔵 関連完了Issue

- [x] #P1-010 - RendererService（連携確認済み）
- [x] #P1-011 - TextureManagerService（連携確認済み）

---

## 🛠️ 最終実装統計

- **実装時間**: 4.2時間（見積もり4.5時間内）
- **作成ファイル数**: 12ファイル
- **総行数**: 847行（実装 + テスト）
- **テストケース数**: 28個
- **カバレッジ**: 87%
- **型エラー**: 0件
- **Lintエラー**: 0件

---

## 🎯 成果・学習事項

### ✅ 成果

1. **完全な型安全性**: Schema.Struct + Branded型による堅牢な実装
2. **高いテスタビリティ**: Property-based testing含む包括的テスト
3. **優れたパフォーマンス**: 1000ブロック @ 60FPS達成
4. **保守性**: Effect-TS Pattern + DDD構造による明確な責務分離

### ✅ 今後の改善点

1. **バッチ処理最適化**: 複数ブロック同時操作のさらなる高速化
2. **キャッシュ戦略**: 頻繁アクセス位置のメモリキャッシュ導入
3. **LOD対応**: 距離別の詳細度調整システム

**Issue #123: P1-012 基本ブロックシステム実装 - ✅ 完了**
