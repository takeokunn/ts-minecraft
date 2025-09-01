# ワールド更新システム (World Update System)

ワールド更新システムは、バックグラウンドのWeb Worker (`computation.worker.ts`) で生成されたチャンクデータを、メインスレッド上の `World` とレンダリングエンジンに反映させる責務を担います。このシステムは、非同期の計算結果をゲームのメインループに統合するための重要な橋渡し役です。

-   **関連ソース**: [`src/systems/world-update.ts`](../../src/systems/world-update.ts)

---

## 責務

`worldUpdateSystem` の責務は、`computation.worker.ts` とメインスレッドの各種サービスとを繋ぐことです。

1.  **データ受信**: `ChunkDataQueue` を監視し、Workerが完了したチャンク生成タスクの結果（ブロックデータとメッシュデータ）を受け取ります。
2.  **ワールド状態の更新**: 受け取ったブロックデータに基づき、`World` に新しいブロックエンティティを生成します。
3.  **レンダリングの依頼**: 受け取ったメッシュデータを `RenderQueue` に送信し、レンダリングエンジンにチャンクのジオメトリの生成・更新を依頼します。

---

## 処理フロー

`worldUpdateSystem` は `Effect` プログラムとして実装されており、毎フレーム実行されます。パフォーマンスへの影響を最小限に抑えるため、1フレームにつき最大1つのチャンクデータのみを処理する設計になっています。

1.  **キューからのデータ取得**:
    -   `ChunkDataQueue` サービスから、完了したチャンク生成結果を1つだけデキュー（取り出し）します。キューが空の場合、システムは何もせずにそのフレームの処理を終了します。

2.  **エンティティの生成**:
    -   取得したチャンク結果に含まれる `blocks` 配列をループ処理します。
    -   配列内の各 `BlockData` に対して `createBlock` アーキタイプ（`src/domain/archetypes.ts`）を呼び出し、`Position`, `Block`, `Collider`, `TerrainBlock` といった必要なコンポーネントを持つブロックエンティティを `World` に一括で生成します。

3.  **レンダリングコマンドの送信**:
    -   取得したチャンク結果に含まれる `mesh` データ（`positions`, `normals`, `uvs`, `indices`）を使って、`UpsertChunk` というレンダリングコマンドを作成します。
    -   このコマンドを `RenderQueue` にエンキュー（追加）します。後のフレームで `RendererThree` サービスがこのコマンドを処理し、実際にThree.jsの `Mesh` オブジェクトをシーンに追加または更新します。
    -   メッシュのインデックス数が0の場合（完全に空のチャンクなど）、コマンドは送信されません。

---

## 他のシステムとの連携

このシステムは、非同期のデータフローの中心に位置します。

`chunkLoadingSystem` -> `Computation Service (Worker)` -> `ChunkDataQueue` -> **`worldUpdateSystem`** -> `World` & `RenderQueue` -> `RendererThree`

1.  **`chunkLoadingSystem`**: 新しいチャンクが必要になると、`Computation` サービスにタスクを依頼します。
2.  **`Computation Service`**: Worker内で地形とメッシュを生成し、結果を `ChunkDataQueue` にエンキューします。
3.  **`worldUpdateSystem` (このシステム)**: `ChunkDataQueue` からデータを取り出し、`World` の状態を更新し、`RenderQueue` に描画を依頼します。
4.  **`RendererThree`**: `RenderQueue` からコマンドを取り出し、シーンにジオメトリを描画します。

このパイプラインにより、重い地形生成処理がメインスレッドのパフォーマンスに影響を与えることなく、スムーズにワールドが更新され続けます。