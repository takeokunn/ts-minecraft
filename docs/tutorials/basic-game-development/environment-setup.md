---
title: 'ゲーム開発環境セットアップ - TypeScript Minecraft開発準備'
description: 'Effect-TS 3.17+、Three.js、Viteを使用した最新ゲーム開発環境の構築手順。5分で完了する効率的セットアップガイド。'
category: 'tutorial'
difficulty: 'beginner'
tags: ['environment-setup', 'development-environment', 'typescript', 'effect-ts', 'three.js', 'vite']
prerequisites: ['nodejs-installed', 'basic-typescript']
estimated_reading_time: '10分'
estimated_setup_time: '5分'
related_docs: ['../getting-started/README.md', '../../how-to/development/development-conventions.md']
---

# 🛠️ ゲーム開発環境セットアップ

## 🎯 セットアップ目標

**5分で完了**: プロダクションレベルの TypeScript Minecraft 開発環境

- ✅ Effect-TS 3.17+ 最新機能対応
- ✅ Three.js WebGL レンダリング基盤
- ✅ Vite 高速ビルドシステム
- ✅ TypeScript 5.0+ 完全型安全性
- ✅ Vitest 現代的テストフレームワーク

## 📋 前提条件

```bash
# 必須環境確認
node --version  # v18.0.0+ 必須
pnpm --version  # v8.0.0+ 推奨
git --version   # 任意バージョン

# ✅ すべて表示されればOK
```

## 🚀 クイックセットアップ

### ステップ1: プロジェクトクローン（1分）

```bash
# プロジェクトクローン
git clone https://github.com/yourusername/ts-minecraft.git
cd ts-minecraft

# 依存関係インストール
pnpm install
```

### Issue駆動開発の開始

```bash
# 1. Issue作成（ROADMAPから自動生成）
claude "ROADMAP Phase 0 のIssueを作成して"

# 2. Issue実装（Claude Agent自動実行）
claude "Issue #123 を実装して"
# → GitHub Issue内の8段階実行計画を自動実行

# 3. 開発サーバー起動
pnpm dev
```

### ステップ2: 依存関係インストール（2分）

```bash
# コア依存関係
pnpm add \
  effect@latest \
  @effect/schema@latest \
  @effect/platform@latest \
  three@latest \
  @types/three@latest

# 開発依存関係
pnpm add -D \
  typescript@latest \
  vite@latest \
  vitest@latest \
  @types/node@latest \
  oxlint@latest \
  prettier@latest
```

### ステップ3: 設定ファイル作成（2分）

```bash
# TypeScript設定
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Vite設定
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022'
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
EOF

# Oxlint設定（高速リンター）
cat > oxlintrc.json << 'EOF'
{
  "rules": {
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": "error",
    "no-console": "off"
  }
}
EOF

# Prettier設定（コードフォーマッター）
cat > .prettierrc << 'EOF'
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always"
}
EOF
```

### ステップ4: プロジェクト構造作成

```bash
# ディレクトリ構造作成
mkdir -p src/{domain,application,infrastructure,presentation}
mkdir -p src/domain/{world,player,game}
mkdir -p src/application/services
mkdir -p src/infrastructure/{rendering,storage}
mkdir -p src/presentation/{ui,input}
mkdir -p public

# HTMLエントリーポイント
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript Minecraft Clone</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #000;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        #gameCanvas {
            display: block;
        }
        #ui {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            z-index: 100;
            font-size: 12px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        }
    </style>
</head>
<body>
    <canvas id="gameCanvas"></canvas>
    <div id="ui">
        <div>TypeScript Minecraft Clone</div>
        <div>FPS: <span id="fps">0</span></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
EOF
```

### ステップ5: 動作確認用サンプル作成

```typescript
// src/main.ts
import { Effect } from 'effect'
import * as THREE from 'three'

// 簡易動作確認
const main = Effect.gen(function* () {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement

  if (!canvas) {
    return yield* Effect.fail('Canvas not found')
  }

  // WebGL基本セットアップ
  const renderer = new THREE.WebGLRenderer({ canvas })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  // シンプルなキューブ表示
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  const cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  camera.position.z = 5
  renderer.setSize(window.innerWidth, window.innerHeight)

  // レンダリングループ
  const animate = (): void => {
    requestAnimationFrame(animate)
    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
    renderer.render(scene, camera)
  }

  animate()

  console.log('🎮 Environment setup successful!')
})

Effect.runSync(main.pipe(Effect.catchAll((error) => Effect.sync(() => console.error('Setup failed:', error)))))
```

```bash
# package.jsonスクリプト追加
cat > package.json << 'EOF'
{
  "name": "minecraft-clone-tutorial",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "oxlint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "effect": "latest",
    "@effect/schema": "latest",
    "@effect/platform": "latest",
    "three": "latest",
    "@types/three": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "@types/node": "latest",
    "oxlint": "latest",
    "prettier": "latest"
  }
}
EOF
```

### ステップ6: 動作確認

```bash
# 開発サーバー起動
npm run dev

# ✅ 成功確認項目:
# - http://localhost:3000 が開く
# - 緑色の回転するキューブが表示
# - コンソールに "Environment setup successful!" 表示
# - エラーなしで動作
```

## 🎯 セットアップ検証チェックリスト

### 基本環境（必須）

- [x] Node.js 18+ インストール済み
- [x] npm/yarn パッケージマネージャー動作
- [x] TypeScript コンパイル成功
- [x] Vite 開発サーバー起動成功

### Effect-TS環境（必須）

- [x] Effect パッケージインポート成功
- [x] Effect.gen パターン動作確認
- [x] 型安全性チェック通過
- [x] エラーハンドリング動作

### Three.js環境（必須）

- [x] WebGL レンダリング成功
- [x] 3Dオブジェクト表示
- [x] アニメーションループ動作
- [x] ブラウザ互換性確認

### 開発環境（推奨）

- [x] Oxlint 高速リンター設定済み
- [x] Prettier コードフォーマッター設定済み
- [x] TypeScript 型チェック動作
- [x] Vitest テスト実行可能
- [x] ホットリロード機能動作

## 🚨 トラブルシューティング

### Node.jsバージョン問題

```bash
# バージョンが古い場合
npm install -g n
sudo n latest

# または nvm 使用
nvm install node
nvm use node
```

### パッケージインストールエラー

```bash
# キャッシュクリア
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### TypeScript コンパイルエラー

```bash
# 設定ファイル再確認
npx tsc --showConfig
npm run type-check
```

### Three.js インポートエラー

```bash
# 型定義確認
npm ls @types/three
# 再インストール
npm install --save-dev @types/three@latest
```

## 🔄 Learning Path

### ✅ Previous Step

**New to the project?** Start here first:

- **[Getting Started](../getting-started/README.md)** - Project overview and basic concepts
- ⏱️ Recommended: ~15 minutes to understand the project goals

### ➡️ Next Step

**[Basic Components](./basic-components.md)**

- 🎯 Learning goal: Create foundational domain entities using Effect-TS patterns
- ⏱️ Estimated time: ~25 minutes
- 📋 Prerequisites: Environment setup completed successfully

### 📊 Progress in this Series

**Basic Game Development (1/5 completed)**

- [x] **Current: Environment Setup**
- [ ] [Basic Components](./basic-components.md)
- [ ] [Domain Layer Architecture](./domain-layer-architecture.md)
- [ ] [Application Services](./application-services.md)
- [ ] [Interactive Learning Guide](./interactive-learning-guide.md)

**🎯 Series Goal**: Build a functional Minecraft Clone prototype using Effect-TS 3.17+ and DDD patterns
**⏱️ Estimated remaining**: ~75 minutes

## 🔗 次のステップ

環境セットアップ完了後の学習パス：

1. **[基本コンポーネント作成](./basic-components.md)** - Domain層の基礎実装
2. **[Effect-TS サービス実装](./03-effect-services.md)** - Application層の構築
3. **[Three.js 統合](./04-threejs-integration.md)** - Infrastructure層の実装
4. **[ゲームループ実装](./05-game-loop.md)** - 完全統合とテスト

**🎉 準備完了！次は実際のゲームコンポーネント作成に進みましょう。**

---

_💡 このセットアップにより、プロダクションレベルのTypeScript Minecraft Clone開発基盤が完成しました。_
