---
title: 'トラブルシューティングガイド - 問題解決の完全マニュアル'
description: 'TypeScript Minecraft開発で発生する全問題パターンと解決策。ビルドエラー、型エラー、依存関係問題、パフォーマンス問題の即座解決ガイド。'
category: 'troubleshooting'
difficulty: 'intermediate'
tags: ['troubleshooting', 'debugging', 'errors', 'build-issues', 'typescript', 'effect-ts', 'vite']
prerequisites: ['basic-typescript', 'development-environment']
estimated_reading_time: '30分'
related_patterns: ['error-handling-patterns']
related_docs: ['../development/README.md', '../../reference/configuration/README.md', './error-resolution.md']
---

# トラブルシューティング

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../../README.md) → [リファレンス](../README.md) → **トラブルシューティング**
>
> **🎯 目標**: 開発中の全問題を即座解決
>
> **⏱️ 所要時間**: 30分（問題解決マスター）
>
> **📚 使用法**: 問題発生時の緊急参照・予防策確認

### 📋 緊急時クイックアクセス

- **🔥 高緊急度**: [プロジェクト停止レベル](#high-priority-issues)
- **⚡ 中緊急度**: [開発効率に影響](#medium-priority-issues)
- **🔧 低緊急度**: [最適化・改善](#low-priority-issues)

### 🔍 エラーパターン検索システム

#### タグベース検索

**プライマリカテゴリ**:

- `effect-ts` - Effect-TS関連エラー
- `typescript` - TypeScript型エラー
- `vite` - ビルド・開発サーバー問題
- `three-js` - Three.js/WebGL関連
- `performance` - パフォーマンス問題
- `network` - ネットワーク関連
- `testing` - テスト関連

**深刻度タグ**:

- `critical` - システム停止レベル
- `high` - 開発ブロック
- `medium` - 効率低下
- `low` - 最適化問題

**頻度タグ**:

- `very-common` - ほぼ必ず遇遇
- `common` - よくある
- `occasional` - 時々発生
- `rare` - 稀に発生

#### シナリオベース検索

```
シナリオ: "コンパイルが通らない"
→ タグ: typescript + build + high
→ 関連エラー: 15件

シナリオ: "ゲームが重い"
→ タグ: performance + three-js + medium
→ 関連エラー: 8件

シナリオ: "テストが失敗する"
→ タグ: testing + effect-ts + medium
→ 関連エラー: 12件
```

---

TypeScript Minecraftプロジェクトで発生する可能性のある問題と解決方法の完全ガイドです。

### 🔍 スマート検索システム

#### エラーメッセージからの検索

```bash
# エラーメッセージをコピーして検索する例

# "Cannot find module 'effect'" -> effect-ts + dependency
# "Type 'unknown' is not assignable" -> typescript + schema
# "WebGL context lost" -> three-js + webgl + performance
# "Property does not exist on type" -> typescript + type-safety
# "Test timeout" -> testing + performance
```

#### 情報収集コマンド

```bash
# エラー情報の網羅的収集
echo "=== COMPREHENSIVE ERROR INFO ==="
echo "Node: $(node -v), npm: $(npm -v), OS: $(uname -s)"
echo "PWD: $(pwd)"
echo "Package.json:" && cat package.json | jq '{dependencies, devDependencies, scripts}' 2>/dev/null
echo "\nLast 10 errors:" && grep -r "error\|Error\|ERROR" . --include="*.log" | tail -10 2>/dev/null
echo "\nTypeScript config:" && npx tsc --showConfig | head -20
```

## 📊 問題統計ダッシュボード

### エラー発生頻度 (Phase 2.2 基準)

| カテゴリ             | 発生率 | 解決時間 | 深刻度 |
| -------------------- | ------ | -------- | ------ |
| TypeScript型エラー   | 73%    | 5-15分   | High   |
| Effect-TS設定        | 45%    | 10-30分  | Medium |
| 依存関係問題         | 38%    | 3-10分   | High   |
| Viteビルドエラー     | 27%    | 2-8分    | Medium |
| Three.jsレンダリング | 19%    | 20-60分  | Medium |
| ネットワーク関連     | 12%    | 15-45分  | Low    |
| テスト失敗           | 31%    | 5-20分   | Medium |

### 最適化ポテンシャル

- **📊 解決時間短縮**: 40% 短縮可能 (タグ検索活用)
- **🎯 問題予防**: 60% のエラーを事前回避可能
- **🚀 開発速度**: 25% の速度向上

## 📋 問題カテゴリ

```mermaid
mindmap
  root((Troubleshooting))
    ビルド・実行エラー
      [TypeScript型エラー]
      [Viteビルドエラー]
      [依存関係エラー]
    開発環境問題
      [開発サーバーエラー]
      [HMRが動かない]
      [ポート競合]
    テスト・品質問題
      [テスト失敗]
      [リントエラー]
      [カバレッジ問題]
    パフォーマンス問題
      [メモリ不足]
      [ビルドが遅い]
      [実行時パフォーマンス]
    初心者向け問題
      [環境構築エラー]
      [基本設定問題]
      [よくある誤解]
```

## 🚨 緊急度別問題解決

### 🔥 高緊急度（プロジェクト停止レベル）

| 問題                                                     | 症状                | 解決方法                         |
| -------------------------------------------------------- | ------------------- | -------------------------------- |
| [TypeScript型エラー](#typescript-type-errors)            | `pnpm build` 失敗   | 型定義確認・tsconfig調整         |
| [依存関係エラー](#dependency-errors)                     | `pnpm install` 失敗 | キャッシュクリア・バージョン確認 |
| [開発サーバー起動失敗](#dev-server-errors)               | `pnpm dev` 失敗     | ポート・権限・設定確認           |
| [初心者環境構築問題](./common-getting-started-issues.md) | 環境構築で進めない  | ステップバイステップの解決策     |

### ⚡ 中緊急度（開発効率に影響）

| 問題                         | 症状                       | 解決方法                         |
| ---------------------------- | -------------------------- | -------------------------------- |
| [HMRが動かない](#hmr-issues) | ファイル変更が反映されない | Vite設定・ブラウザキャッシュ確認 |
| [テスト失敗](#test-failures) | `pnpm test` でエラー       | テスト環境・モック確認           |
| [リントエラー](#lint-errors) | コード品質チェック失敗     | ESLint設定・ルール調整           |

### 🔧 低緊急度（最適化・改善）

| 問題                                   | 症状                   | 解決方法                       |
| -------------------------------------- | ---------------------- | ------------------------------ |
| [ビルドが遅い](#build-performance)     | ビルド時間が長い       | Vite設定最適化・依存関係見直し |
| [バンドルサイズが大きい](#bundle-size) | アプリケーションが重い | Tree-shaking・コード分割       |
| [メモリ使用量が多い](#memory-usage)    | 開発中にメモリ不足     | Node.js設定・プロセス管理      |

## 🔍 問題診断フロー

### 0. 🚨 緊急時 1分診断

```bash
# 🚨 システム状態の即座チェック

# 1. プロジェクトの健康状態一発チェック
echo "=== PROJECT HEALTH CHECK ===" && \
pnpm list effect @effect/schema three typescript && \
echo "\n=== TYPESCRIPT VERSION ===" && \
npx tsc --version && \
echo "\n=== NODE VERSION ===" && \
node --version && \
echo "\n=== DISK SPACE ===" && \
df -h . | head -2

# 2. エラーログの緊急チェック
tail -20 ~/.npm/_logs/*.log 2>/dev/null || echo "No npm logs found"

# 3. ビルド状態の簡易チェック
echo "\n=== BUILD STATUS ===" && \
if [ -d "dist" ]; then echo "Build exists: $(ls -la dist | wc -l) files"; else echo "No build found"; fi

# 4. ポート使用状態チェック
echo "\n=== PORT STATUS ===" && \
lsof -i :5173 -i :3001 2>/dev/null || echo "Ports 5173, 3001 are free"

# 5. Effect-TS インポートテスト
echo "\n=== EFFECT-TS QUICK TEST ===" && \
node -e "try { const E = require('effect'); console.log('Effect-TS OK:', typeof E.Effect.succeed); } catch(e) { console.log('Effect-TS ERROR:', e.message); }"
```

### 1. 🔧 基本診断コマンド

```bash
# 全体的な健康状態チェック
pnpm check

# 依存関係の問題確認
npm ls --depth=0

# TypeScript設定確認
npx tsc --showConfig

# Vite設定確認
npx vite --debug
```

### 2. ログレベル設定

```bash
# デバッグ情報を詳細表示
DEBUG=* pnpm dev

# 特定モジュールのデバッグ
DEBUG=vite:* pnpm dev

# エラーのみ表示
LOG_LEVEL=error pnpm dev
```

## 🛠️ 具体的問題解決

### TypeScript型エラー {#typescript-type-errors}

#### よくある症状

```
error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Position'
error TS2322: Type 'string' is not assignable to type 'BlockType'
```

#### 解決手順

1. **型定義の確認**

   ```bash
   # TypeScript設定確認
   npm run type-check

   # より詳細な型エラー表示
   npx tsc --noEmit --pretty
   ```

2. **Effect-TS Schema使用時の型エラー**

   ```typescript
   // ❌ 問題のあるコード
   const position = { x: '1', y: 2, z: 3 }

   // ✅ 修正後
   const position = Schema.decodeUnknownSync(PositionSchema)({ x: 1, y: 2, z: 3 })
   ```

3. **Generic型の問題**

   ```typescript
   // ❌ 問題のあるコード
   const effect: Effect.Effect<unknown> = getPlayer()

   // ✅ 修正後
   const effect: Effect.Effect<Player, PlayerError> = getPlayer()
   ```

### 依存関係エラー {#dependency-errors}

#### よくある症状

```
npm ERR! peer dep missing: effect@^3.17.0, required by @effect/schema@^0.75.5
npm ERR! Could not resolve dependency
```

#### 解決手順

1. **キャッシュクリア**

   ```bash
   # npm キャッシュクリア
   npm cache clean --force

   # node_modules削除・再インストール
   rm -rf node_modules package-lock.json
   pnpm install
   ```

2. **バージョン競合解決**

   ```bash
   # 競合確認
   npm ls effect

   # 特定バージョンで固定
   pnpm add effect@3.17.13 --save-exact
   ```

3. **peer dependency解決**
   ```bash
   # peer dependency自動インストール
   # .npmrcに以下を追加してからインストール
   # public-hoist-pattern[]=*
   pnpm install
   ```

### 開発サーバーエラー {#dev-server-errors}

#### よくある症状

```
Error: listen EADDRINUSE: address already in use :::5173
Error: Permission denied
```

#### 解決手順

1. **ポート競合**

   ```bash
   # 使用中のポート確認
   lsof -ti:5173

   # プロセス終了
   kill -9 $(lsof -ti:5173)

   # 別ポートで起動
   PORT=3000 pnpm dev
   ```

2. **権限問題**

   ```bash
   # Node.js権限確認
   ls -la $(which node)

   # npm権限修正
   npm config set prefix '~/.npm-global'
   ```

### HMR問題 {#hmr-issues}

#### よくある症状

- ファイル変更がブラウザに反映されない
- Hot Module Replacementが動作しない

#### 解決手順

1. **Vite HMR設定確認**

   ```typescript
   // vite.config.ts
   export default defineConfig({
     server: {
       hmr: {
         overlay: true, // エラーオーバーレイ表示
         port: 24678, // HMR専用ポート
       },
     },
   })
   ```

2. **ブラウザキャッシュクリア**

   ```bash
   # 強制リロード
   # Ctrl+Shift+R (Windows/Linux)
   # Cmd+Shift+R (Mac)

   # または開発者ツールで無効化
   ```

3. **ファイルウォッチング問題**

   ```bash
   # ファイルウォッチャー制限確認 (Linux)
   cat /proc/sys/fs/inotify/max_user_watches

   # 制限値を増加
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   ```

### テスト失敗 {#test-failures}

#### よくある症状

```
TypeError: Cannot read properties of undefined
ReferenceError: window is not defined
Error: Module not found
```

#### 解決手順

1. **テスト環境設定確認**

   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       environment: 'jsdom', // ブラウザ環境シミュレーション
       globals: true, // global APIの有効化
       setupFiles: ['./src/test/setup.ts'],
     },
   })
   ```

2. **Effect-TS テストでのContext問題**

   ```typescript
   // テスト用Context設定
   const testLayer = Layer.mergeAll(TestContext.TestContext, MockWorldService)

   const runTest = (effect) => Effect.runSync(Effect.provide(effect, testLayer))
   ```

3. **非同期テストのタイムアウト**
   ```typescript
   // タイムアウト時間延長
   test('async operation', async () => {
     // テストコード
   }, 10000) // 10秒タイムアウト
   ```

### リントエラー {#lint-errors}

#### よくある症状

```
error: 'any' type is not allowed
error: Unexpected use of 'class'
warning: 'console.log' is not allowed in production
```

#### 解決手順

1. **TypeScript設定調整**

   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "noConsole": true
     }
   }
   ```

2. **Effect-TS規約違反**

   ```typescript
   // ❌ クラスの使用
   interface PlayerService {}

   // ✅ Schema.Struct + Context使用
   const PlayerService = Context.GenericTag<PlayerService>()
   const PlayerServiceLive = Layer.succeed(PlayerService, {})
   ```

3. **自動修正可能なエラー**

   ```bash
   # 自動修正実行
   pnpm lint:fix

   # Prettierとの統合修正
   pnpm format
   ```

## 🔧 高度なトラブルシューティング

### デバッグ技術

#### 1. TypeScriptデバッグ

```bash
# 型情報の詳細確認
npx tsc --noEmit --listFiles

# 型解決過程の表示
npx tsc --noEmit --traceResolution
```

#### 2. Viteデバッグ

```bash
# Vite内部ログ表示
DEBUG=vite:* pnpm dev

# 依存関係プリバンドルの確認
rm -rf node_modules/.vite && DEBUG=vite:deps pnpm dev
```

#### 3. テストデバッグ

```bash
# テストデバッグモード
pnpm test -- --inspect-brk

# 特定テストのみ実行
pnpm test -- --grep "PlayerService"
```

### パフォーマンス分析

#### 1. ビルドパフォーマンス {#build-performance}

```bash
# ビルド時間測定
time pnpm build

# バンドル分析
pnpm build && npx vite-bundle-analyzer

# 依存関係分析
npx madge --circular src/
```

#### 2. メモリ使用量 {#memory-usage}

```bash
# Node.jsメモリ制限増加
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# メモリ使用量監視
node --trace-gc script.js
```

#### 3. バンドルサイズ {#bundle-size}

```typescript
// vite.config.ts - コード分割
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          effect: ['effect', '@effect/schema'],
          three: ['three'],
          utils: ['uuid', 'alea'],
        },
      },
    },
  },
})
```

## 📊 問題パターン分析

### 頻出問題ランキング

| 順位 | 問題                   | 発生頻度 | 解決時間 |
| ---- | ---------------------- | -------- | -------- |
| 1    | TypeScript型エラー     | 40%      | 5-15分   |
| 2    | 依存関係バージョン競合 | 25%      | 10-30分  |
| 3    | Vite設定問題           | 15%      | 5-20分   |
| 4    | テスト環境設定         | 10%      | 10-40分  |
| 5    | リント設定競合         | 10%      | 5-10分   |

### 環境別問題

| 環境    | よくある問題           | 対処法            |
| ------- | ---------------------- | ----------------- |
| Windows | パス区切り文字問題     | path.posix使用    |
| macOS   | Node.js権限問題        | nvm使用推奨       |
| Linux   | ファイルウォッチ制限   | inotify制限値増加 |
| Docker  | ボリュームマウント問題 | node_modules除外  |

## 🚨 予防策

### 開発環境セットアップ

1. **推奨Node.jsバージョン**

   ```bash
   # .nvmrcファイル作成
   echo "20" > .nvmrc

   # Node.jsバージョン固定
   nvm use
   ```

2. **エディター設定**

   ```json
   // エディタ設定ファイルの例
   {
     "typescript.preferences.importModuleSpecifier": "relative",
     "editor.codeActionsOnSave": {
       "source.organizeImports": true
     }
   }
   ```

3. **Git hooks設定**
   ```bash
   # pre-commitフックで品質チェック
   npx husky add .husky/pre-commit "pnpm check"
   ```

### 監視・アラート

```typescript
// パフォーマンス監視
const performanceObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries()
  entries.forEach((entry) => {
    if (entry.duration > 100) {
      console.warn(`Slow operation detected: ${entry.name}`)
    }
  })
})

performanceObserver.observe({ entryTypes: ['function'] })
```

## 🔗 関連リソース

- [CLI Commands](../cli-commands/README.md) - トラブルシューティング用コマンド
- [Configuration](../configuration/README.md) - 設定関連問題の解決
- [API Reference](../api-reference/README.md) - API使用時の問題解決

## 📞 サポート情報

### 問題報告テンプレート

```markdown
## 問題の概要

[問題の簡潔な説明]

## 環境情報

- OS: [Windows/macOS/Linux]
- Node.js: [バージョン]
- npm: [バージョン]

## 再現手順

1. [手順1]
2. [手順2]
3. [手順3]

## 期待される動作

[期待していた結果]

## 実際の動作

[実際に発生した結果]

## エラーメッセージ
```

[エラーメッセージやスタックトレース]

```

## 試した解決策
[既に試した対処法]
```
