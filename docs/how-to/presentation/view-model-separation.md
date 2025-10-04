---
title: 'Presentation ViewModel 分離ガイド'
description: 'フェーズ5で導入する ViewModel / DTO 分離ポリシーと契約テスト戦略。'
category: 'how-to'
difficulty: 'intermediate'
tags: ['presentation', 'view-model', 'testing']
related_docs:
  - '../../reference/architecture/application-usecases.md'
  - '../../explanations/architecture/application-layer-decomposition.md'
---

# Presentation ViewModel 分離ガイド

## ポリシー

- UI は `src/bounded-contexts/<context>/interface/view-models` に定義された DTO のみを参照し、Domain 型や Effect を直接 import しない。
- ViewModel は Application ユースケース (`@mc/bc-*/application/use-cases`) を通じてデータを取得し、副作用はユースケースへ委譲する。
- React Hooks は `controllers/` に配置し、ViewModel を購読する薄いアダプタとして実装する。

## 実装手順

1. 既存の `src/presentation/inventory` を `view-models` / `controllers` / `components` に分割。
2. Domain 型を使用している箇所は `ViewModel` DTO を介すように変換。
3. Application 層の `InventoryUiService` など Bounded Context のユースケースを通じてデータを取得し、ViewModel から呼び出す。

## テスト指針

- ViewModel 契約: Vitest + `@testing-library` で DTO 変換が期待通りか検証 (`view-models/*.test.ts`)。
- Controller: ユースケースをモックし、UI 連携が正しいことを確認。
- Storybook: UI コンポーネントの表示確認は Storybook へ移行し、Domain 型に依存しないモックデータを使用。

## TODO

- [ ] `src/presentation/inventory/view-model` を `bounded-contexts/inventory/interface/view-models` へ移動し、DTO 定義を追加。
- [ ] GameApplication UI (未実装) 用に `world/interface/ui` へサンプル画面を追加。
