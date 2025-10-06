---
title: 'Import Path管理規約'
description: 'TypeScript Minecraftプロジェクトにおけるimport pathの統一ルールとベストプラクティス'
category: 'guide'
difficulty: 'beginner'
tags: ['import-path', 'module-management', 'code-organization', 'best-practices', 'typescript']
prerequisites: ['basic-typescript', 'project-structure']
estimated_reading_time: '10分'
related_docs:
  [
    './development-conventions.md',
    '../../reference/architecture/directory-structure.md',
  ]
ai_context:
  primary_concepts:
    ['import-path-management', 'module-organization', 'code-consistency', 'tooling']
  prerequisite_knowledge:
    ['typescript-modules', 'path-aliases', 'project-structure']
  estimated_completion_time: '15分'
  learning_outcomes:
    ['import規約理解', '自動検証ツール活用', 'コード品質向上']
  complexity_level: 3.0
machine_readable:
  topics:
    [
      'import-path',
      'module-management',
      'code-organization',
      'typescript',
    ]
  skill_level: 'beginner'
  implementation_time: 15
  confidence_score: 0.99
---

# Import Path管理規約

TypeScript Minecraftプロジェクトにおけるimport pathの統一ルール。

## 基本原則

### 1. トップレベルディレクトリ間: path alias使用

**定義**: `src/`直下の異なるディレクトリ間（`domain/` ↔ `application/` 等）

```typescript
// ✅ 正しい
import { InventoryService } from '@domain/inventory'
import { GameApplication } from '@application'

// ❌ 誤り
import { InventoryService } from '../../domain/inventory'
```

### 2. 同一トップレベルディレクトリ内: 相対path使用

**定義**: `src/domain/inventory/` ↔ `src/domain/camera/` 等

```typescript
// ✅ 正しい
import { ChunkId } from '../chunk'
import { CameraService } from '../camera'

// ❌ 誤り
import { ChunkId } from '@domain/chunk'
```

### 3. 拡張子省略

```typescript
// ✅ 正しい
import { types } from './types'
import config from './config.json' // .jsonは残す

// ❌ 誤り
import { types } from './types.js'
import { types } from './types.ts'
```

### 4. index.ts経由必須

```typescript
// ✅ 正しい
import { InventoryService } from '@domain/inventory'

// ❌ 誤り（内部ファイル直接参照）
import { InventoryService } from '@domain/inventory/inventory-service'
```

**例外**: テストファイル（`*.spec.ts`, `*.test.ts`, `__tests__/*`）は内部実装への直接アクセス可

## 自動検証

### 検証スクリプト

```bash
# import path違反を検出
pnpm validate:imports

# 型チェック
pnpm typecheck

# 依存関係ルール検証
npx depcruise src
```

### CI統合

`pnpm check`で自動実行:

```bash
pnpm check # typecheck + format:check + editorconfig + validate:imports
```

## ツール

### 1. 検証スクリプト

**場所**: `scripts/validate-imports.ts`

**検出ルール**:

- 拡張子の使用（`.js`, `.ts`）
- 同一層内でのpath alias使用
- index.ts経由の不徹底

### 2. 拡張子削除スクリプト

**場所**: `scripts/remove-extensions.sh`

**使用方法**:

```bash
pnpm fix:extensions
```

### 3. dependency-cruiser

**設定**: `.dependency-cruiser.cjs`

**ルール**:

- `enforce-index-imports`: index.ts経由を強制
- `no-alias-within-domain`: domain層内のpath alias禁止
- `no-alias-within-application`: application層内のpath alias禁止
- 他層も同様

## よくある質問

### Q1: テストファイルはどうするか？

**A**: テストファイルは内部実装への直接アクセスが許可されています。

```typescript
// ✅ テストファイルでは許可
import { privateHelper } from '../internal/helper'
```

### Q2: JSONファイルのimportは？

**A**: `.json`拡張子は必須です。

```typescript
// ✅ 正しい
import config from './config.json'
```

### Q3: 既存コードの移行は？

**A**: 段階的に移行済み（完了）:

- Phase 1: domain層 ✅
- Phase 2: application/infrastructure/presentation層 ✅

## 実装履歴

- **2025-01-XX**: import path管理ルール策定・実装完了
  - 検証スクリプト作成
  - dependency-cruiserルール追加
  - 全層の違反修正完了（7件 → 0件）
  - 22個のindex.ts新規作成
