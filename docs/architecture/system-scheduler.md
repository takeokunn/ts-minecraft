> **Summary**
> このドキュメントは、ECSにおける各システムがどの順序で実行されるかについて説明します。本プロジェクトでは、`src/main.ts`に定義された静的な配列によって実行順序を明示的に制御する、シンプルで予測可能なアプローチを採用しています。

# システムの実行順序

ECSアーキテクチャにおいて、各システムは独立したロキ-ックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります。例えば、プレイヤーの入力を処理する`inputPollingSystem`は、その入力を使って移動を計算する`playerMovementSystem`よりも先に実行されなければなりません。

## 静的な実行順序の定義

本プロジェクトでは、システムの実行順序を `src/main.ts` 内の**静的な配列**として明確に定義しています。これにより、どのシステムがどの順番で実行されるかが一目瞭然となり、デバッグやパフォーマンスチューニングが容易になります。

`main.ts` 内で定義された `systems` 配列が、ゲームループにおける唯一の実行順序となります。

```typescript
// src/main.ts

// ... imports

const main = Effect.gen(function* (_) {
  // ... world initialization

  // この配列の順序がフレームごとの実行順序となる
  const systems: ReadonlyArray<Effect.Effect<void, never, SystemRequirements>> = [
    // 1. 入力
    inputPollingSystem,

    // 2. プレイヤーの意図を計算
    cameraControlSystem,
    playerMovementSystem,

    // 3. 物理演算と衝突解決
    physicsSystem,
    updatePhysicsWorldSystem,
    collisionSystem,

    // 4. ワールドとのインタラクション
    raycastSystem,
    updateTargetSystem,
    blockInteractionSystem,

    // 5. ワールドの状態更新
    chunkLoadingSystem,
    worldUpdateSystem,

    // 6. UI
    createUISystem(hotbarUpdater),
  ]

  // ゲームループにシステムの配列を渡して実行
  yield* _(gameLoop(systems))
})
```

## 実行フロー

1.  **`main.ts`**: アプリケーションのエントリーポイントで、`systems` 配列を定義します。
2.  **`runtime/loop.ts`**: `gameLoop` 関数がこの配列を受け取ります。
3.  **フレームごとの実行**: `requestAnimationFrame` ループの中で、`gameLoop` は配列の先頭から末尾へ向かって、各システム `Effect` を順番に実行します (`Effect.forEach(systems, ..., { concurrency: 1 })`)。

## 利点と設計思想

- **明確さ (Explicitness)**: 実行順序はコード内に明示されており、魔法のような自動解決はありません。これにより、システムの振る舞いが予測しやすくなります。
- **デバッグの容易さ**: 問題が発生した場合、`systems` 配列の順序を確認したり、一時的に入れ替えたりすることで、原因の切り分けが容易になります。
- **シンプルさ**: 依存関係グラフやトポロジカルソートといった複雑な仕組みを導入せず、プロジェクトのコアロジックをシンプルに保ちます。

将来的にシステムの数が増え、依存関係が複雑化した場合には、依存関係ベースのスケジューラの導入を検討する可能性はありますが、現状はこのシンプルで明確なアプローチを採用しています。
