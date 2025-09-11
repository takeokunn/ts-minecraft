# DDD アーキテクチャ移行実行計画 v2.0
## 並列実行対応版

## 📋 概要
このドキュメントは、TypeScript Minecraftプロジェクトの DDD アーキテクチャを改善するための並列実行可能な移行計画です。
各フェーズは独立したサブエージェントで並列実行できるように設計されています。
  
## 🎯 移行の目標
1. DDDの原則に従った明確な層分離
2. 責務の明確化と単一責任原則の徹底
3. 依存関係の整理と循環参照の解消
4. Effect-TSパターンの統一的な適用

## 🚨 検出された主要な問題点

### 1. 循環依存の問題（最優先）
- ❌ `application/services/world.service` → `infrastructure/services/*`
- ❌ `infrastructure/*` → `application/services/world.service`
- ❌ `domain/services/*` → `application/services/*` （DDDの原則違反！）
- ❌ 層をまたいだ双方向依存が多数存在

### 2. アーキテクチャ違反
- ❌ `src/application/services/` にドメインロジックが混在
- ❌ `src/infrastructure/services/` にビジネスロジックが含まれている
- ❌ `src/presentation/services/` が存在（presentationは薄い層であるべき）
- ❌ `src/@types/` がsrc直下に存在（適切な層に配置すべき）

### 3. Effect-TS実装の不統一
- ❌ `@effect/schema/Schema` と `effect/Schema` の混在
- ❌ Context.Tag パターンの不適切な使用
- ❌ Layer構成の複雑化と重複
- ❌ Service定義の場所が分散（.service.ts vs .layer.ts）

### 4. Worker実装の分散と重複
- ❌ `infrastructure/workers/` ディレクトリに実装
- ❌ `infrastructure/services/*-worker.service.ts` に別実装
- ❌ TypedWorker と通常Worker の混在
- ❌ メッセージプロトコルの不統一

### 5. 命名規則の不統一
- ❌ サービスクラスの命名が不統一（Service, Manager, System混在）
- ❌ ファイル名とクラス名の不一致
- ❌ `.service.ts` サフィックスが全層で使用されている

### 6. 責務の混乱
- ❌ WorldServiceが複数箇所に存在
- ❌ InputServiceがapplication層に存在（infrastructure層にあるべき）
- ❌ ドメインサービスとアプリケーションサービスの境界が不明確

## 📅 実行フェーズ

### 🔄 Phase 0: 緊急修正フェーズ（所要時間: 1時間）
**最優先で単一エージェントが実行**

#### Task 0.1: 循環依存の解消
```bash
# 循環依存を検出
npx madge --circular src/
```

#### Task 0.2: 依存関係の逆転
```typescript
// src/domain/ports/ に抽象化を作成
export interface IWorldRepository {
  loadChunk(coords: ChunkCoordinates): Effect.Effect<Chunk>
  saveChunk(chunk: Chunk): Effect.Effect<void>
}

export interface IEntityRepository {
  findById(id: EntityId): Effect.Effect<Entity>
  save(entity: Entity): Effect.Effect<void>
}
```

#### Task 0.3: Effect Schema の統一
```bash
# 古い @effect/schema を新しい effect/Schema に置換
find src -name "*.ts" -exec sed -i '' 's/@effect\/schema\/Schema/effect\/Schema/g' {} \;
```

---

### 🔄 Phase 1: 並列準備フェーズ（所要時間: 30分）
**単一エージェントで実行**

#### Task 1.1: 依存関係分析とグループ化
```bash
# 循環依存が解消されたことを確認
npx madge --circular src/
# 依存関係グラフを生成
npx madge --image dependency-graph.png src/
```

#### Task 1.2: テストカバレッジ確認
```bash
# 既存テストの確認と不足箇所の特定
npm test -- --coverage
```

#### Task 1.3: 移行用ブランチ作成
```bash
git checkout -b feature/ddd-architecture-migration-v3
git commit -m "fix: resolve circular dependencies"
```

---

### 🚀 Phase 2: 並列移行フェーズ（所要時間: 2-3時間）
**7つのサブエージェントで並列実行**

#### 🤖 Agent A: Domain層の整理
**独立実行可能**

##### Tasks:
1. **Value Objects の整理**
   - `src/domain/value-objects/` の構造を最適化
   - 不要な依存関係を削除
   - 純粋な値オブジェクトになるよう修正

2. **Entity の修正**
   - `src/domain/entities/` 内のビジネスロジック強化
   - エンティティの不変条件を明確化
   - ドメインイベントの実装

3. **Domain Service の純粋化**
   - `src/domain/services/` をドメインロジックのみに限定
   - application/services への依存を完全に排除
   - ポートインターフェースの使用

**修正対象ファイル:**
```
# 循環依存を解消
src/domain/services/collision-system.service.ts
  - WorldService as World → IWorldRepository
  - SpatialGrid → ISpatialGridPort

src/domain/services/physics.service.ts → physics-domain.service.ts
src/domain/services/entity.service.ts → entity-domain.service.ts
src/domain/services/camera-control.service.ts
  - InputManager → IInputPort
  - WorldService → IWorldRepository
```

---

#### 🤖 Agent B: Application層の再構築
**独立実行可能**

##### Tasks:
1. **Use Case の実装**
   ```typescript
   // 新規作成: src/application/use-cases/
   - player-move.use-case.ts
   - block-place.use-case.ts
   - chunk-load.use-case.ts
   - world-generate.use-case.ts
   ```

2. **Application Service の移行**
   - `src/application/services/` を削除
   - Use CaseとWorkflowに機能を分散

3. **Commands/Queries の最適化**
   - CQRS パターンの徹底
   - コマンドハンドラーの実装
   - クエリハンドラーの実装

**削除対象:**
```
src/application/services/input-manager.service.ts
src/application/services/input-system.service.ts
src/application/services/input-polling.service.ts
src/application/services/input.service.ts
src/application/services/world.service.ts
```

---

#### 🤖 Agent C: Infrastructure層の整理
**独立実行可能**

##### Tasks:
1. **Adapter パターンの実装**
   ```typescript
   // 新規作成: src/infrastructure/adapters/
   - three-js.adapter.ts
   - webgpu.adapter.ts
   - browser-input.adapter.ts
   - websocket.adapter.ts
   ```

2. **Repository の実装**
   ```typescript
   // 新規作成: src/infrastructure/repositories/
   - world.repository.ts
   - entity.repository.ts
   - chunk.repository.ts
   ```

3. **Service → Adapter への移行**
   - `src/infrastructure/services/` の内容を適切な場所へ移動
   - 技術的な実装詳細をAdapterに隔離

**移行対象:**
```
src/infrastructure/services/renderer.service.ts → adapters/three-js.adapter.ts
src/infrastructure/services/input-manager.service.ts → adapters/browser-input.adapter.ts
src/infrastructure/services/clock.service.ts → adapters/clock.adapter.ts
```

---

#### 🤖 Agent D: Presentation層の簡素化
**独立実行可能**

##### Tasks:
1. **Controller の実装**
   ```typescript
   // 新規作成: src/presentation/controllers/
   - game.controller.ts
   - debug.controller.ts
   - ui.controller.ts
   ```

2. **View Model の実装**
   ```typescript
   // 新規作成: src/presentation/view-models/
   - game-state.vm.ts
   - player-status.vm.ts
   - world-info.vm.ts
   ```

3. **不要なサービスの削除**
   ```bash
   rm -rf src/presentation/services/
   ```

---

#### 🤖 Agent E: Worker統合エージェント
**独立実行可能**

##### Tasks:
1. **Worker実装の統合**
   ```typescript
   // src/infrastructure/workers/unified/
   - worker-manager.ts （統一マネージャー）
   - worker-pool.ts （プール管理）
   - protocols/terrain.protocol.ts
   - protocols/physics.protocol.ts
   - protocols/mesh.protocol.ts
   ```

2. **既存Worker削除**
   ```bash
   # 重複実装を削除
   rm src/infrastructure/services/*-worker.service.ts
   rm src/infrastructure/workers/base/*
   rm src/infrastructure/workers/shared/*
   ```

3. **メッセージプロトコル統一**
   - Effect Schema を使用した型安全なプロトコル
   - 共通エラーハンドリング

---

#### 🤖 Agent F: Effect-TS Layer修正エージェント
**独立実行可能**

##### Tasks:
1. **Layer構成の簡素化**
   ```typescript
   // src/infrastructure/layers/unified.layer.ts
   export const InfrastructureLayer = Layer.merge(
     ClockLive,
     RendererLive,
     InputLive,
     // 他のレイヤーを統合
   )
   ```

2. **Service定義の統一**
   - `.service.ts` ファイルを削除
   - `.layer.ts` にService定義とLive実装を統合

3. **依存関係の明確化**
   - Layer間の依存を明示的に定義
   - 循環参照の防止

---

#### 🤖 Agent G: 共通・横断的関心事の整理
**独立実行可能**

##### Tasks:
1. **型定義の移動**
   ```bash
   # @types を shared へ移動
   mkdir src/shared/types
   mv src/@types/* src/shared/types/
   rmdir src/@types
   ```

2. **共通ユーティリティの整理**
   ```typescript
   // 新規作成: src/shared/
   - constants/
   - types/
   - utils/
   - decorators/
   ```

3. **設定ファイルの統合**
   ```typescript
   // 新規作成: src/config/
   - app.config.ts
   - game.config.ts
   - infrastructure.config.ts
   ```

---

### 🔧 Phase 3: 統合フェーズ（所要時間: 1時間）
**単一エージェントで実行**

#### Task 3.1: 依存関係の解決
```bash
# 各エージェントの変更をマージ
git merge --no-ff agent-a-domain
git merge --no-ff agent-b-application
git merge --no-ff agent-c-infrastructure
git merge --no-ff agent-d-presentation
git merge --no-ff agent-e-shared
```

#### Task 3.2: Effect-TS Layer の再構築
```typescript
// src/main.ts の更新
const AppLayer = Layer.merge(
  DomainLayer,
  ApplicationLayer,
  InfrastructureLayer,
  PresentationLayer
)
```

#### Task 3.3: インポートパスの修正
```bash
# tsconfig.json のパスマッピング更新
{
  "paths": {
    "@domain/*": ["src/domain/*"],
    "@application/*": ["src/application/*"],
    "@infrastructure/*": ["src/infrastructure/*"],
    "@presentation/*": ["src/presentation/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

---

### ✅ Phase 4: 検証フェーズ（所要時間: 30分）
**並列実行可能（4エージェント）**

#### 🤖 Validator A: 静的解析
```bash
npm run lint
npm run typecheck
npm run analyze:circular
# 新規追加: 複雑度分析
npx complexity-report-html src/ -o complexity-report/
```

#### 🤖 Validator B: テスト実行
```bash
# 並列テスト実行
npm test -- --maxWorkers=4
npm run test:e2e
npm run test:performance
# 新規追加: mutationテスト
npx stryker run
```

#### 🤖 Validator C: ビルド検証
```bash
npm run build
npm run build:production
npm run size-limit
# 新規追加: bundle分析
npx webpack-bundle-analyzer dist/stats.json
```

#### 🤖 Validator D: セキュリティ監査
```bash
npm audit
npx snyk test
# 依存関係の脆弱性チェック
npx check-dependencies
```

---

## 🔄 並列実行調整メカニズム

### エージェント間通信
```yaml
# .github/agent-coordination.yml
coordination:
  communication:
    - type: "slack-webhook"
      url: "${SLACK_WEBHOOK_URL}"
    - type: "github-issues"
      labels: ["agent-update"]
  
  checkpoints:
    - phase: 2
      interval: "30m"
      required_status: ["in-progress", "completed"]
    
  conflict_resolution:
    strategy: "automated-merge"
    fallback: "manual-review"
```

### 進捗トラッキング
```typescript
// tools/agent-tracker.ts
interface AgentStatus {
  agentId: string
  phase: number
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  blockers?: string[]
  completedTasks: string[]
  estimatedCompletion: Date
}

// リアルタイム進捗ダッシュボード
// http://localhost:3001/agent-dashboard
```

---

## 📦 データマイグレーション戦略

### Migration Scripts
```typescript
// migrations/001-separate-services.ts
export const up = async () => {
  // 1. WorldServiceの分離
  await splitWorldService()
  
  // 2. Entity構造の更新
  await updateEntityStructure()
  
  // 3. Component登録の移行
  await migrateComponentRegistry()
}

export const down = async () => {
  // ロールバック処理
  await restoreOriginalStructure()
}
```

### データバックアップ
```bash
# Phase 0で実行
npm run backup:create -- --name "pre-migration-$(date +%Y%m%d)"

# ロールバック時
npm run backup:restore -- --name "pre-migration-20250911"
```

---

## ⚡ パフォーマンス最適化タスク

### 🤖 Agent P: パフォーマンス専門エージェント
**Phase 2と並列実行可能**

#### Tasks:
1. **バンドル最適化**
   ```typescript
   // webpack.config.optimization.js
   - Code Splitting戦略の実装
   - Tree Shakingの最適化
   - Dynamic Importの活用
   - WebWorker bundleの分離
   ```

2. **メモリ最適化**
   ```typescript
   // Object Poolingの強化
   - Component Pool拡張
   - Mesh Pool実装
   - Texture Cache最適化
   ```

3. **起動時間最適化**
   ```typescript
   // Lazy Loading戦略
   - Effect Layerの遅延ロード
   - リソースの優先度設定
   - Critical Path最適化
   ```

---

## 📊 モニタリング＆アラート

### メトリクス収集
```typescript
// monitoring/metrics.ts
export const collectMetrics = () => ({
  buildTime: measureBuildTime(),
  bundleSize: analyzeBundleSize(),
  testCoverage: getTestCoverage(),
  circularDeps: detectCircularDependencies(),
  performanceScore: calculatePerformanceScore()
})
```

### アラート設定
```yaml
# .github/workflows/migration-alerts.yml
alerts:
  - metric: "bundle_size"
    threshold: "+10%"
    severity: "warning"
  
  - metric: "circular_dependencies"
    threshold: "> 0"
    severity: "critical"
  
  - metric: "test_coverage"
    threshold: "< 70%"
    severity: "warning"
```

---

## 📊 期待される成果

### アーキテクチャ改善
- ✅ 明確な層分離（Domain, Application, Infrastructure, Presentation）
- ✅ 単方向の依存関係
- ✅ テスタビリティの向上
- ✅ 保守性の向上

### パフォーマンス改善
- ✅ バンドルサイズの削減（約20%）
- ✅ 起動時間の短縮（約15%）
- ✅ メモリ使用量の最適化

### 開発効率
- ✅ 並列開発が容易に
- ✅ モジュール単位でのテストが可能
- ✅ 新機能追加時の影響範囲が明確

## 🚦 ロールバック計画

問題が発生した場合：
```bash
# 変更を元に戻す
git checkout main
git branch -D feature/ddd-architecture-migration-v2

# 必要に応じて特定のエージェントの変更のみ採用
git cherry-pick <commit-hash>
```

## 📝 注意事項

1. **並列実行の前提条件**
   - 各エージェントは独立したブランチで作業
   - 定期的にmainブランチとの同期を確認
   - コンフリクトは統合フェーズで解決

2. **コミュニケーション**
   - 各エージェントは進捗を定期的に報告
   - ブロッカーが発生した場合は即座に共有
   - 設計変更は全エージェントに通知

3. **品質保証**
   - 各フェーズ完了時にレビュー実施
   - テストカバレッジ80%以上を維持
   - パフォーマンステストの実行

## 🎯 成功基準

### 必須要件
- [ ] 全テストがグリーン
- [ ] 循環参照ゼロ
- [ ] TypeScriptエラーゼロ
- [ ] Lintエラーゼロ
- [ ] セキュリティ脆弱性ゼロ（Critical/High）

### パフォーマンス目標
- [ ] バンドルサイズ20%削減
- [ ] 起動時間15%短縮
- [ ] メモリ使用量10%削減
- [ ] First Contentful Paint < 1.5秒
- [ ] Time to Interactive < 3秒

### 品質指標
- [ ] コードカバレッジ80%以上
- [ ] 複雑度スコア < 10（平均）
- [ ] 技術的負債比率 < 5%
- [ ] Mutation Score > 70%

## 🚀 追加の改善提案

### 1. **AI支援開発ツール**
```typescript
// tools/ai-assistant.ts
export const aiAssistant = {
  // コード生成支援
  generateBoilerplate: (type: 'entity' | 'usecase' | 'adapter') => {},
  
  // リファクタリング提案
  suggestRefactoring: (filePath: string) => {},
  
  // テスト生成
  generateTests: (targetFile: string) => {}
}
```

### 2. **自動ドキュメント生成**
```bash
# Phase 3で実行
npm run docs:generate -- --format markdown
npm run docs:architecture -- --output docs/architecture.md
npm run docs:api -- --output docs/api.md
```

### 3. **継続的な改善プロセス**
```yaml
# .github/workflows/continuous-improvement.yml
schedule:
  - cron: "0 0 * * MON" # 毎週月曜日

jobs:
  analyze:
    - dependency-updates
    - performance-regression
    - code-quality-trends
    - security-scanning
```

### 4. **エラー回復メカニズム**
```typescript
// src/shared/resilience/circuit-breaker.ts
export const createCircuitBreaker = <T>(
  service: () => Effect.Effect<T>,
  options: CircuitBreakerOptions
) => {
  // サービス障害時の自動回復
  // フォールバック処理
  // リトライ戦略
}
```

### 5. **開発者体験（DX）の向上**
```json
// .vscode/tasks.json
{
  "tasks": [
    {
      "label": "DDD Migration: Check Status",
      "command": "npm run migration:status"
    },
    {
      "label": "DDD Migration: Run Agent",
      "command": "npm run migration:agent -- --id ${input:agentId}"
    }
  ]
}
```

---

*最終更新: 2025-09-11*
*作成者: Claude (DDD Architecture Expert)*
