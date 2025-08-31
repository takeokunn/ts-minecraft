# 機能仕様: セーブ & ロード (Save & Load)

このドキュメントは、ゲームの状態を保存し、後で復元するためのシステムの仕様を定義します。この機能は `runtime/save-load.ts` に実装されたロジックと、UIイベント処理によって実現されます。

## 1. 設計思想

-   **再現性**: セーブデータには、ワールドを完全に同じ状態で再現するための最小限の情報のみを格納します。地形そのものの全ブロックデータは保存せず、ワールド生成シードと、プレイヤーによる変更の差分のみを記録します。
-   **スキーマ駆動**: `@effect/schema` を用いてセーブデータの構造 (`SaveState`) を厳密に定義します。これにより、データのバリデーションと安全なデシリアライズが保証されます。
-   **外部ファイルベース**: セーブデータは `save.json` という名前のJSONファイルとして扱われ、ブラウザのダウンロード・アップロード機能を通じてユーザーが管理します。

## 2. セーブデータ (`SaveState`) の構造

セーブデータの型インターフェースは `src/domain/components.ts` 内の `SaveState` として定義されています。

```typescript
// src/domain/components.ts (抜粋)
export interface SaveState {
  readonly seeds: {
    readonly world: number;
    readonly biome: number;
    readonly trees: number;
  };
  readonly amplitude: number;
  readonly cameraPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly playerRotation: {
    readonly x: number; // Pitch
    readonly y: number; // Yaw
    readonly z: number;
  };
  readonly editedBlocks: {
    readonly placed: ReadonlyArray<PlacedBlock>;
    readonly destroyed: ReadonlyArray<DestroyedBlock>;
  };
}
```

-   **`seeds` & `amplitude`**: ワールド生成に使用されたシード値と振幅。これにより、ロード時に全く同じ地形をプロシージャルに再現できます。
-   **`cameraPosition`**: プレイヤーエンティティの `Position` コンポーネントの状態。
-   **`playerRotation`**: プレイヤーエンティティの `CameraState` コンポーネントの状態 (`pitch` と `yaw`)。
-   **`editedBlocks`**: プレイヤーによって変更されたブロックの差分データ。
    -   **`placed`**: プレイヤーが設置したブロックの `[x, y, z, blockType]` のリスト。
    -   **`destroyed`**: プレイヤーが破壊したブロックの `[x, y, z]` のリスト。

## 3. セーブのプロセス (`saveGame` Effect)

1.  **トリガー**: プレイヤーがポーズ画面で "Save and Quit to Title" ボタンなどをクリックします。
2.  **データ収集**: `saveGame` エフェクトが実行されます。
    -   `GameState` サービスから、現在の `seeds`, `amplitude`, `editedBlocks` を取得します。
    -   `World` をクエリし、プレイヤーエンティティから `Position` と `CameraState` を取得します。
3.  **データ整形**: 収集したデータを `SaveState` インターフェースに準拠したオブジェクトに整形します。
4.  **ダウンロード**: `file-saver` ライブラリを使用し、生成されたオブジェクトを `save.json` ファイルとしてユーザーのローカルマシンにダウンロードさせます。

## 4. ロードのプロセス

1.  **トリガー**: プレイヤーがタイトル画面で "Load Game" ボタンなどをクリックし、有効な `save.json` ファイルを選択します。
2.  **ファイル読み込みとデコード**:
    -   選択されたJSONファイルの内容を読み込み、`SaveState` のスキーマを使って検証・デコードします。
    -   デコードに成功した場合、後続の処理が実行されます。
3.  **ゲーム状態の復元**:
    -   **`loadGame` Effectの実行**:
        -   `GameState` サービスの状態を、デコードしたセーブデータの `seeds`, `amplitude`, `editedBlocks` に更新します。
    -   **ワールドの再構築**:
        -   `generationSystem` を呼び出します。このシステムは `GameState` から更新されたばかりのシードと `editedBlocks` を読み取り、セーブデータに基づいたワールドをプロシージャルに再生成します。
    -   **プレイヤーの配置**:
        -   新しいプレイヤーエンティティをワールドに生成します。
        -   セーブデータの `cameraPosition` と `playerRotation` を使って、生成されたプレイヤーエンティティの `Position` と `CameraState` コンポーネントを更新し、保存された場所と向きに正確に配置します。
4.  **ゲーム開始**: ワールドの再構築が完了したら、`GameState` のシーンを `InGame` に変更し、ロードされたワールドでゲームを開始します。
