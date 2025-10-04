---
title: 'Bounded Context 再配置方針'
description: 'DDD移行フェーズ1で採用するBounded Context単位のディレクトリ設計と依存境界のガイドライン。'
category: 'explanation'
difficulty: 'advanced'
tags: ['architecture', 'ddd', 'bounded-context', 'project-structure']
prerequisites: ['architecture-overview', 'domain-layer-design-principles']
related_docs: ['../../reference/architecture/src-directory-structure.md', '../../how-to/development/development-conventions.md']
---

# Bounded Context 再配置方針

## 目的

- DDD移行フェーズ1の成果物として、Bounded Contextごとに層構造を分割する新しいディレクトリポリシーを確立する。
- 依存方向を `shared-kernel → domain → application → interface(=presentation)` に固定し、インフラ実装を文脈単位で隔離する。
- TypeScript Project References の導入前提となるコンポーネント分解を明文化する。

## 目標構造

```
src/
├── bounded-contexts/
│   ├── world/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── interface/
│   ├── player/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── interface/
│   ├── inventory/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── interface/
│   └── ...
├── shared-kernel/
│   ├── primitives/
│   ├── time/
│   ├── math/
│   └── effect/
├── platform/
│   ├── environment/
│   ├── storage/
│   └── rendering/
├── bootstrap/
└── testing/
```

### 命名規則

- `bounded-contexts/<context>/domain` は純粋なモデル・ドメインサービス・ポート定義のみ。
- `bounded-contexts/<context>/application` はユースケースサービスとDTO、Effect Layer合成。
- `bounded-contexts/<context>/infrastructure` はポート実装と外部I/Oアダプタ。
- `bounded-contexts/<context>/interface` はUIや外部境界との接続（API、CLI、プレゼンテーション層）。
- 共通値や横断関心事は `shared-kernel` に集約し、特定文脈へ逆依存しない。
- 旧 `src/application`, `src/infrastructure`, `src/presentation` は段階的に `bounded-contexts` 配下へ移譲し、最終的にFacadeのみ保持。

## 依存制約

```
shared-kernel
  ↓
bounded-contexts/*/domain
  ↓
bounded-contexts/*/application
  ↓
bounded-contexts/*/interface
```

- Infrastructure は Application 層の内部実装として扱い、ドメインから直接参照しない。
- 複数コンテキスト間で共有する場合は `shared-kernel` を経由する。
- 共通のプラットフォーム依存機能（ファイル、ブラウザAPI等）は `platform/` に実装し、Infrastructure 層が注入。

## Project References 分割単位

| パッケージID | 対象ディレクトリ | 役割 |
| --- | --- | --- |
| `@mc/shared-kernel` | `src/shared-kernel` | 値オブジェクト、ユーティリティ、共通エラー |
| `@mc/bc-world` | `src/bounded-contexts/world` | ワールド管理のドメインとアプリケーション |
| `@mc/bc-player` | `src/bounded-contexts/player` | プレイヤー文脈 |
| `@mc/bc-inventory` | `src/bounded-contexts/inventory` | インベントリ文脈 |
| `@mc/platform` | `src/platform` | 技術プラットフォーム抽象化 |
| `@mc/bootstrap` | `src/bootstrap` | システム初期化・DI 合成 |
| `@mc/testing` | `src/testing` | テスト補助モジュール |
| `@mc/app` | `src/app.ts` / `src/main.ts` | エントリーポイント (参照オンリー) |

## 段階的移行手順

1. `src/bounded-contexts` と `src/shared-kernel` を作成し、既存コードの写経先を確保する。
2. `tsconfig.base.json` にコンポジション構成を定義し、各コンテキスト用 `tsconfig.json` を配置。
3. `dependency-cruiser` ルールで `domain → infrastructure` 直通を禁止し、違反箇所をIssue化。
4. フェーズ2以降で `domain` から Live 実装を切り出し、Port/Adapter パターンに移行。
5. 最終段階で既存 `@domain/*` 等のパスエイリアスを `@mc/bc-*/domain` 等へ置換し、型チェックを通す。

## 成功判定

- Domain モジュールが `effect`, `schema`, `shared-kernel` 以外へ依存しない。
- `tsc --build` 実行時にコンテキストごとのインクリメンタルビルドが成立する。
- Vite/Vitest が Project References 経由で型解決できる。
- `dependency-cruiser` の禁止ルールを全モジュールが満たす。
- 新旧ディレクトリ構造の並走期間において、旧パスエイリアスが残存しない。
