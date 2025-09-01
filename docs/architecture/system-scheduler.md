# System Scheduler

ECSアーキテクチャにおいて、各システムは独立したロジックの単位ですが、ゲーム全体として正しく動作するためには、それらを特定の順序で実行する必要があります。例えば、プレイヤーの入力を処理する`playerControlSystem`は、その入力を使って物理的な移動を計算する`physicsSystem`よりも先に実行されなければなりません。

この実行順序を管理するため、本プロジェクトでは独自の**システムスケジューラ**を導入しています。

## 1. 依存関係ベースの実行順序決定

スケジューラは、各システム間の依存関係（「AはBの後に実行する」など）を定義するだけで、最適な実行順序を自動的に決定します。これにより、手動で実行順序を並べる必要がなくなり、システムの追加や変更が容易になります。

### システムの定義

システムの定義は `src/systems/index.ts` で一元管理されます。各システムは `SystemNode` オブジェクトとして定義され、以下のプロパティを持ちます。

- `name`: システムの一意な名前（文字列）。
- `system`: 実行されるシステム本体（`Effect`プログラム）。
- `after`: このシステムが**後に**実行されるべきシステムの`name`の配列（オプション）。

```typescript
// src/systems/index.ts
const systems: SystemNode[] = [
  {
    name: 'playerControl',
    system: playerControlSystem,
  },
  {
    name: 'raycast',
    system: raycastSystem,
    after: ['playerControl'],
  },
  {
    name: 'blockInteraction',
    system: blockInteractionSystem,
    after: ['raycast'],
  },
  {
    name: 'physics',
    system: physicsSystem,
    after: ['playerControl'],
  },
  {
    name: 'collision',
    system: collisionSystem,
    after: ['physics'],
  },
  {
    name: 'chunkLoading',
    system: chunkLoadingSystem,
    after: ['collision'], // プレイヤーの移動が確定した後に実行
  },
  {
    name: 'ui',
    system: uiSystem,
    after: ['blockInteraction'], // ブロックの設置/破壊をUIに反映するため
  },
  {
    name: 'camera',
    system: cameraSystem,
    after: ['collision'], // 最終的なプレイヤーの位置をカメラに反映するため
  },
  {
    name: 'scene',
    system: sceneSystem,
    after: ['chunkLoading', 'collision'], // ワールドの最終状態を描画するため
  },
]
```

上記の例では、スケジューラは以下のような複雑な依存関係グラフを解決します。

- `playerControl` が最初に実行されるグループに属します。
- `raycast` と `physics` は `playerControl` の後に実行されます（これら2つは並行実行可能）。
- `blockInteraction` は `raycast` の後、`collision` は `physics` の後に実行されます。
- `chunkLoading`, `camera`, `ui` は、それぞれの先行システムが完了した後に実行されます。
- `scene` は `chunkLoading` と `collision` の両方が完了した後に、最後に実行されます。

これにより、例えば「プレイヤーの入力 -> 物理計算 -> 衝突解決 -> カメラ更新」という一連の処理順序が保証されると同時に、依存関係のない処理はスケジューラによって効率的な順序で実行されます。

## 2. 実行プランの構築

`src/runtime/scheduler.ts` に実装された `createMainSystem` 関数が、`SystemNode` のリストを受け取ります。

1.  **依存関係の解析**: `after` プロパティを読み取り、システム間の依存関係グラフを構築します。
2.  **トポロジカルソート**: 依存関係グラフをトポロジカルソートし、実行可能な一意の順序を導き出します。
3.  **循環参照の検出**: もし「AはBの後、BはAの後」のような循環参照が存在する場合、エラーをスローして無限ループを防ぎます。
4.  **単一Effectの合成**: ソートされた順序に基づき、すべてのシステムを順番に実行する単一の `Effect` プログラム (`mainSystem`) を生成します。

この `mainSystem` が、ゲームループ (`src/runtime/loop.ts`) の中で毎フレーム実行されます。

## 3. 利点

- **宣言的な依存関係**: 「何をどの順番で」ではなく、「何が何に依存しているか」を記述するだけで済み、コードの意図が明確になります。
- **高い保守性**: 新しいシステムを追加する際、巨大な実行パイプラインを編集する必要はありません。新しいシステムの`name`と`after`を定義するだけで、スケジューラが自動的に正しい位置に組み込みます。
- **拡張性**: 将来的には、依存関係のないシステム同士を並列実行する（例: `Effect.forEach(..., { concurrency: "inherit" })`）といった最適化を、スケジューラ自体に実装することも可能です。
