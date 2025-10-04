---
title: 'GameApplication 分割計画'
description: 'フェーズ3における GameApplication → コンテキスト別ユースケース再配置計画と Effect Layer 合成方針。'
category: 'explanation'
difficulty: 'intermediate'
tags: ['application-layer', 'effect-layer', 'bounded-context']
related_docs:
  - '../architecture/bounded-context-refactor.md'
  - '../../reference/architecture/application-usecases.md'
---

# GameApplication 分割計画

## Layer 合成の責務

- `bootstrap` 層は **エントリポイント** として外部環境（ブラウザ / Node）から必要な設定を受け取り、`@mc/bc-world` と `@mc/platform` のユースケースを組み合わせる。
- 各 Bounded Context の `application/use-cases/*` は **Effect Layer の合成単位** として、Domain ポートと Infrastructure Adapter のみを依存対象とする。
- `GameApplication` インターフェースは段階的に `InitializeGameApplication` などのユースケースへ委譲し、Facade として最終的に `src/bounded-contexts/world/application/index.ts` を参照する。

```
bounded-contexts/world/application/use-cases
  ├── initialize.ts      # Layer.mergeAll(sceneLayer, rendererLayer, inputLayer, gameLoopLayer)
  ├── start.ts           # GameLoop.start + Renderer.start + Input.enable
  ├── pause.ts           # GameLoop.pause + Renderer.pause
  ├── resume.ts
  └── ...
```

## 移行ステップ

1. `GameApplicationLive.ts` の `Layer` 合成ロジックをユースケース別モジュールへ分割。
   - 例: `InitializeGameApplication` が `Layer.mergeAll(SceneLayer, RendererLayer, InputLayer)` を返す。
2. `GameApplication.ts` はユースケースタグを注入する Facade のみに縮小し、`Context.GenericTag` は `bounded-contexts/world/application/use-cases` のタグを再エクスポート。
3. `bootstrap/application.ts` での依存解決を `InitializeGameApplication` などに差し替え、Facade 経由で呼び出す。
4. `inventory` 向けユースケース（例: `SyncInventoryState`）は `bounded-contexts/inventory/application/use-cases` に追加し、`GameApplication` から分離。

## 期待成果

- Effect Layer の合成ポイントがユースケース単位に分割され、テスト容易性が向上。
- Application 層が Context 別ユースケースの組み合わせとして明瞭化し、Facade (`GameApplication`) は後方互換 API として残す。
- 将来的に `bootstrap` 層から `GameApplication` を段階的に撤去し、Bounded Context 間の依存方向を `world → inventory → player → interface` へ整理可能。
