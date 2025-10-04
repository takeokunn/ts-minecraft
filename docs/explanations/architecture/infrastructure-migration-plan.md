---
title: 'Infrastructure Adapter Migration Plan'
description: 'フェーズ4で実施するアダプタ再配置と依存制約ルールのまとめ。'
category: 'explanation'
difficulty: 'intermediate'
tags: ['infrastructure', 'adapter', 'ddd']
related_docs:
  - './bounded-context-refactor.md'
  - '../../reference/architecture/application-usecases.md'
---

# Infrastructure Adapter Migration Plan

## 再配置マッピング

| 既存ディレクトリ | 対象 Bounded Context | 新配置先 | 状態 |
| --- | --- | --- | --- |
| `src/infrastructure/audio/*` | `world` | `src/bounded-contexts/world/infrastructure/audio` | ✅ 移行済み |
| `src/infrastructure/ecs/*` | `world` | `src/bounded-contexts/world/infrastructure/ecs` | ✅ 移行済み |
| `src/infrastructure/events/*` | `world` | `src/bounded-contexts/world/infrastructure/events` | ✅ 移行済み |
| `src/infrastructure/inventory/persistence/*` | `inventory` | `src/bounded-contexts/inventory/infrastructure/persistence` | ✅ 移行済み |
| `src/infrastructure/rendering.disabled/*` | `world` | `src/bounded-contexts/world/infrastructure/rendering/disabled` | ✅ 移行済み |
| `src/infrastructure/index.ts` | - | 削除（レガシーファサード撤去） | ✅ 削除 |

> `events` は最終的に `platform` 文脈へ移動予定だが、Effect Layer 依存が `world` に集中しているため暫定的に world 配下で整理する。

## 依存制約

- インフラ層から **Domain/Shared Kernel** への依存のみ許可し、Application や Interface 層への逆依存は禁止。
- Bounded Context 跨ぎのインフラ依存は禁止し、共通機能は `src/shared-kernel` または `src/platform` に抽象化してから利用する。
- Adapter は対応する Domain Port (`src/domain/inventory/ports/storage` 等) を実装し、直接ドメイン型を import しない。
- Effect Layer 合成は `bounded-contexts/<context>/application` で完結させ、インフラ層は純粋な Adapter として Layer を提供する。

## 次ステップ

1. アダプタごとに `Layer` 定義を `bounded-contexts/*/infrastructure` へ移動し、`Context.GenericTag` で公開。
2. 既存の `src/infrastructure/index.ts` は段階的に空化し、最終的に削除。
3. テスト (`src/infrastructure/**/__test__`) を適切な文脈配下へ移し、ユースケーステストから依存注入。

## 進捗メモ
- [x] Inventory persistence を `src/bounded-contexts/inventory/infrastructure/persistence` へ移設。
- [x] Rendering (ThreeRenderer 系) を `src/bounded-contexts/world/infrastructure/rendering/disabled` へ移設。
- [x] EventBus を `src/bounded-contexts/world/infrastructure/events` に統合。
