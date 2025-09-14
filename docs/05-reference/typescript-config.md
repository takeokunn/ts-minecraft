# TypeScript設定リファレンス

## 概要

ts-minecraftプロジェクトは最新のTypeScript 5.9+機能を活用し、厳格な型チェックとモダンなJavaScript機能を組み合わせた設定を採用しています。この設定は、Viteビルドツール、Effect-TS関数型プログラミング、Three.jsによる3Dレンダリングに最適化されています。

## コンパイラオプション詳細

### 基本設定

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "lib": ["DOM", "DOM.Iterable", "WebWorker", "ES2015", "ES2017", "ES2018", "ES2019", "ES2020", "ES2021", "ES2022", "ESNext", "ESNext.SharedMemory"]
}
```

- **target: "ES2022"**: 出力するJavaScriptの仕様。ES2022の新機能（Top-level await、Private fields等）を活用
- **module: "ESNext"**: ESモジュールの最新仕様を使用。Viteとの親和性が高い
- **lib配列**: 使用可能なAPI群を明示的に指定
  - `DOM`, `DOM.Iterable`: ブラウザDOM API
  - `WebWorker`: Web Worker APIサポート
  - `ESNext.SharedMemory`: SharedArrayBufferサポート（高性能計算用）

### モジュール解決設定

```json
{
  "moduleResolution": "bundler",
  "allowImportingTsExtensions": true,
  "resolveJsonModule": true,
  "isolatedModules": true,
  "noEmit": true
}
```

- **moduleResolution: "bundler"**: Vite等のモダンバンドラー向け解決戦略
- **allowImportingTsExtensions**: `.ts`拡張子付きインポートを許可
- **resolveJsonModule**: JSON直接インポートサポート
- **isolatedModules**: 各ファイルを独立してトランスパイル可能にする
- **noEmit**: TypeScriptコンパイラは型チェックのみ実行（ビルドはViteが担当）

### 互換性設定

```json
{
  "useDefineForClassFields": false,
  "skipLibCheck": true,
  "allowSyntheticDefaultImports": true,
  "forceConsistentCasingInFileNames": true
}
```

- **useDefineForClassFields: false**: Three.jsとの互換性を保持
- **skipLibCheck**: 外部ライブラリの型定義チェックをスキップ（ビルド速度向上）
- **allowSyntheticDefaultImports**: CommonJSモジュールのdefaultインポートを許可
- **forceConsistentCasingInFileNames**: ファイル名の大文字小文字を厳密チェック

## パス設定とエイリアス

```json
{
  "baseUrl": ".",
  "paths": {
    "@test/*": ["test/*"],
    "@domain/*": ["src/domain/*"],
    "@application/*": ["src/application/*"],
    "@infrastructure/*": ["src/infrastructure/*"],
    "@presentation/*": ["src/presentation/*"],
    "@shared/*": ["src/shared/*"],
    "@config/*": ["src/config/*"]
  }
}
```

### エイリアス設計理念

- **@domain**: ドメイン層（ビジネスロジック・エンティティ）
- **@application**: アプリケーション層（ユースケース・サービス）
- **@infrastructure**: インフラ層（データアクセス・外部API）
- **@presentation**: プレゼンテーション層（UI・コントローラー）
- **@shared**: 横断的関心事（ユーティリティ・共通型）
- **@config**: 設定関連
- **@test**: テスト関連

### 使用例

```typescript
// レイヤー間の依存関係が明確
import { Player } from '@domain/entities/Player'
import { PlayerService } from '@application/services/PlayerService'
import { PlayerRepository } from '@infrastructure/repositories/PlayerRepository'
import { GameConfig } from '@config/GameConfig'
```

## 厳格性設定の解説

### Strict Mode設定群

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitThis": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true
}
```

#### strict: true
全ての厳格チェックを有効化。以下の個別設定は明示的に記述（設定の可視化）。

#### noImplicitAny: true
型推論できない場合のany型を禁止。

```typescript
// ❌ エラー: Parameter 'x' implicitly has an 'any' type
function process(x) { return x }

// ✅ 正しい
function process(x: unknown) { return x }
```

#### strictNullChecks: true
null/undefinedの厳密チェック。Optional chainingと組み合わせて安全性を確保。

```typescript
// ❌ エラー: Object is possibly 'null'
const player: Player | null = getPlayer()
player.move()

// ✅ 正しい
const player: Player | null = getPlayer()
player?.move()
```

### 追加の厳格性オプション

```json
{
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitOverride": true,
  "noUncheckedIndexedAccess": true
}
```

#### exactOptionalPropertyTypes: true
オプショナルプロパティの型を厳密化。

```typescript
interface Config {
  debug?: boolean
}

const config: Config = { debug: undefined } // ❌ エラー
const config: Config = {} // ✅ 正しい
```

#### noUncheckedIndexedAccess: true
配列・オブジェクトアクセスの安全性を強化。

```typescript
const items: string[] = ['a', 'b']
const item = items[10] // string | undefined型として推論
```

### コード品質設定

```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "noImplicitReturns": true
}
```

これらの設定により、デッドコードの削除とバグの早期発見を実現。

## 型定義ファイルの管理

```json
{
  "types": ["vite/client", "@webgpu/types"]
}
```

### 組み込み型定義

- **vite/client**: Vite固有のグローバル変数・環境変数
- **@webgpu/types**: WebGPU API（将来の高性能レンダリング用）

### カスタム型定義の配置

プロジェクト固有の型定義は以下に配置：

```
src/
├── types/
│   ├── global.d.ts      // グローバル型定義
│   ├── modules.d.ts     // サードパーティモジュール拡張
│   └── game-engine.d.ts // ゲームエンジン固有型
```

## 推奨エディタ設定

### TypeScript言語サーバー設定例

多くのエディタで以下のようなTypeScript設定が可能です：

```json
{
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.suggest.paths": true,
  "typescript.workspaceSymbols.scope": "allOpenProjects",
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.parameterTypes.enabled": true,
  "typescript.inlayHints.variableTypes.enabled": true,
  "typescript.inlayHints.propertyDeclarationTypes.enabled": true,
  "typescript.inlayHints.functionLikeReturnTypes.enabled": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit",
    "source.fixAll": "explicit"
  },
  "files.exclude": {
    "**/*.js.map": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

### 推奨エディタ拡張機能

TypeScript開発に役立つ拡張機能やプラグイン：
- TypeScript言語サーバー拡張
- Tailwind CSS拡張
- Prettierフォーマッター
- JSON言語サポート

お使いのエディタのマーケットプレイスやプラグインリポジトリから検索してください。

## トラブルシューティング

### よくある問題と解決策

#### 1. パスエイリアスが解決されない

**症状**: `@domain/*`等のインポートでモジュールが見つからない

**解決策**:
```bash
# vite-tsconfig-pathsプラグインの確認
npm ls vite-tsconfig-paths

# Vite設定の確認
# vite.config.tsでtsconfigPathsプラグインが有効か確認
```

#### 2. Three.js型エラー

**症状**: Three.jsクラス継承で型エラーが発生

**解決策**:
```json
// tsconfig.jsonで設定済み
{
  "useDefineForClassFields": false
}
```

#### 3. WebGPU型が見つからない

**症状**: WebGPU APIの型定義がない

**解決策**:
```bash
# 型定義パッケージのインストール確認
npm ls @webgpu/types

# tsconfig.jsonのtypes配列に追加済みか確認
```

#### 4. Effect-TSの型推論エラー

**症状**: Effect.gen内で型推論が正しく働かない

**解決策**:
```typescript
// 明示的な型注釈を追加
const effect = Effect.gen(function* (): Effect.Effect<Result, Error, Context> {
  // ...
})
```

#### 5. Vitestでの型エラー

**症状**: テストファイルで型が解決されない

**解決策**:
```json
// tsconfig.jsonのinclude配列にtest追加済み
{
  "include": ["src", "test", "vite.config.ts"]
}
```

### パフォーマンス最適化

#### 大規模プロジェクトでの設定調整

```json
{
  // 型チェック速度向上
  "skipLibCheck": true,

  // インクリメンタルコンパイル
  "incremental": true,
  "tsBuildInfoFile": ".tsbuildinfo",

  // 並列処理（大規模時）
  "assumeChangesOnlyAffectDirectDependencies": true
}
```

#### 開発時の型チェック無効化

開発サーバー起動時の型チェックを無効化（別途tsc --watchで実行）:

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "type-check": "tsc --pretty --noEmit --watch"
  }
}
```

## カスタマイズガイド

### プロジェクト固有の調整

#### ゲーム固有の型チェック緩和

特定の箇所でのみ型チェックを緩和する場合：

```typescript
// @ts-expect-error: Three.jsの内部実装との互換性
mesh.material.uniforms = customUniforms

// @ts-ignore: 一時的な型定義不備の回避
const texture = await loader.loadAsync(url)
```

#### 実験的機能の有効化

TypeScript 5.9+の実験的機能を試す場合：

```json
{
  "compilerOptions": {
    // 実験的デコレータ（Stage 3仕様）
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,

    // 新しいJSX変換
    "jsx": "react-jsx",

    // ES2024機能の先行採用
    "target": "ES2024"
  }
}
```

### レイヤー別の型制約

各アーキテクチャレイヤーごとに異なる型制約を適用する場合、複数のtsconfig.jsonファイルを使用：

```
tsconfig.json              // ベース設定
tsconfig.domain.json       // ドメイン層用（最も厳格）
tsconfig.infrastructure.json // インフラ層用（外部ライブラリとの互換性重視）
```

この設定により、型安全性とパフォーマンスのバランスを保ちながら、モダンなTypeScript開発環境を実現しています。