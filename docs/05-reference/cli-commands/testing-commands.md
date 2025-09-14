---
title: "テストコマンドリファレンス - Vitest CLI完全ガイド"
description: "Vitestベースのテスト実行、カバレッジ測定、ウォッチモードのCLIコマンド完全リファレンス。"
category: "reference"
difficulty: "beginner"
tags: ["testing", "vitest", "cli-commands", "coverage", "watch-mode"]
prerequisites: ["basic-typescript"]
estimated_reading_time: "8分"
dependencies: []
status: "complete"
---

# テストコマンド

テスト実行・カバレッジ測定・品質保証に関するCLIコマンドの完全リファレンスです。

## 📋 コマンド一覧

| コマンド | 用途 | 実行時間 | 説明 |
|---------|------|---------|------|
| `pnpm test` | 全テスト実行 | 5-15秒 | 全テストスイートの実行 |
| `pnpm test:watch` | ウォッチモード | 継続的 | ファイル変更を監視してテスト実行 |
| `pnpm test:coverage` | カバレッジ測定 | 8-20秒 | コードカバレッジレポート生成 |
| `pnpm test:ui` | テストUI起動 | 2-5秒 | ブラウザベースのテストUI |
| `pnpm test:run` | 単発実行 | 3-10秒 | ウォッチモードなしでテスト実行 |
| `pnpm test:unit` | 単体テスト | 3-8秒 | 単体テストのみ実行 |
| `pnpm test:integration` | 結合テスト | 10-30秒 | 結合テストのみ実行 |
| `pnpm test:e2e` | E2Eテスト | 30-120秒 | エンドツーエンドテスト実行 |

## 🧪 基本テストコマンド

### test（デフォルト）
全テストを実行します。

```bash
pnpm test
# または
pnpm test
```

**詳細仕様**:
- **テストランナー**: Vitest 3.2+
- **並列実行**: CPU コア数に基づく自動調整
- **ファイルパターン**: `**/*.{test,spec}.{ts,tsx}`
- **Environment**: jsdom（ブラウザ環境シミュレーション）

**実行結果例**:
```
✓ src/core/schema/position.test.ts (5)
✓ src/core/world/chunk.test.ts (12)
✓ src/domain/player/player.test.ts (8)
✓ src/infrastructure/renderer/three.test.ts (15)

Test Files  4 passed (4)
Tests  40 passed (40)
Duration  3.21s
```

**オプション**:
```bash
# 特定ファイルのテスト
pnpm test position.test.ts

# パターンマッチング
pnpm test -- --grep "Player"

# 詳細モード
pnpm test -- --verbose

# 失敗時の詳細表示
pnpm test -- --reporter=verbose
```

### test:watch
ファイル変更を監視してテストを自動実行します。

```bash
pnpm test:watch
```

**機能**:
- **ファイル監視**: ソースファイルとテストファイルの変更を検知
- **増分実行**: 変更されたファイルに関連するテストのみ実行
- **インタラクティブ**: キー操作でテスト制御

**キーボードショートカット**:
- `a` - 全テストを再実行
- `f` - 失敗したテストのみ再実行
- `o` - 変更されたファイルのテストのみ実行
- `p` - ファイル名パターンでフィルタ
- `t` - テスト名パターンでフィルタ
- `q` - ウォッチモード終了

### test:coverage
コードカバレッジを測定してレポートを生成します。

```bash
pnpm test:coverage
```

**カバレッジ指標**:
- **Statements**: 文カバレッジ
- **Branches**: 分岐カバレッジ
- **Functions**: 関数カバレッジ
- **Lines**: 行カバレッジ

**出力形式**:
```
File                     | % Stmts | % Branch | % Funcs | % Lines
-------------------------|---------|----------|---------|--------
src/core/schema/         |   95.12 |    88.46 |   94.73 |   95.12
src/core/world/          |   87.34 |    76.92 |   89.47 |   87.34
src/domain/player/       |   92.15 |    85.71 |   91.66 |   92.15
All files                |   91.54 |    83.69 |   91.95 |   91.54
```

**レポート生成**:
- **HTML**: `coverage/index.html`（詳細レポート）
- **JSON**: `coverage/coverage.json`（CI用）
- **LCOV**: `coverage/lcov.info`（外部ツール連携）

**オプション**:
```bash
# 特定ディレクトリのカバレッジ
pnpm test:coverage -- src/core/

# 最低カバレッジ閾値設定
pnpm test:coverage -- --coverage.threshold.statements 90

# レポーター指定
pnpm test:coverage -- --coverage.reporter=text-summary
```

### test:ui
ブラウザベースのテストUIを起動します。

```bash
pnpm test:ui
```

**機能**:
- **グラフィカルなテスト結果表示**
- **テストファイルの詳細表示**
- **リアルタイムでのテスト実行状況**
- **失敗したテストのスタックトレース表示**

**アクセス**: http://localhost:51204/__vitest__/

## 🎯 テストカテゴリ別コマンド

### test:unit
単体テストのみを実行します。

```bash
pnpm test:unit
```

**対象テスト**:
- Schema定義のテスト
- 純粋関数のテスト
- Effectベースのロジックテスト
- ドメインモデルのテスト

**ファイルパターン**: `**/*.unit.test.ts`

### test:integration
結合テストを実行します。

```bash
pnpm test:integration
```

**対象テスト**:
- サービス間連携のテスト
- データベース連携のテスト
- 外部API連携のテスト
- レンダリングパイプラインのテスト

**ファイルパターン**: `**/*.integration.test.ts`

**実行時間**: 10-30秒（外部依存関係含む）

### test:e2e
エンドツーエンドテストを実行します。

```bash
pnpm test:e2e
```

**対象テスト**:
- ユーザーシナリオの完全なテスト
- ブラウザ自動化によるテスト
- パフォーマンステスト
- 視覚的回帰テスト

**使用技術**: Playwright
**実行時間**: 30-120秒

## 🛠️ テスト環境設定

### Vitest設定

`vitest.config.ts`での基本設定:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts'
      ]
    }
  }
})
```

### テストセットアップ

`src/test/setup.ts`でのEffect-TS設定:
```typescript
import { Effect, Layer, TestContext } from 'effect'
import { beforeEach } from 'vitest'

// Effect-TSテスト用のコンテキスト設定
beforeEach(() => {
  return Effect.runSync(
    Effect.provide(
      Effect.unit,
      TestContext.TestContext
    )
  )
})
```

## 📊 テストデータとモック

### Schema-based テストデータ生成

```typescript
import { Schema } from '@effect/schema'
import { Arbitrary } from '@effect/schema/Arbitrary'

const PlayerSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  position: PositionSchema
})

// テストデータ生成
const generatePlayer = Arbitrary.make(PlayerSchema)
```

### Effect-TS モック

```typescript
import { Effect, Context, Layer } from 'effect'
import { vi } from 'vitest'

// サービスのモック実装
const MockWorldService = Layer.succeed(
  WorldService,
  WorldService.of({
    loadChunk: vi.fn().mockImplementation((coord) =>
      Effect.succeed(mockChunk)
    )
  })
)
```

## 🔍 テストデバッグ

### デバッグモードでのテスト実行

```bash
# Node.js デバッガー有効化
pnpm test -- --inspect-brk

# エディタのデバッガー統合
pnpm test:debug
```

### ログ出力制御

```bash
# 詳細ログ出力
DEBUG=true pnpm test

# 特定レベルのログのみ
LOG_LEVEL=error pnpm test

# テスト結果のJSON出力
pnpm test -- --reporter=json > test-results.json
```

## 📈 パフォーマンス最適化

### 並列実行調整

```bash
# ワーカー数指定
pnpm test -- --threads=4

# シーケンシャル実行（デバッグ時）
pnpm test -- --no-threads
```

### テスト分離

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    isolate: true,  // テスト間の完全分離
    pool: 'threads', // スレッドプールの使用
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4
      }
    }
  }
})
```

## 🚨 継続的インテグレーション

### CI用コマンド組み合わせ

```bash
# CI推奨実行パターン
pnpm test:coverage && pnpm test:e2e
```

### GitHub Actions設定例

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: pnpm test:coverage
      - run: pnpm test:e2e
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

## 🐛 トラブルシューティング

### よくある問題と解決策

#### テストがタイムアウトする
```bash
# タイムアウト時間延長
pnpm test -- --testTimeout=10000
```

#### メモリ不足エラー
```bash
# Node.jsメモリ制限増加
NODE_OPTIONS="--max-old-space-size=4096" pnpm test
```

#### Three.jsテストでのWebGL問題
```typescript
// テストファイルでのWebGLモック
import { vi } from 'vitest'

vi.mock('three', () => ({
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    render: vi.fn()
  }))
}))
```

#### Effect-TSテストでのContext問題
```typescript
// テスト用のContext提供
const testLayer = Layer.mergeAll(
  TestContext.TestContext,
  MockWorldService,
  MockPlayerService
)

const runTest = (effect: Effect.Effect<A, E, R>) =>
  Effect.runSync(Effect.provide(effect, testLayer))
```

## 📊 品質指標

### カバレッジ目標値

| レイヤー | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| Domain | ≥ 95% | ≥ 90% | ≥ 95% | ≥ 95% |
| Application | ≥ 85% | ≥ 80% | ≥ 85% | ≥ 85% |
| Infrastructure | ≥ 75% | ≥ 70% | ≥ 75% | ≥ 75% |
| Overall | ≥ 85% | ≥ 80% | ≥ 85% | ≥ 85% |

### テスト実行時間目標

| テストカテゴリ | 目標時間 | 許容時間 |
|---------------|---------|---------|
| Unit Tests | ≤ 5秒 | ≤ 10秒 |
| Integration Tests | ≤ 20秒 | ≤ 30秒 |
| E2E Tests | ≤ 60秒 | ≤ 120秒 |
| Full Suite | ≤ 30秒 | ≤ 60秒 |

## 🔗 関連リソース

- [Development Commands](./development-commands.md) - 開発コマンドとの連携
- [Configuration Reference](../configuration/vitest-config.md) - Vitest設定の詳細
- [Troubleshooting](../troubleshooting/test-failures.md) - テスト失敗時の対処法
- [API Reference](../api-reference/README.md) - テスト用API reference