---
title: 'packages/ ディレクトリ構造設計'
description: 'Effect-TS + DDD + package-by-feature に基づく現行ソースコード構造'
category: 'architecture'
priority: 'critical'
related_docs:
  - 'docs/explanations/architecture/architecture-overview.md'
  - 'docs/how-to/development/development-conventions.md'
  - 'docs/tutorials/basic-game-development/domain-layer-architecture.md'
tags: ['architecture', 'ddd', 'effect-ts', 'package-by-feature', 'directory-structure']
---

# packages/ ディレクトリ構造設計

## 概要

現行コードは単一の巨大な `src` レイヤーツリーではなく、bounded context ごとに `packages/<feature>` を分ける package-by-feature 構成を採用する。`src/main.ts` はブラウザ起動の最小エントリーポイントであり、実装の責務は各 package に置く。

## 全体構造

```
src/
└── main.ts                         # エントリーポイント
packages/
├── app/                            # セッション、フレーム、UI composition
├── game/                           # 時間、ゲーム状態、ゲームループ
├── terrain/                        # チャンク、地形生成、ブロックルール
├── rendering/                      # Three.js rendering bounded context
├── physics/                        # 物理演算と衝突
├── inventory/                      # インベントリ、クラフト、かまど
├── player/                         # プレイヤー状態と入力由来の domain logic
├── entities/                       # entity data model
├── world-state/                    # 永続化対象の world state
└── kernel/                         # shared kernel: branded types, constants, pure math, ports
```

## パッケージ内レイヤー

各 package は必要に応じて次のレイヤーを持つ。存在しないレイヤーを空ディレクトリとして作る必要はない。

```
packages/<feature>/
├── domain/                         # pure data, rules, schemas, ports
├── application/                    # Effect services, use cases, orchestration
├── infrastructure/                 # Three.js, workers, storage, browser adapters
├── presentation/                   # DOM/UI-facing view and interaction code
├── test/                           # package-local tests and helpers
└── index.ts                        # public package surface
```

## 依存方向

- `domain` は pure TypeScript / Effect Schema / shared kernel に限定し、Three.js・DOM・Worker・IndexedDB などの外部実装に依存しない。
- `application` は use case と orchestration を担当し、domain と必要な port/service interface に依存する。
- `infrastructure` は外部ライブラリやブラウザ API の adapter を担当し、domain/application の port を実装する。
- `presentation` は UI 入出力を担当し、application service を通じて状態変更する。
- package 外からは原則 `@ts-minecraft/<package>` の公開 surface を通す。内部ファイルへの deep import は、公開 API として明示されている path alias に限定する。

## data と logic の分離

- 静的データや定数表は `domain/*config*`, `domain/*data*`, または feature 固有の domain data file に置く。
- 変換・判定・状態遷移 logic は pure function として data から分離する。
- 外部リソース生成や副作用は `Effect.Service` / `Layer` / `Effect.acquireRelease` に閉じ込める。
- 高頻度 frame loop では allocation 境界を明示し、imperative hot path を使う場合も domain data と adapter logic を混在させない。

## Effect-TS 方針

- long-lived resource は `Effect.Service` と scoped layer で構築し、GPU/Worker/DOM resource は release path を持つ。
- エラーは typed error channel か domain error schema で表現し、空の `catch` や unchecked promise を残さない。
- mutable runtime state は `Ref`, `MutableRef`, `MutableHashMap` など用途に合った Effect data type に閉じ込める。

## 検証

通常の品質ゲートは次を使用する。

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```
