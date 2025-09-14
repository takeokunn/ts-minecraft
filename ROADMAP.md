# TypeScript Minecraft Clone - 実装ロードマップ v4.0

## 🎯 プロジェクト概要

TypeScript + Effect-TS 3.17+ + Three.jsによるMinecraft Clone開発。
完全関数型・DDD×ECS統合アーキテクチャで、AI Agent駆動開発を前提とした詳細実装計画。

### 開発原則
- **1タスク1PR**: 各タスクは独立してレビュー可能な単位 (2-4時間規模)
- **ドキュメント駆動**: docs/を常に最新状態に維持
- **AI Agent最適化**: Claude/Cursorで実行可能な詳細仕様
- **段階的リリース**: 各Sprintで動作可能な成果物
- **自動化ファースト**: Issue作成・PR検証・デプロイの完全自動化

## 📊 実装フェーズ概要

| Phase | Sprint | 期間 | タスク数 | 主要成果物 | 依存 | 状態 | Issue |
|-------|--------|------|----------|------------|------|------|-------|
| 0 | S1 | 1週間 | 7 | 開発基盤・プロジェクト初期化 | なし | 🔄 | #1-7 |
| 0 | S2 | 1週間 | 8 | CI/CD・自動化環境 | S1 | ⏳ | #8-15 |
| 1 | S3-S4 | 2週間 | 10 | ゲームループ・シーン管理 | P0 | ⏳ | #16-25 |
| 1 | S5-S6 | 2週間 | 10 | レンダリング基盤・ECS | S3-4 | ⏳ | #26-35 |
| 1 | S7-S8 | 2週間 | 10 | 入力システム・イベント | S5-6 | ⏳ | #36-45 |
| 2 | S9-S10 | 2週間 | 10 | ブロック定義・チャンク構造 | P1 | ⏳ | #46-55 |
| 2 | S11-S12 | 2週間 | 10 | ワールド生成・地形 | S9-10 | ⏳ | #56-65 |
| 2 | S13 | 1週間 | 5 | チャンク管理・最適化 | S11-12 | ⏳ | #66-70 |
| 3 | S14-S15 | 2週間 | 10 | プレイヤー実装・移動 | P2 | ⏳ | #71-80 |
| 3 | S16 | 1週間 | 5 | 物理演算・衝突判定 | S14-15 | ⏳ | #81-85 |
| 4 | S17-S18 | 2週間 | 10 | インタラクション・破壊設置 | P3 | ⏳ | #86-95 |
| 4 | S19-S20 | 2週間 | 10 | インベントリ・クラフティング | S17-18 | ⏳ | #96-105 |
| 5 | S21-S22 | 2週間 | 10 | エンティティシステム・AI | P4 | ⏳ | #106-115 |
| 6 | S23-S24 | 2週間 | 10 | レッドストーン・論理回路 | P5 | ⏳ | #116-125 |
| 7 | S25-S27 | 3週間 | 15 | マルチプレイ・ネットワーク | P1-P6 | ⏳ | #126-140 |
| 8 | S28-S29 | 2週間 | 10 | 最適化・パフォーマンス | ALL | ⏳ | #141-150 |

### Sprint計画

```yaml
Sprint構成:
  期間: 1週間
  タスク数: 5-10個
  Issue作成: Sprint開始時に一括
  レビュー: Sprint終了時
  成果物: 動作可能な機能

タスク粒度:
  XS: 30分-1時間 (設定・小修正)
  S: 1-2時間 (単一機能実装)
  M: 2-4時間 (複数ファイル変更)
  L: 4-6時間 (大規模機能)
  XL: 要分割 (6時間超)

PR規模:
  変更ファイル: 最大10個
  変更行数: 最大500行
  テスト必須: カバレッジ80%+
```

---

## 🚀 Phase 0: 基盤構築

### Sprint 1 (Week 1): プロジェクト初期化

#### P0-001: プロジェクト初期化 ⭐️
**サイズ**: XS (1h) | **タイプ**: setup | **優先度**: Critical | **PR**: #1
```bash
# 実装ファイル
- package.json
- tsconfig.json
- vite.config.ts
- .gitignore
- .nvmrc

# 成功基準
- [ ] pnpm create vite実行
- [ ] TypeScript 5.9+ strict設定
- [ ] パスエイリアス設定（@/）
- [ ] Node.js 22.x指定
- [ ] Git初期化

# 検証コマンド
pnpm typecheck && pnpm build

# AIエージェント指示
"P0-001: Viteプロジェクト初期化。TypeScript strict mode、パスエイリアス@/設定"

#### P0-002: Effect-TS設定 ⭐️
**サイズ**: S (2h) | **タイプ**: config | **優先度**: Critical | **PR**: #2
**依存**: P0-001
```typescript
# 実装ファイル
- src/shared/config/effect.ts
- src/shared/types/index.ts
- src/shared/types/branded.ts

# 成功基準
- [ ] Effect-TS 3.17+ インストール
- [ ] @effect/schema インストール
- [ ] @effect/platform インストール
- [ ] 基本型定義（Result, GameError）
- [ ] Branded型定義

# 検証コマンド
pnpm test src/shared/config/effect.test.ts

# AIエージェント指示
"P0-002: Effect-TS初期設定。基本型定義とエラーハンドリングパターン実装"

#### P0-003: Three.js統合
**サイズ**: S (3h) | **タイプ**: config | **優先度**: High
**依存**: P0-001
```bash
# 実装ファイル
- src/infrastructure/three/ThreeLayer.ts
- src/infrastructure/three/types.ts
- public/assets/textures/

# 成功基準
- [ ] Three.js インストール
- [ ] @types/three インストール
- [ ] 基本シーン作成
- [ ] テクスチャローダー設定

# 検証コマンド
pnpm dev # 黒い画面表示確認
```

#### P0-004: テスト環境構築
**サイズ**: S (2h) | **タイプ**: config | **優先度**: High
**依存**: P0-001, P0-002
```bash
# 実装ファイル
- vitest.config.ts
- src/test/setup.ts
- src/test/helpers.ts

# 成功基準
- [ ] Vitest設定
- [ ] fast-check統合
- [ ] Effect-TSテストヘルパー
- [ ] カバレッジ設定

# 検証コマンド
pnpm test && pnpm test:coverage
```

#### P0-005: Lint/Format設定
**サイズ**: XS (1h) | **タイプ**: config | **優先度**: Medium
**依存**: P0-001
```bash
# 実装ファイル
- .eslintrc.json
- .prettierrc
- .oxlintrc.json

# 成功基準
- [ ] oxlint設定
- [ ] Prettier設定
- [ ] pre-commitフック
- [ ] 自動修正設定

# 検証コマンド
pnpm lint && pnpm format
```

#### P0-006: ディレクトリ構造
**サイズ**: XS (30m) | **タイプ**: setup | **優先度**: Critical | **PR**: #6
**依存**: P0-001
```bash
# 作成ディレクトリ
src/
├── domain/          # DDD - ビジネスロジック
├── application/     # ユースケース
├── infrastructure/  # 技術実装
├── presentation/    # UI
└── shared/         # 共通

# 成功基準
- [ ] ディレクトリ作成
- [ ] 各階層にindex.ts
- [ ] READMEファイル

# AIエージェント指示
"P0-006: DDDディレクトリ構造作成"
```

#### P0-007: プロジェクトドキュメント
**サイズ**: S (1h) | **タイプ**: docs | **優先度**: High | **PR**: #7
**依存**: P0-001
```bash
# 実装ファイル
- README.md
- docs/README.md
- CONTRIBUTING.md
- .claude/CLAUDE.md

# 成功基準
- [ ] プロジェクト概要
- [ ] セットアップ手順
- [ ] 開発ガイドライン
- [ ] AI Agent指示書

# AIエージェント指示
"P0-007: プロジェクトドキュメント作成。README、CONTRIBUTING、Claude設定"
```

### Sprint 2 (Week 2): CI/CD・サービス基盤

#### P0-008: CI/CD Pipeline ⭐️
**サイズ**: XS (1h) | **タイプ**: setup | **優先度**: Critical
**依存**: P0-001
```bash
# 作成ディレクトリ
src/
├── domain/          # DDD - ビジネスロジック
├── application/     # ユースケース
├── infrastructure/  # 技術実装
├── presentation/    # UI
└── shared/         # 共通

# 成功基準
- [ ] ディレクトリ作成
- [ ] 各階層にindex.ts
- [ ] READMEファイル
```

#### P0-009: Config Service
**サイズ**: S (3h) | **タイプ**: service | **優先度**: High
**依存**: P0-002
```typescript
# 実装ファイル
- src/shared/services/ConfigService.ts
- src/shared/services/ConfigService.test.ts

# インターフェース
export interface ConfigService {
  readonly gameConfig: GameConfig
  readonly renderConfig: RenderConfig
  readonly debugConfig: DebugConfig
}

# 成功基準
- [ ] Context.GenericTag定義
- [ ] Schema.Struct設定
- [ ] Layer実装
- [ ] テストカバレッジ80%+
```

#### P0-010: Logger Service
**サイズ**: S (2h) | **タイプ**: service | **優先度**: High
**依存**: P0-002, P0-007
```typescript
# 実装ファイル
- src/shared/services/LoggerService.ts
- src/shared/services/LoggerService.test.ts

# インターフェース
export interface LoggerService {
  readonly debug: (message: string, context?: any) => Effect.Effect<void>
  readonly info: (message: string, context?: any) => Effect.Effect<void>
  readonly warn: (message: string, context?: any) => Effect.Effect<void>
  readonly error: (message: string, error?: Error) => Effect.Effect<void>
}

# 成功基準
- [ ] ログレベル制御
- [ ] コンソール出力
- [ ] ファイル出力準備
- [ ] パフォーマンス計測
```

#### P0-011: Error定義
**サイズ**: S (2h) | **タイプ**: types | **優先度**: High
**依存**: P0-002
```typescript
# 実装ファイル
- src/shared/errors/index.ts
- src/shared/errors/GameErrors.ts
- src/shared/errors/NetworkErrors.ts

# 基本エラー
export const GameError = Schema.TaggedError("GameError")
export const ConfigError = Schema.TaggedError("ConfigError")
export const RenderError = Schema.TaggedError("RenderError")

# 成功基準
- [ ] TaggedError定義
- [ ] エラーハンドリング
- [ ] エラーリカバリー
```

#### P0-012: テスト環境構築
**サイズ**: S (2h) | **タイプ**: config | **優先度**: High | **PR**: #12
**依存**: P0-001, P0-002
```typescript
# 実装ファイル
- vitest.config.ts
- src/test/setup.ts
- src/test/helpers.ts

# 成功基準
- [ ] Vitest設定
- [ ] fast-check統合
- [ ] Effect-TSテストヘルパー
- [ ] カバレッジ設定

# 検証コマンド
pnpm test && pnpm test:coverage

# AIエージェント指示
"P0-012: Vitestテスト環境構築。fast-check、Effect-TSテストヘルパー設定"
```

#### P0-013: Lint/Format設定
**サイズ**: XS (1h) | **タイプ**: config | **優先度**: Medium | **PR**: #13
**依存**: P0-001
```bash
# 実装ファイル
- .eslintrc.json
- .prettierrc
- .oxlintrc.json

# 成功基準
- [ ] oxlint設定
- [ ] Prettier設定
- [ ] pre-commitフック
- [ ] 自動修正設定

# 検証コマンド
pnpm lint && pnpm format

# AIエージェント指示
"P0-013: Lint/Format設定。oxlint、Prettier、pre-commitフック設定"
```

#### P0-014: Three.js統合
**サイズ**: S (2h) | **タイプ**: config | **優先度**: High | **PR**: #14
**依存**: P0-001
```typescript
# 実装ファイル
- src/infrastructure/three/ThreeLayer.ts
- src/infrastructure/three/types.ts
- public/assets/textures/

# 成功基準
- [ ] Three.js インストール
- [ ] @types/three インストール
- [ ] 基本シーン作成
- [ ] テクスチャローダー設定

# 検証コマンド
pnpm dev # 黒い画面表示確認

# AIエージェント指示
"P0-014: Three.js初期設定。WebGLRenderer、基本シーン作成"
```

#### P0-015: 自動化スクリプト
**サイズ**: S (2h) | **タイプ**: config | **優先度**: Medium
**依存**: P0-004, P0-005
```yaml
# 実装ファイル
- .github/workflows/ci.yml
- .github/workflows/pr-check.yml

# 成功基準
- [ ] TypeCheckアクション
- [ ] Testアクション
- [ ] Lintアクション
- [ ] カバレッジレポート
```

---

## 🎮 Phase 1: コアエンジン

### Sprint 3-4 (Week 3-4): ゲームループ・シーン管理

#### P1-001: GameLoop Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: Critical
**依存**: P0-007, P0-008
```typescript
# 実装ファイル
- src/domain/game-loop/types.ts
- src/domain/game-loop/GameLoopService.ts

# インターフェース
export interface GameLoopService {
  readonly start: () => Effect.Effect<void, GameLoopError>
  readonly stop: () => Effect.Effect<void, never>
  readonly pause: () => Effect.Effect<void, never>
  readonly resume: () => Effect.Effect<void, GameLoopError>
  readonly update: (deltaTime: number) => Effect.Effect<void, UpdateError>
}

# 成功基準
- [ ] 60FPS固定
- [ ] デルタタイム計算
- [ ] フレームスキップ
```

#### P1-002: GameLoop実装
**サイズ**: M (4h) | **タイプ**: service | **優先度**: Critical
**依存**: P1-001
```typescript
# 実装ファイル
- src/domain/game-loop/GameLoopServiceLive.ts
- src/domain/game-loop/GameLoopService.test.ts
- src/domain/game-loop/GameLoopService.pbt.test.ts

# 実装要件
- Effect.Schedule使用
- requestAnimationFrame統合
- パフォーマンス計測

# 成功基準
- [ ] 安定60FPS
- [ ] CPU使用率10%以下（アイドル時）
- [ ] メモリリークなし
```

#### P1-003: Scene Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: High
**依存**: P0-002
```typescript
# 実装ファイル
- src/domain/scene/types.ts
- src/domain/scene/SceneManager.ts

# インターフェース
export interface Scene {
  readonly name: string
  readonly onEnter: () => Effect.Effect<void, SceneError>
  readonly onUpdate: (deltaTime: number) => Effect.Effect<void, UpdateError>
  readonly onExit: () => Effect.Effect<void, never>
}

export interface SceneManager {
  readonly currentScene: () => Effect.Effect<Scene, never>
  readonly switchTo: (sceneName: string) => Effect.Effect<void, SceneError>
  readonly push: (scene: Scene) => Effect.Effect<void, SceneError>
  readonly pop: () => Effect.Effect<void, SceneError>
}
```

#### P1-004: Scene実装
**サイズ**: M (4h) | **タイプ**: service | **優先度**: High
**依存**: P1-003
```typescript
# 実装ファイル
- src/domain/scene/SceneManagerLive.ts
- src/domain/scene/scenes/MainMenuScene.ts
- src/domain/scene/scenes/GameScene.ts
- src/domain/scene/SceneManager.test.ts

# 実装要件
- Match.value使用
- スタック管理
- リソース管理

# 成功基準
- [ ] シーン遷移動作
- [ ] メモリクリーンアップ
- [ ] 遷移アニメーション準備
```

### Sprint 5-6 (Week 5-6): レンダリング基盤・ECS

#### P1-005: Renderer Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: Critical
**依存**: P0-003
```typescript
# 実装ファイル
- src/infrastructure/rendering/types.ts
- src/infrastructure/rendering/RendererService.ts

# インターフェース
export interface RendererService {
  readonly initialize: (canvas: HTMLCanvasElement) => Effect.Effect<void, RenderError>
  readonly render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderError>
  readonly resize: (width: number, height: number) => Effect.Effect<void, never>
  readonly dispose: () => Effect.Effect<void, never>
}
```

#### P1-006: Three.js Layer実装
**サイズ**: M (4h) | **タイプ**: infrastructure | **優先度**: Critical
**依存**: P1-005
```typescript
# 実装ファイル
- src/infrastructure/rendering/ThreeRendererLive.ts
- src/infrastructure/rendering/ThreeRenderer.test.ts

# 実装要件
- WebGLRenderer設定
- アンチエイリアシング
- シャドウマップ
- ポストプロセシング準備

# 成功基準
- [ ] 60FPS描画
- [ ] リサイズ対応
- [ ] WebGL2サポート
```

#### P1-007: Camera System
**サイズ**: M (4h) | **タイプ**: service | **優先度**: High
**依存**: P1-006
```typescript
# 実装ファイル
- src/domain/camera/CameraService.ts
- src/domain/camera/FirstPersonCamera.ts
- src/domain/camera/ThirdPersonCamera.ts

# 成功基準
- [ ] 一人称視点
- [ ] 三人称視点
- [ ] スムーズ遷移
- [ ] FOV調整
```

#### P1-008: ECS Component基盤
**サイズ**: M (4h) | **タイプ**: infrastructure | **優先度**: Critical
**依存**: P0-002
```typescript
# 実装ファイル
- src/infrastructure/ecs/Component.ts
- src/infrastructure/ecs/ComponentRegistry.ts

# 実装要件
export const PositionComponent = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export const VelocityComponent = Schema.Struct({
  vx: Schema.Number,
  vy: Schema.Number,
  vz: Schema.Number
})

# 成功基準
- [ ] Schema.Struct定義
- [ ] 型安全性
- [ ] シリアライズ可能
```

#### P1-009: ECS System基盤
**サイズ**: M (5h) | **タイプ**: infrastructure | **優先度**: Critical
**依存**: P1-008
```typescript
# 実装ファイル
- src/infrastructure/ecs/System.ts
- src/infrastructure/ecs/SystemRegistry.ts
- src/infrastructure/ecs/World.ts

# インターフェース
export interface System {
  readonly name: string
  readonly update: (world: World, deltaTime: number) => Effect.Effect<void, SystemError>
}

# 成功基準
- [ ] System登録
- [ ] 実行順序制御
- [ ] パフォーマンス最適化
```

#### P1-010: ECS Entity管理
**サイズ**: M (4h) | **タイプ**: infrastructure | **優先度**: Critical
**依存**: P1-008, P1-009
```typescript
# 実装ファイル
- src/infrastructure/ecs/Entity.ts
- src/infrastructure/ecs/EntityManager.ts

# 実装要件
- Structure of Arrays
- Entity Pool
- Component追加/削除

# 成功基準
- [ ] 10000エンティティ処理
- [ ] 60FPS維持
- [ ] メモリ効率
```

### Sprint 7-8 (Week 7-8): 入力システム

#### P1-011: Input Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: High
**依存**: P0-002
```typescript
# 実装ファイル
- src/domain/input/types.ts
- src/domain/input/InputService.ts

# インターフェース
export interface InputService {
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, never>
  readonly isMousePressed: (button: number) => Effect.Effect<boolean, never>
  readonly getMouseDelta: () => Effect.Effect<MouseDelta, never>
  readonly registerHandler: (handler: InputHandler) => Effect.Effect<void, never>
}
```

#### P1-012: Keyboard Input
**サイズ**: S (3h) | **タイプ**: service | **優先度**: High
**依存**: P1-011
```typescript
# 実装ファイル
- src/domain/input/KeyboardInput.ts
- src/domain/input/KeyMapping.ts

# キーマッピング
export const DefaultKeyMap = {
  forward: 'W',
  backward: 'S',
  left: 'A',
  right: 'D',
  jump: 'Space',
  crouch: 'Shift',
  sprint: 'Control'
}

# 成功基準
- [ ] キー状態管理
- [ ] 同時押し対応
- [ ] カスタムマッピング
```

#### P1-013: Mouse Input
**サイズ**: S (3h) | **タイプ**: service | **優先度**: High
**依存**: P1-011
```typescript
# 実装ファイル
- src/domain/input/MouseInput.ts
- src/domain/input/MouseSensitivity.ts

# 成功基準
- [ ] マウス移動検出
- [ ] クリック検出
- [ ] ポインターロック
- [ ] 感度調整
```

---

## 🌍 Phase 2: ワールド生成

### Sprint 9-10 (Week 9-10): ブロック・チャンク構造

#### P2-001: Block Types定義
**サイズ**: M (4h) | **タイプ**: domain | **優先度**: Critical
**依存**: P0-002
```typescript
# 実装ファイル
- src/domain/block/BlockType.ts
- src/domain/block/BlockRegistry.ts
- src/domain/block/BlockProperties.ts

# ブロック定義例
export const GrassBlock = Schema.Struct({
  id: Schema.Literal("grass"),
  name: Schema.Literal("Grass Block"),
  hardness: Schema.Literal(0.6),
  tool: Schema.Literal("shovel"),
  drops: Schema.Array(ItemStack)
})

# 成功基準
- [ ] 50種類以上定義
- [ ] マテリアル属性
- [ ] テクスチャマッピング
```

#### P2-002: Chunk Structure
**サイズ**: M (5h) | **タイプ**: domain | **優先度**: Critical
**依存**: P2-001
```typescript
# 実装ファイル
- src/domain/chunk/Chunk.ts
- src/domain/chunk/ChunkData.ts

# チャンク構造
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 384

export interface Chunk {
  readonly position: ChunkPosition
  readonly blocks: Uint16Array // 16x16x384
  readonly metadata: ChunkMetadata
  readonly isDirty: boolean
}

# 成功基準
- [ ] 効率的メモリ構造
- [ ] 高速アクセス
- [ ] 圧縮対応
```

#### P2-003: World Generator Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: High
**依存**: P2-002
```typescript
# 実装ファイル
- src/domain/world/WorldGenerator.ts
- src/domain/world/GeneratorOptions.ts

# インターフェース
export interface WorldGenerator {
  readonly generateChunk: (position: ChunkPosition) => Effect.Effect<Chunk, GenerationError>
  readonly generateStructure: (type: StructureType, position: Vector3) => Effect.Effect<Structure, GenerationError>
}
```

#### P2-004: Terrain Generation
**サイズ**: L (6h) | **タイプ**: service | **優先度**: Critical
**依存**: P2-003
```typescript
# 実装ファイル
- src/domain/world/TerrainGenerator.ts
- src/domain/world/NoiseGenerator.ts
- src/domain/world/BiomeGenerator.ts

# 実装要件
- Perlin Noise
- 高度マップ
- バイオーム分布
- 洞窟生成

# 成功基準
- [ ] 自然な地形
- [ ] バイオーム遷移
- [ ] 洞窟・渓谷
- [ ] 鉱石分布
```

#### P2-005: Chunk Manager
**サイズ**: L (6h) | **タイプ**: service | **優先度**: Critical
**依存**: P2-002, P2-004
```typescript
# 実装ファイル
- src/domain/chunk/ChunkManager.ts
- src/domain/chunk/ChunkLoader.ts
- src/domain/chunk/ChunkCache.ts

# 実装要件
- 動的ロード/アンロード
- LRUキャッシュ
- 非同期生成
- メモリ管理

# 成功基準
- [ ] 描画距離16チャンク
- [ ] スムーズロード
- [ ] メモリ制限2GB
```

#### P2-006: Mesh Generation
**サイズ**: L (6h) | **タイプ**: rendering | **優先度**: High
**依存**: P2-005, P1-006
```typescript
# 実装ファイル
- src/infrastructure/rendering/MeshGenerator.ts
- src/infrastructure/rendering/GreedyMeshing.ts

# 最適化
- Greedy Meshing
- 面カリング
- AO計算
- テクスチャアトラス

# 成功基準
- [ ] 頂点数削減50%+
- [ ] 60FPS維持
- [ ] LOD対応
```

---

### Sprint 11-12 (Week 11-12): ワールド生成

#### P2-003: World Generator Interface
**サイズ**: S (2h) | **タイプ**: interface | **優先度**: High | **PR**: #58
**依存**: P2-002
```typescript
# 実装ファイル
- src/domain/world/WorldGenerator.ts
- src/domain/world/GeneratorOptions.ts

# インターフェース
export interface WorldGenerator {
  readonly generateChunk: (position: ChunkPosition) => Effect.Effect<Chunk, GenerationError>
  readonly generateStructure: (type: StructureType, position: Vector3) => Effect.Effect<Structure, GenerationError>
}
```

#### P2-004: Terrain Generation
**サイズ**: L (6h) | **タイプ**: service | **優先度**: Critical | **PR**: #59
**依官**: P2-003
```typescript
# 実装ファイル
- src/domain/world/TerrainGenerator.ts
- src/domain/world/NoiseGenerator.ts
- src/domain/world/BiomeGenerator.ts

# 実装要件
- Perlin Noise
- 高度マップ
- バイオーム分布
- 洞窟生成

# 成功基準
- [ ] 自然な地形
- [ ] バイオーム遷移
- [ ] 洞窟・渓谷
- [ ] 鉱石分布
```

### Sprint 13 (Week 13): チャンク管理

#### P2-005: Chunk Manager
**サイズ**: L (6h) | **タイプ**: service | **優先度**: Critical | **PR**: #66
**依存**: P2-002, P2-004
```typescript
# 実装ファイル
- src/domain/chunk/ChunkManager.ts
- src/domain/chunk/ChunkLoader.ts
- src/domain/chunk/ChunkCache.ts

# 実装要件
- 動的ロード/アンロード
- LRUキャッシュ
- 非同期生成
- メモリ管理

# 成功基準
- [ ] 描画距離16チャンク
- [ ] スムーズロード
- [ ] メモリ制限2GB
```

#### P2-006: Mesh Generation
**サイズ**: L (6h) | **タイプ**: rendering | **優先度**: High | **PR**: #67
**依存**: P2-005, P1-006
```typescript
# 実装ファイル
- src/infrastructure/rendering/MeshGenerator.ts
- src/infrastructure/rendering/GreedyMeshing.ts

# 最適化
- Greedy Meshing
- 面カリング
- AO計算
- テクスチャアトラス

# 成功基準
- [ ] 頂点数削減50%+
- [ ] 60FPS維持
- [ ] LOD対応
```

---

## 👤 Phase 3: プレイヤー基本

### Sprint 14-15 (Week 14-15): プレイヤー実装・移動

#### P3-001: Player Entity
**サイズ**: M (4h) | **タイプ**: domain | **優先度**: Critical
**依存**: P1-010
```typescript
# 実装ファイル
- src/domain/player/Player.ts
- src/domain/player/PlayerStats.ts

# プレイヤー定義
export const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String,
  position: Vector3,
  rotation: Rotation,
  health: Schema.Number.pipe(Schema.between(0, 20)),
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  gameMode: GameMode
})

# 成功基準
- [ ] ECSエンティティ
- [ ] ステータス管理
- [ ] 永続化対応
```

#### P3-002: Movement System
**サイズ**: L (5h) | **タイプ**: system | **優先度**: Critical
**依存**: P3-001, P1-012, P1-013
```typescript
# 実装ファイル
- src/domain/player/MovementSystem.ts
- src/domain/player/MovementController.ts

# 移動要件
- WASD移動
- ジャンプ
- しゃがみ
- スプリント
- 水泳

# 成功基準
- [ ] スムーズ移動
- [ ] 衝突判定
- [ ] 階段自動昇降
```

#### P3-003: Physics System
**サイズ**: L (6h) | **タイプ**: system | **優先度**: Critical
**依存**: P3-002
```typescript
# 実装ファイル
- src/domain/physics/PhysicsSystem.ts
- src/domain/physics/Collision.ts
- src/domain/physics/Gravity.ts

# 物理要件
- 重力（9.8m/s²）
- 衝突検出（AABB）
- 摩擦
- 水/溶岩抵抗

# 成功基準
- [ ] リアルな落下
- [ ] 正確な衝突
- [ ] 水中物理
```

#### P3-004: Block Interaction
**サイズ**: M (4h) | **タイプ**: feature | **優先度**: High
**依存**: P3-001, P2-001
```typescript
# 実装ファイル
- src/domain/player/BlockInteraction.ts
- src/domain/player/Raycast.ts

# インタラクション
- レイキャスト
- ブロック破壊
- ブロック設置
- 破壊アニメーション

# 成功基準
- [ ] 正確な選択
- [ ] 破壊時間計算
- [ ] パーティクル
```

#### P3-005: Inventory System
**サイズ**: L (5h) | **タイプ**: system | **優先度**: High
**依存**: P3-001
```typescript
# 実装ファイル
- src/domain/inventory/Inventory.ts
- src/domain/inventory/ItemStack.ts
- src/domain/inventory/InventoryManager.ts

# インベントリ構造
export const Inventory = Schema.Struct({
  slots: Schema.Array(ItemStack).pipe(Schema.maxItems(36)),
  hotbar: Schema.Array(ItemStack).pipe(Schema.maxItems(9)),
  armor: ArmorSlots,
  offhand: ItemStack
})

# 成功基準
- [ ] 36スロット管理
- [ ] スタック処理
- [ ] ドラッグ&ドロップ
```

---

## 📋 タスク実行順序（最適化済み）

### 優先度ランク

**🔴 Critical Path（ブロッカー）**
1. P0-001 → P0-002 → P0-007 → P0-008
2. P1-001 → P1-002 → ゲームループ確立
3. P0-003 → P1-005 → P1-006 → レンダリング確立

**🟡 High Priority（コア機能）**
1. P1-008 → P1-009 → P1-010 → ECS基盤
2. P2-001 → P2-002 → P2-004 → ワールド生成
3. P3-001 → P3-002 → P3-003 → プレイヤー移動

**🟢 Medium Priority（拡張）**
1. P1-011 → P1-012 → P1-013 → 入力システム
2. P2-005 → P2-006 → チャンク最適化
3. P3-004 → P3-005 → インタラクション

---

## 🎯 成功指標

### Phase完了条件

#### Phase 0 ✅
- [ ] `pnpm dev`で起動
- [ ] TypeScript strictモード
- [ ] Effect-TS動作確認
- [ ] テスト実行可能

#### Phase 1 ✅
- [ ] 60FPS安定動作
- [ ] 基本的な3D描画
- [ ] ECS 1000エンティティ処理

#### Phase 2 ✅
- [ ] 無限ワールド生成
- [ ] 16チャンク描画距離
- [ ] メモリ使用量2GB以下

#### Phase 3 ✅
- [ ] プレイヤー操作完成
- [ ] ブロック破壊/設置
- [ ] インベントリ動作

### パフォーマンス基準

```yaml
FPS:
  目標: 60
  最低: 30
  測定: requestAnimationFrame

メモリ:
  目標: 1GB
  上限: 2GB
  測定: performance.memory

チャンクロード:
  目標: 50ms
  上限: 100ms
  測定: Performance.now()

エンティティ:
  目標: 200体
  最低: 100体
  測定: 60FPS維持
```

---

## 🔧 開発フロー

### 1. Sprint開始
```bash
# Sprint計画作成
./scripts/sprint-start.sh 3  # Sprint 3開始

# タスク一覧確認
./scripts/list-tasks.sh --sprint 3
```

### 2. Issue作成
```bash
# 単一Issue作成
./scripts/create-issue.sh P1-001

# Sprint全Issue作成
./scripts/create-sprint-issues.sh 3
```

### 3. 実装
```bash
# AI Agent実装
claude "Issue #101 (P1-001)を実装して"

# または
cursor "P1-001: GameLoop Interfaceを実装"
```

### 4. PR作成
```bash
# PR作成&検証
./scripts/create-pr.sh 101  # Issue番号

# 自動チェック項目
- [ ] TypeCheck通過
- [ ] Test通過（カバレッジ80%+）
- [ ] Lint通過
- [ ] Build成功
- [ ] Docs更新
```

### 5. レビュー&マージ
```bash
# セルフレビューチェックリスト
./scripts/pr-review.sh 101

# マージ後
./scripts/task-complete.sh P1-001
```

---

## 📚 参考資料

### プロジェクト構造
```
/
├── .claude/           # AI Agent設定
│   ├── agents/       # 専門エージェント定義
│   ├── automation/   # 自動化スクリプト
│   ├── context/      # コンテキスト情報
│   ├── templates/    # Issue/PRテンプレート
│   └── workflows/    # 開発ワークフロー
├── .github/          # GitHub Actions
├── docs/             # 完全仕様書（信頼できる単一の情報源）
├── scripts/          # 開発支援スクリプト
└── src/              # ソースコード
```

### ドキュメント
- [Effect-TSパターン](.claude/context/effect-patterns.md)
- [アーキテクチャ](docs/explanations/architecture/)
- [コア機能仕様](docs/explanations/game-mechanics/)
- [開発ガイド](docs/how-to/development/)

### 実装パターン
- Service: Context.GenericTag + Layer
- Data: Schema.Struct + Data.Class
- Error: Schema.TaggedError
- Test: Vitest + fast-check