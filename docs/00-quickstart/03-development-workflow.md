---
title: "開発ワークフロー - 実践的開発環境構築"
description: "TypeScript Minecraft Clone開発のための包括的ワークフロー。コーディング→テスト→ビルド→デバッグの開発サイクル完全ガイド"
category: "quickstart"
difficulty: "intermediate"
tags: ["development-workflow", "vite", "testing", "debugging", "typescript", "effect-ts"]
prerequisites: ["01-5min-demo", "02-architecture-overview", "typescript-basics"]
estimated_reading_time: "5分"
last_updated: "2024-09-14"
version: "1.0.0"
learning_path: "Level 0 - Step 3"
search_keywords:
  primary: ["development-workflow", "typescript-development", "vite-configuration"]
  secondary: ["testing-strategy", "debugging-techniques", "build-process"]
  context: ["minecraft-development", "effect-ts-workflow", "web-development"]
---

# ⚡ 開発ワークフロー - 生産性最大化への道

## 🧭 ナビゲーション

> **📍 現在位置**: [Quickstart Hub](./README.md) → **Step 3: 開発フロー習得**
> **🎯 目標**: 効率的な開発環境構築と基本ワークフローの習得
> **⏱️ 所要時間**: 5分
> **📝 前提**: [アーキテクチャ理解](./02-architecture-overview.md)完了
> **📚 継続**: [重要概念整理](./04-key-concepts.md)

## 🔄 Progressive Development Cycle

### 🎯 Quick Reference - 開発フロー

```bash
# 基本サイクル（30秒で1周）
pnpm dev → コード編集 → 自動リロード → 動作確認 → 繰り返し

# 品質保証サイクル（5分で1周）
pnpm test → pnpm type-check → pnpm lint → pnpm build → 確認
```

<details>
<summary><strong>🔄 詳細開発サイクルと実行可能コマンド</strong></summary>

### 🎯 TypeScript Minecraft 開発の標準フロー

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
graph TD
    A[💻 コーディング<br/>エディタ + TypeScript] --> B[🔄 自動リロード<br/>Vite HMR]
    B --> C[🧪 テスト実行<br/>vitest --watch]
    C --> D[🔧 型チェック<br/>tsc --noEmit]
    D --> E[🚀 ローカル確認<br/>http://localhost:5173]
    E --> F[🏗️ ビルド検証<br/>pnpm build]
    F --> G[📦 プロダクション確認<br/>pnpm preview]

    G --> A

    H[🐛 バグ発見] --> I[🔍 デバッグ<br/>Chrome DevTools]
    I --> J[🔧 修正<br/>Effect.log + コード修正]
    J --> B

    C -.->|テスト失敗| H
    E -.->|動作問題| H

    classDef develop fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef test fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef debug fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef build fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class A,B,E develop
    class C,D test
    class H,I,J debug
    class F,G build
```

### ⚡ 実行可能コマンド一覧

#### 🏃‍♂️ **開発用コマンド**（日常業務）

```bash
# 開発サーバー起動（最も頻繁に使用）
pnpm dev
# ポート指定版
pnpm dev --port 3000
# ネットワーク公開版
pnpm dev --host

# 監視モード付きテスト（バックグラウンド実行推奨）
pnpm test --watch
# UI付きテスト（ブラウザで結果確認）
pnpm test --ui

# リアルタイム型チェック（エディタの拡張機能と併用）
pnpm type-check --watch

# 自動修正付きLinting
pnpm lint --fix
```

#### 🔍 **品質保証コマンド**（コミット前必須）

```bash
# 完全品質チェックシーケンス（5分）
pnpm type-check && pnpm lint && pnpm test && pnpm build
# 1行版
pnpm run quality-check

# カバレッジ付きテスト
pnpm test --coverage --reporter=verbose
# 期待出力例:
# Test Files  42 passed (42)
# Tests       156 passed (156)
# Coverage    85.4% Statements
```

#### 🚀 **デプロイ用コマンド**（本番環境）

```bash
# 本番ビルド
pnpm build
# 期待出力例:
# vite v5.4.8 building for production...
# ✓ 247 modules transformed.
# dist/index.html                   0.46 kB │ gzip:  0.30 kB
# dist/assets/index-Cqk_tL8N.css   45.2 kB │ gzip:  8.1 kB
# dist/assets/index-DRjX8VHj.js   890.5 kB │ gzip: 284.2 kB

# ビルド結果の確認
pnpm preview
# プレビューサーバー起動: http://localhost:4173

# ビルドサイズ分析
pnpm build --report
# Bundle analyzer で依存関係可視化
```

### 🎯 実際の開発セッション例

#### 📝 **Feature開発の典型的な流れ**

```bash
# 1. 機能ブランチ作成・移動
git checkout -b feature/inventory-system
git status

# 2. 開発環境起動（バックグラウンド）
pnpm dev &
# または別ターミナルで: pnpm dev

# 3. テスト監視開始（バックグラウンド）
pnpm test --watch &

# 4. ファイル編集（お好みのエディタで）
# 例: src/domain/inventory/

# 5. リアルタイム確認
# - ブラウザ: http://localhost:5173
# - テスト結果: ターミナル監視
# - 型エラー: エディタのインライン表示

# 6. コミット前品質チェック
pnpm type-check && pnpm lint && pnpm build
# 成功時のみコミット
git add -A && git commit -m "feat(inventory): add item stack management"
```

### 🚨 **エラーハンドリング実践例**

#### ⚠️ TypeScript型エラー対処

```bash
# 型エラー詳細確認
pnpm type-check
# 出力例:
# src/domain/player/Player.ts:23:5 - error TS2322: Type 'string' is not assignable to type 'PlayerId'.
# 23     id: "player-1",
#        ~~~

# 修正後確認
pnpm type-check --watch
# ファイル保存時に自動チェック
```

#### 🧪 テストエラー対処

```bash
# 失敗テスト詳細確認
pnpm test --run --reporter=verbose
# 出力例:
# FAIL src/domain/block/Block.test.ts > Block creation > should create stone block
#   Expected: "stone"
#   Received: "dirt"

# デバッグモードでテスト
pnpm test --run --debug src/domain/block/Block.test.ts
```

#### 🏗️ ビルドエラー対処

```bash
# ビルドエラー詳細確認
pnpm build --verbose
# 出力例:
# [ERROR] Could not resolve "src/utils/missing-file.ts"

# 依存関係確認
pnpm list --depth=0
pnpm why some-package-name

# キャッシュクリア後再試行
rm -rf dist node_modules && pnpm install && pnpm build
```

</details>

## 💻 開発環境の完全セットアップ

### 🛠️ 推奨開発ツール構成

```typescript
interface OptimalDevEnvironment {
  // 必須ツール
  essential: {
    runtime: "Node.js 18+"
    packageManager: "pnpm" | "npm" | "yarn"
    browser: "Chrome" | "Firefox" | "Safari"
  }

  // 開発用ブラウザ拡張
  browserExtensions: [
    "React Developer Tools",
    "Redux DevTools",
    "Web Developer"
  ]
}
```

### ⚙️ 開発サーバー起動とホットリロード

```bash
# 開発サーバー起動（推奨）
pnpm dev

# 実行結果例
# VITE v7.1.5  ready in 1200 ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose

# ファイル変更時の自動リロード確認
# ✅ src/配下の.tsファイル変更 → 即座反映
# ✅ CSS/スタイル変更 → 即座反映
# ✅ 設定ファイル変更 → サーバー再起動
```

## 🧪 テスト駆動開発 (TDD) フロー

### 🎯 テスト戦略概観

```mermaid
graph TD
    A[📝 要件定義] --> B[🧪 テスト作成]
    B --> C[🔴 レッドフェーズ<br/>テスト失敗確認]
    C --> D[💻 実装作成]
    D --> E[🟢 グリーンフェーズ<br/>テスト成功確認]
    E --> F[🔄 リファクタリング]
    F --> G[🧪 テスト再実行]

    G --> H{すべて通過？}
    H -->|Yes| I[✅ 機能完成]
    H -->|No| J[🔧 修正]
    J --> G

    I --> K[📚 ドキュメント更新]

    classDef phase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef red fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef green fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef refactor fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class A,B,D,K phase
    class C red
    class E green
    class F,G,J refactor
```

### 🏃‍♂️ テスト実行コマンド集

```bash
# 全テスト実行
pnpm test

# 監視モード（ファイル変更時自動実行）
pnpm test --watch

# カバレッジレポート付き実行
pnpm test --coverage

# 特定ファイルのみテスト
pnpm test src/domain/block/Block.test.ts

# UIモードでテスト実行（ブラウザ表示）
pnpm test --ui
```

### 📝 Effect-TS テストパターン例

```typescript
// src/domain/block/Block.test.ts
import { Effect, TestClock, TestRandom } from "@effect/platform"
import { describe, it, expect } from "vitest"

describe("Block Domain Logic", () => {
  it("should break block with correct tool in expected time", () => {
    const program = Effect.gen(function* (_) {
      // テスト用依存性注入
      const block = createStoneBlock()
      const pickaxe = createDiamondPickaxe()

      // ブロック破壊実行
      const result = yield* _(breakBlock(block, pickaxe))

      // 結果検証
      expect(result.breakTime).toEqual(1500) // ms
      expect(result.drops).toContain(Items.COBBLESTONE)
      expect(result.experience).toBeGreaterThan(0)
    })

    // Effect を同期的にテスト実行
    Effect.runSync(
      program.pipe(
        Effect.provide(TestRandom.deterministic),
        Effect.provide(TestClock.make())
      )
    )
  })
})
```

## 🔍 デバッグ戦略とツール

### 🛠️ 主要デバッグ手法

```mermaid
flowchart TD
    A[🐛 バグ発見] --> B{バグの種類}

    B --> C[🎨 レンダリング問題]
    B --> D[⚡ パフォーマンス問題]
    B --> E[🔧 ロジック問題]
    B --> F[🌐 ネットワーク問題]

    C --> C1[Chrome DevTools<br/>Elements/Canvas検査]
    D --> D1[Performance Tab<br/>Memory Usage確認]
    E --> E1[Console.log<br/>Effect.log活用]
    F --> F1[Network Tab<br/>Request確認]

    C1 --> G[🔧 修正]
    D1 --> G
    E1 --> G
    F1 --> G

    G --> H[✅ 再テスト]

    classDef bug fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef debug fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef fix fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px

    class A bug
    class C,D,E,F,C1,D1,E1,F1 debug
    class G,H fix
```

### 🔧 効果的なデバッグテクニック

#### 1️⃣ **Effect-TS ログ活用**

```typescript
// デバッグ用ログの追加
export const processPlayerMovement = (
  input: PlayerInput,
  currentPosition: Position3D
): Effect.Effect<Position3D, MovementError> =>
  Effect.gen(function* (_) {
    // デバッグログ
    yield* _(Effect.log(`Input received: ${JSON.stringify(input)}`))
    yield* _(Effect.log(`Current position: ${formatPosition(currentPosition)}`))

    const newPosition = yield* _(calculateNewPosition(input, currentPosition))

    // 結果ログ
    yield* _(Effect.log(`New position: ${formatPosition(newPosition)}`))

    return newPosition
  })
```

#### 2️⃣ **ブラウザ DevTools 活用**

```bash
# Console での Effect デバッグ
# 1. F12 でDevTools起動
# 2. Console タブ選択
# 3. 以下コマンドでゲーム状態確認

# グローバル変数アクセス（開発時のみ）
window.gameEngine.getCurrentWorld()
window.gameEngine.getPlayerState()
window.gameEngine.getEntityCount()
```

#### 3️⃣ **パフォーマンス分析**

```typescript
// Performance測定の組み込み
export const renderFrame = Effect.gen(function* (_) {
  const start = performance.now()

  yield* _(clearCanvas)
  yield* _(renderEntities)
  yield* _(renderUI)

  const end = performance.now()

  // フレーム時間が長い場合はログ出力
  if (end - start > 16.67) { // 60FPSを下回る場合
    yield* _(Effect.log(`Slow frame: ${end - start}ms`))
  }
})
```

## 🏗️ ビルドプロセスと最適化

### 📦 本番ビルドの実行

```bash
# 型チェック実行
pnpm type-check

# Linting実行
pnpm lint

# テスト実行
pnpm test

# 本番ビルド
pnpm build

# ビルド結果確認
ls -la dist/
# 期待される出力:
# index.html         - エントリーポイント
# assets/index-*.js   - バンドルされたJavaScript
# assets/index-*.css  - 統合されたCSS
# texture/           - ゲーム用テクスチャ
```

### ⚡ 開発効率化のスクリプト

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix",
    "format": "prettier --write .",
    "clean": "rm -rf dist node_modules",
    "reset": "pnpm clean && pnpm install"
  }
}
```

## 🔄 Git ワークフロー（推奨）

### 🌿 ブランチ戦略

```mermaid
gitgraph
    commit id: "Initial"
    branch feature/block-system
    checkout feature/block-system
    commit id: "Add Block entity"
    commit id: "Implement break logic"
    commit id: "Add tests"
    checkout main
    merge feature/block-system
    commit id: "Release v1.1.0"

    branch feature/player-system
    checkout feature/player-system
    commit id: "Add Player entity"
    commit id: "Movement system"
    checkout main
    merge feature/player-system
```

### 📝 コミット規約

```bash
# コミットメッセージ規約
feat: 新機能追加
fix: バグ修正
docs: ドキュメント変更
style: コードスタイル変更
refactor: リファクタリング
test: テスト追加・修正
chore: ビルド・補助ツール変更

# 例
git commit -m "feat(block): add block break animation system"
git commit -m "fix(player): resolve movement collision detection"
git commit -m "test(world): add world generation test cases"
```

## ✅ 5分習得チェックリスト

### 🎯 開発フロー理解度確認

#### 💻 **開発環境**
- [ ] **開発サーバー**: `pnpm dev`でローカル開発可能
- [ ] **ホットリロード**: ファイル変更で自動反映確認
- [ ] **DevTools**: F12でブラウザデバッグツール活用

#### 🧪 **テスト環境**
- [ ] **テスト実行**: `pnpm test`でテスト実行可能
- [ ] **TDD理解**: Red→Green→Refactorサイクル理解
- [ ] **Effect-TSテスト**: 非同期処理のテスト方法理解

#### 🔧 **デバッグ技術**
- [ ] **ログ出力**: Effect.logでデバッグ情報出力
- [ ] **パフォーマンス**: Performance Tabでボトルネック特定
- [ ] **ネットワーク**: Network Tabでリクエスト確認

#### 🏗️ **ビルドプロセス**
- [ ] **型チェック**: TypeScriptエラー確認・修正
- [ ] **本番ビルド**: `pnpm build`で本番用ファイル生成
- [ ] **品質確保**: lint + test + buildの一連フロー理解

## 🎊 実践演習：簡単な機能追加

### 🎯 チャレンジ：新しいブロックタイプ追加

```typescript
// 課題：GoldBlockを追加してみよう
// 1. ドメインモデル定義
export interface GoldBlock extends Block {
  readonly material: "gold"
  readonly hardness: 3.0
  readonly drops: ReadonlyArray<ItemStack>
}

// 2. テスト作成
describe("GoldBlock", () => {
  it("should drop gold ingot when broken with correct tool", () => {
    // テストコード実装
  })
})

// 3. 実装
export const createGoldBlock = (position: Position3D): GoldBlock => ({
  // 実装コード
})

// 4. テスト実行・確認
// pnpm test src/domain/blocks/GoldBlock.test.ts

// 5. ゲーム内確認
// pnpm dev でゲーム起動し、動作確認
```

## 🔗 次のステップ

### 🎉 開発フロー習得完了！

```typescript
interface DevelopmentWorkflowMastery {
  environment: {
    devServerSetup: true
    hotReloadWorking: true
    debugToolsConfigured: true
  }

  testing: {
    testRunning: true
    tddUnderstanding: true
    effectTSTestPatterns: true
  }

  workflow: {
    codeEditBuildCycle: true
    debuggingStrategies: true
    gitWorkflowKnowledge: true
  }

  readyFor: "重要概念の整理と実践的開発"
}
```

### 🚀 推奨継続パス

1. **🧠 概念整理**: [Step 4: Key Concepts](./04-key-concepts.md) - Effect-TS重要パターン習得
2. **📚 詳細学習**: [Development Guides](../03-guides/README.md) - 具体的実装テクニック
3. **🏗️ 実践開発**: [Examples](../06-examples/README.md) - 実際のコード例で学習

### 🎯 さらなる学習リソース

- **🛠️ 開発規約**: [Development Conventions](../03-guides/00-development-conventions.md)
- **🧪 テスト戦略**: [Testing Guide](../03-guides/02-testing-guide.md)
- **🐛 エラー解決**: [Error Resolution](../03-guides/04-error-resolution.md)

---

### 🎊 **おめでとうございます！開発ワークフローを習得しました**

**効率的な開発環境とプロセスを理解し、実際にコードを書いてテストする準備が整いました。次は重要概念を整理して、本格的な開発に進みましょう！**

---

*📍 ドキュメント階層*: **[Home](../../README.md)** → **[Quickstart Hub](./README.md)** → **Step 3: 開発フロー習得**