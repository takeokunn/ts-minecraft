# TypeScript Minecraft - 開発ツール

このプロジェクトには、開発効率を向上させるための包括的な開発ツールセットが含まれています。

## 📋 実装済み開発ツール一覧

### 1. ゲームデバッガー (`GameDebugger`)
- **機能**: パフォーマンス情報のオーバーレイ表示
- **ショートカット**: `F12`
- **表示情報**:
  - FPS (Frames Per Second)
  - フレーム時間
  - メモリ使用量
  - エンティティ数
  - 描画コール数
  - 三角形数

### 2. 開発者コンソール (`DevConsole`)
- **機能**: ゲーム内コマンドの実行
- **ショートカット**: `Ctrl+Shift+D`
- **利用可能コマンド**:
  - `help` - コマンド一覧表示
  - `clear` - コンソール出力クリア
  - `spawn <entityType> [x] [y] [z]` - エンティティスポーン
  - `tp <x> <y> <z>` - プレイヤーテレポート
  - `time <value>` - ワールド時間設定
  - `perf` - パフォーマンス統計表示
  - `debug <on|off>` - デバッグモード切り替え
  - `inspect <entityId>` - エンティティ詳細表示
  - `world <save|load|reset>` - ワールド操作

### 3. エンティティインスペクター (`EntityInspector`)
- **機能**: エンティティの詳細表示と編集
- **ショートカット**: `Ctrl+Shift+I`
- **機能**:
  - エンティティリスト表示
  - コンポーネント詳細表示
  - エンティティ検索とフィルタリング
  - リアルタイム更新（1秒間隔）
  - エンティティの削除・無効化・クローン

### 4. パフォーマンスプロファイラー (`PerformanceProfiler`)
- **機能**: 詳細なパフォーマンス分析
- **ショートカット**: `Ctrl+Shift+P`
- **機能**:
  - リアルタイムFPSグラフ
  - フレーム時間グラフ
  - パフォーマンス記録と分析
  - メモリ使用量監視
  - データエクスポート機能

### 5. ワールドエディタ (`WorldEditor`)
- **機能**: ワールド編集機能
- **ショートカット**: `Ctrl+Shift+W`
- **機能**:
  - ブロック配置・削除・置換
  - アンドゥ・リドゥ機能
  - エリア塗りつぶし
  - 編集履歴管理
  - ワールドデータエクスポート

### 6. ネットワークインスペクター (`NetworkInspector`)
- **機能**: ネットワーク通信の監視
- **ショートカット**: `Ctrl+Shift+N`
- **機能**:
  - HTTP リクエスト/レスポンス監視
  - WebSocket 通信監視
  - リクエスト詳細表示
  - パフォーマンス分析
  - データエクスポート

## 🚀 使用方法

### 基本的な使用方法

```typescript
import { DevToolsManager, getDevToolsConfig } from './src/dev-tools'
import { World } from './src/core/entities/entity'

// ゲーム初期化時
const world = new World()
const devTools = new DevToolsManager(world, getDevToolsConfig())

// ゲームループ内
function gameLoop(deltaTime: number) {
  // ... ゲームロジック ...
  
  // 開発ツールの更新
  devTools.update(deltaTime)
}
```

### カスタム設定

```typescript
import { DevToolsManager } from './src/dev-tools'

const customConfig = {
  enableDebugger: true,
  enablePerformanceProfiler: true,
  enableDevConsole: false,
  enableEntityInspector: false,
  enableWorldEditor: false,
  enableNetworkInspector: true,
  autoStart: false,
  showWelcome: true
}

const devTools = new DevToolsManager(world, customConfig)
```

## ⌨️ キーボードショートカット

| ショートカット | 機能 |
|---------------|-----|
| `F12` | デバッガーオーバーレイの表示/非表示 |
| `Ctrl+Shift+D` | 開発者コンソールの開閉 |
| `Ctrl+Shift+I` | エンティティインスペクターの開閉 |
| `Ctrl+Shift+W` | ワールドエディタの開閉 |
| `Ctrl+Shift+N` | ネットワークインスペクターの開閉 |
| `Ctrl+Shift+P` | パフォーマンスプロファイラーの切り替え |
| `ESC` | 開いているツールを閉じる |

### コンソール内ショートカット

| キー | 機能 |
|-----|-----|
| `↑` / `↓` | コマンド履歴の移動 |
| `Tab` | コマンドの自動補完 |
| `Enter` | コマンド実行 |
| `ESC` | コンソールを閉じる |

### ワールドエディタ内ショートカット

| キー | 機能 |
|-----|-----|
| `Ctrl+Z` | アンドゥ |
| `Ctrl+Y` | リドゥ |
| `Left Click` | 選択したツールを使用 |
| `Shift+Click` | 複数選択 |

## 📊 パフォーマンス分析

### パフォーマンス記録の開始

```typescript
// 記録開始
devTools.startPerformanceRecording()

// ゲームプレイ...

// 記録停止と分析
const performanceData = devTools.stopPerformanceRecording()
console.log(performanceData)
```

### 統計情報の取得

```typescript
const stats = devTools.getStats()
console.log('開発ツール統計:', stats)
```

## 🔧 npm scripts

### 開発用コマンド

```bash
# 基本開発サーバー
npm run dev

# プロファイルモードで開発
npm run dev:profile

# デバッグモードで開発
npm run dev:debug

# テスト (UI付き)
npm run test:watch

# パフォーマンス測定
npm run perf

# バンドル分析
npm run build:analyze

# 依存関係分析
npm run analyze:deps

# デバッグ用Inspector
npm run inspect
```

## 🛠️ 設定オプション

### DevToolsConfig

```typescript
interface DevToolsConfig {
  enableDebugger: boolean          // デバッガーオーバーレイ
  enablePerformanceProfiler: boolean // パフォーマンスプロファイラー
  enableDevConsole: boolean        // 開発者コンソール
  enableEntityInspector: boolean   // エンティティインスペクター
  enableWorldEditor: boolean       // ワールドエディタ
  enableNetworkInspector: boolean  // ネットワークインスペクター
  autoStart: boolean              // 自動開始
  showWelcome: boolean           // ウェルカムメッセージ表示
}
```

### 環境別設定

- **development**: 全ツール有効
- **profile**: 一部ツールのみ有効（パフォーマンス重視）
- **production**: 全ツール無効

## 💾 データエクスポート

### 全データの一括エクスポート

```typescript
const allData = devTools.exportAllData()
// JSON形式でダウンロードまたはローカルストレージに保存
```

### 個別データのエクスポート

```typescript
// パフォーマンスデータ
const perfData = devTools.performanceProfiler?.exportPerformanceData()

// ネットワークデータ
const networkData = devTools.networkInspector?.getNetworkSummary()
```

## 🚨 注意事項

1. **開発環境でのみ有効**: `import.meta.env.DEV` が `true` の場合のみ動作
2. **パフォーマンスへの影響**: 本番環境では自動的に無効化される
3. **メモリ使用量**: 大量のデータを記録するため、メモリ使用量に注意
4. **ブラウザサポート**: モダンブラウザが必要（ES2020+）

## 🔍 トラブルシューティング

### よくある問題

1. **ツールが表示されない**
   - 開発環境で実行しているか確認
   - `import.meta.env.DEV` が `true` になっているか確認

2. **パフォーマンスが悪い**
   - プロファイルモード（`npm run dev:profile`）を使用
   - 不要なツールを無効化

3. **キーボードショートカットが効かない**
   - 他のブラウザ拡張機能との競合を確認
   - フォーカスがゲームエリアにあるか確認

### ログ出力

開発ツールは以下の形式でログを出力します：

```
🔧 Development Tools enabled
🖥️ Dev Console opened
🔍 Entity Inspector opened
📊 Performance recording started
```

## 📝 今後の拡張予定

- [ ] シェーダーエディタ
- [ ] アニメーションエディタ
- [ ] サウンドミキサー
- [ ] プロファイリング結果の可視化改善
- [ ] リモートデバッグ機能
- [ ] プラグインシステム

---

開発ツールに関する質問や改善提案がある場合は、プロジェクトのIssueに報告してください。