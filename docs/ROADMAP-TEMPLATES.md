---
title: "ROADMAP実行用テンプレート集"
description: "コピペ可能な設定ファイル・コマンド・Issueテンプレートの完全集"
category: "templates"
difficulty: "beginner"
tags: ["templates", "copy-paste", "quick-start"]
estimated_reading_time: "5分"
version: "1.0.0"
---

# ROADMAP実行用テンプレート集

> **🎯 目的**: ROADMAPの各タスクを効率的に実行するためのコピペ可能なテンプレート集

## 📦 Phase 1 設定ファイルテンプレート

### 📄 **package.json (#001)**
```json
{
  "name": "ts-minecraft",
  "version": "0.1.0",
  "description": "TypeScript Minecraft Clone with DDD×ECS×Effect-TS",
  "type": "module",
  "homepage": "https://minecraft.takeokunn.org",
  "repository": {
    "type": "git",
    "url": "https://github.com/takeokunn/ts-minecraft.git"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "clean": "rm -rf dist node_modules/.vite"
  },
  "dependencies": {
    "effect": "^3.17.0",
    "@effect/platform": "^0.67.0",
    "@effect/schema": "^0.77.0",
    "three": "^0.170.0",
    "@types/three": "^0.170.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.9",
    "@typescript-eslint/eslint-plugin": "^8.8.1",
    "@typescript-eslint/parser": "^8.8.1",
    "@vitest/coverage-v8": "^2.1.2",
    "@vitest/ui": "^2.1.2",
    "oxlint": "^0.9.10",
    "prettier": "^3.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  },
  "keywords": ["typescript", "minecraft", "effect-ts", "three.js", "ddd", "ecs"],
  "author": "takeokunn",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### ⚙️ **tsconfig.json (#002)**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Module Resolution */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    /* Type Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,

    /* Path Mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/domain/*": ["./src/domain/*"],
      "@/application/*": ["./src/application/*"],
      "@/infrastructure/*": ["./src/infrastructure/*"],
      "@/presentation/*": ["./src/presentation/*"]
    }
  },
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 🏗️ **vite.config.ts (#003)**
```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // 独自ドメイン用設定
  base: process.env.NODE_ENV === 'production' ? '/' : '/',

  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },

  // 開発サーバー設定
  server: {
    port: 3000,
    open: true,
    host: true
  },

  // パス解決設定
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/domain': resolve(__dirname, './src/domain'),
      '@/application': resolve(__dirname, './src/application'),
      '@/infrastructure': resolve(__dirname, './src/infrastructure'),
      '@/presentation': resolve(__dirname, './src/presentation')
    }
  },

  // Three.js最適化設定
  optimizeDeps: {
    include: ['three', 'effect', '@effect/platform', '@effect/schema']
  },

  // 環境変数設定
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  }
})
```

### 🎨 **.prettierrc (#006)**
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 🧹 **.prettierignore (#006)**
```
node_modules
dist
coverage
.vite
*.md
```

### 🧪 **vitest.config.ts (#006)**
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      threshold: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
```

---

## 🏗️ GitHub Actions テンプレート

### 🤖 **.github/workflows/ci.yml**
```yaml
name: CI - Code Quality

on:
  push:
    branches: [ "main", "develop" ]
  pull_request:
    branches: [ "main" ]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: TypeScript type check
      run: npm run type-check

    - name: Lint check
      run: npm run lint

    - name: Format check
      run: npm run format:check

    - name: Run tests
      run: npm run test:coverage

    - name: Build application
      run: npm run build
```

### 🚀 **.github/workflows/cd.yml**
```yaml
name: CD - Deploy to GitHub Pages

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run CI checks
      run: |
        npm run type-check
        npm run lint
        npm run test

    - name: Build Minecraft Clone
      run: npm run build
      env:
        NODE_ENV: production

    - name: Setup Pages
      uses: actions/configure-pages@v4

    - name: Upload build artifacts
      uses: actions/upload-pages-artifact@v3
      with:
        path: './dist'

  deploy:
    environment:
      name: github-pages
      url: https://minecraft.takeokunn.org
    runs-on: ubuntu-latest
    needs: build
    steps:
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
```

---

## 📋 GitHub Issue テンプレート集

### 🎯 **Feature Issue Template**
```markdown
## 🎯 Task: [タスク名]

### 📋 Description
[このタスクの詳細な説明]

### 🎯 Goals
- [ ] [具体的な目標1]
- [ ] [具体的な目標2]

### 🔗 Dependencies
**⚠️ 必須完了:**
- [ ] #XXX - [依存タスク名]

**🟢 並列可能:**
- [ ] #YYY - [同時進行可能]

### ✅ Acceptance Criteria
- [ ] [完了条件1]
- [ ] [完了条件2]
- [ ] TypeScript型エラー0件
- [ ] テスト実装・実行成功
- [ ] CI/CDパイプライン成功

### 📊 Estimation
**実装時間**: X.Y日
**並列性**: 🟢完全並列 / 🟡条件付き / 🔴順次必須

### 🏷️ Labels
`type: feature`, `priority: high`, `parallel-safe`
```

### ⚙️ **Config Issue Template**
```markdown
## ⚙️ Configuration: [設定名]

### 📁 Files to Create/Modify
- [ ] `[ファイル名1]`
- [ ] `[ファイル名2]`

### 🎯 Configuration Goals
[設定の目的と効果]

### 📋 Tasks
- [ ] [設定項目1]
- [ ] [設定項目2]
- [ ] 動作確認テスト

### 🔗 Dependencies
**並列性**: 🟢完全並列（他タスクと衝突なし）

### ✅ Verification
- [ ] 設定ファイル構文正常
- [ ] ツール正常動作確認
- [ ] CI/CD環境での確認

### 🏷️ Labels
`type: config`, `parallel-safe`, `priority: medium`
```

---

## 🚀 実行コマンド集

### 📦 **プロジェクトセットアップ**
```bash
# 1. プロジェクト初期化
mkdir ts-minecraft && cd ts-minecraft
git init
git remote add origin https://github.com/takeokunn/ts-minecraft.git

# 2. Node.jsプロジェクト初期化
npm init -y

# 3. 依存関係インストール
npm install effect @effect/platform @effect/schema three @types/three
npm install -D typescript @types/node vite vitest @vitest/ui @vitest/coverage-v8 prettier oxlint

# 4. 設定ファイル配置
# ↑上記テンプレートをコピペ

# 5. ディレクトリ構造作成
mkdir -p src/{domain,application,infrastructure,presentation}
mkdir -p src/test
mkdir -p public

# 6. 初回コミット
git add .
git commit -m "feat: initial project setup with Effect-TS stack"
```

### 🧪 **開発・テスト実行**
```bash
# 開発サーバー起動
npm run dev

# 型チェック
npm run type-check

# リント・フォーマット
npm run lint
npm run format

# テスト実行
npm run test
npm run test:ui
npm run test:coverage

# ビルド
npm run build
npm run preview
```

---

## 📊 進捗管理テンプレート

### 📈 **日次進捗レポート**
```markdown
## 📅 [日付] 進捗レポート

### ✅ 完了タスク
- [x] #001: Package.json作成
- [x] #002: TypeScript設定

### 🔄 進行中タスク
- [ ] #004: Effect-TS導入 (70%完了)
- [ ] #005: Three.js基本統合 (30%完了)

### 🚫 ブロッカー
- なし / [ブロッカーの詳細]

### 📋 明日の予定
- [ ] #007: ドメイン層基盤実装開始
- [ ] #008: ECS基盤実装開始

### 📊 Phase 1 進捗
進捗: ✅✅⬜⬜⬜⬜ 2/6 (33%)
```

---

**📋 Ready to Execute! Copy, Paste, and Start Building!**