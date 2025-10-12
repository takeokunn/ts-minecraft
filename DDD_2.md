# DDD.md から抽出した設計上の懸念点

## 段階的対応計画

- **Phase 0: 基盤整備とガイドライン統一（完了）** – DDD_2.md の項目を境界ごとに再分類し、ドメイン純粋化テンプレートと DI/Layer の共通指針を整備する。
- **Phase 1: Player / Block / Inventory 純粋化完了（完了）** – 既に着手済みの領域で残存する `Layer.effect` / `<Service>Live` を Infrastructure へ移動し、Application・Presentation の依存を新構成へ更新する。
- **Phase 2: Chunk 系再構成** – Chunk / ChunkLoader / ChunkSystem の CQRS・ReadModel を Application 層へ移行し、Repository・パフォーマンス調整を Port 化する。
- **Phase 3: World / WorldGeneration / Biome 再設計** – WorldDomainConfig の技術要素を排除し、生成テンプレートやオーケストレーションを純粋化・Port 化する。
- **Phase 4: Scene / Physics / Performance / Observability 横断整理** – 物理・観測系サービスの環境依存を Infrastructure へ集約し、FeatureFlag・設定類を Composition ルートに統一する。
- **Phase 5: 横断テストとドキュメント更新** – `pnpm test` 等で回帰確認を行い、Diátaxis 構造のドキュメントとサンプルコードを新アーキテクチャに合わせて刷新する。

## Phase 0 実施結果

### 境界ごとの再分類サマリ

| 境界            | 対象ID                                        | 主な論点                                                                                                   |
| --------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 基盤/共通       | 1,2,5,6,8-15,17,19-27,30,31,34,35,47,48,74-76 | ドメイン層がインフラ・ランタイム依存や Layer 組み立てを保持しており、ポートと Composition への分離が必要。 |
| Inventory       | 3,36,39,45,46                                 | CQRS DTO や自動保存/バックアップなどアプリ層・インフラ責務がドメインへ流入。                               |
| Chunk           | 18,28,38,40,78,79,94,96,97                    | 環境検出・メトリクス・CQRS・待機制御が Domain 内で完結し、ポート化とアプリ層移管が未実施。                 |
| ChunkLoader     | 56,81,82,92                                   | ロード戦略や乱数/観測を Domain chunk_loader が内製し、アプリケーションとの差分制御ができていない。         |
| World           | 16,41-55,71-73,84                             | World BC が他 BC やアプリサービスを再輸出し、設定オブジェクトに技術的詳細が混入。                          |
| WorldGeneration | 29,32,37,49,50,57,59,60,64-70,80,89,90,98-100 | World/Chunk への結合と圧縮・テンプレート・スケジューリング等のインフラ実装が Domain に残存。               |
| Biome           | 33,61-63,95                                   | World 依存と Node API 利用が残り、待機制御やユーティリティの分離が未完了。                                 |
| Physics         | 7,58,83                                       | Cannon-es 制御やパフォーマンス計測を Domain が扱い、観測層との分離が不足。                                 |
| Scene/Camera    | 4,77,85-87,91                                 | Presentation ロジックと CQRS ハンドラが Domain Scene/Camera に常駐。                                       |
| ViewDistance    | 88                                            | LOD 判定がパフォーマンスメトリクスに依存し、環境差分の注入ポイントが未整備。                               |
| Furniture       | 93                                            | 家具アプリケーションサービスが Domain 内に存在し、ユースケース層との境界が不明瞭。                         |

### 境界別フォーカス

- **基盤/共通**（1,2,5,6,8-15,17,19-27,30,31,34,35,47,48,74-76）: 永続化・暗号・ランタイム API などの副作用を Port へ抽象化し、Domain から `Layer.effect`・環境判定・構成選択を排除する。
- **Inventory**（3,36,39,45,46）: コマンド DTO・自動保存・バックアップ・Layer 初期化を Application/Infrastructure へ移し、Domain には集約と契約のみ残す。
- **Chunk**（18,28,38,40,78,79,94,96,97）: 環境検出と待機/GC/パフォーマンス制御を排除し、CQRS/ReadModel をアプリ層へ移管する。
- **ChunkLoader**（56,81,82,92）: ロード戦略・乱数・観測処理をアプリ層ユースケースに集約し、Domain はキュー状態とポート契約を定義する。
- **World**（16,41-55,71-73,84）: 他 BC の再輸出とアプリサービス依存を禁止し、設定オブジェクトから技術パラメータを排除する。
- **WorldGeneration**（29,32,37,49,50,57,59,60,64-70,80,89,90,98-100）: 圧縮/テンプレート/スケジューリングをポート化し、World・Chunk 型への直接依存を DTO/イベントに置換する。
- **Biome**（33,61-63,95）: World 依存を分離し、Node API・擬似待機処理をインフラへ移す。
- **Physics**（7,58,83）: Cannon-es 操作とメトリクス更新をアプリ層のポート経由に切り替え、Domain は物理ルールに専念する。
- **Scene/Camera**（4,77,85-87,91）: プレゼンテーション例と Scene 管理ロジックをアプリ層へ移し、Domain は状態モデルとイベントだけを提供する。
- **ViewDistance**（88）: メトリクスを引数でもらうポートに差し替え、Domain 値オブジェクトから環境依存情報を排除する。
- **Furniture**（93）: アプリケーションサービス実装を Infrastructure/Application へ移し、Domain は家具ロジックとイベント契約に限定する。

### ドメイン純粋化テンプレート

```md
# 境界 / 集約名

## 1. 現状把握

- 目的とユビキタス言語: サバイバルと建築のゲームループを軸に、探索→採掘→クラフト→戦闘→再建築という循環を共通語彙として採用。Player / Chunk / World / Inventory / Block / Biome / Scene / FeatureFlag などの名称をユビキタス言語として整理し、API とドキュメントの双方で同じ語を使用している。
- 主要エンティティ / 値オブジェクト: PlayerAggregate・PlayerLifecycle、InventoryAggregate・ItemStack、BlockDefinition・BlockState、ChunkAggregate・ChunkSnapshot、WorldDomainConfig・WorldMetadata、BiomeId・BiomeClimate、GenerationSession・FeatureFlags など、`src/domain` 配下の各 BC が保持する集約と VO がユースケースを支えている。
- 現在の副作用・外部依存: Domain 層には `Effect.gen`/`Layer` による DI 構築や `crypto.randomUUID`・`structuredClone`・`performance.now` の直接利用が残存し、Node バッファ/`zlib`・ブラウザ API（IndexedDB/localStorage/Performance API）・`cannon-es` など技術的詳細を直接参照するモジュールが散見される。
- 対応結果: Phase1 で Player / Block / Inventory 領域の現状棚卸しと調査結果を DDD_2.md に反映済み。境界再分類は `docs/design/bounded-contexts.md` を SSoT として参照開始。

## 2. 課題整理

- ドメインに残っている技術的詳細: 圧縮/暗号/乱数/GC 制御をはじめ、待機制御 (`Effect.sleep`) やパフォーマンス測定が Domain に残留しており、純粋なルールと副作用コードが混在している。
- 層違反や他 BC 依存: World ⇄ WorldGeneration ⇄ Biome 間で型・サービスの再輸出が続いており、Scene や ChunkLoader もアプリケーション層のロジックを Domain 配下に保持している。
- テストしづらい理由: 技術的詳細と `Layer` 構築が Domain に埋め込まれているため差し替えが難しく、モナディックな Effect の過剰利用により純粋なユニットテストが複雑化している。
- 対応結果: プレイヤー/インベントリ周辺での課題を整理して Phase2 以降の移設対象を確定。World/Generation/Biome など未着手領域は次フェーズのバックログへ移行。

## 3. 純粋化方針

- ドメインに残すロジック: ルール評価・状態遷移・制約検証・イベント発行などユビキタス言語に紐づく純粋計算のみを保持し、副作用・環境判定・スケジューリングはすべてポート越しの受け渡しに限定する。
- 抽象化するポートと期待する契約: RepositoryPort / PhysicsEnginePort / EnvironmentCapabilitiesPort / ObservabilityPort など、永続化・外部エンジン・環境検出・監視の契約を明文化し、戻り値は DTO と結果イベントに統一する。
- 移設するモジュール（アプリ / インフラ / Composition）: CQRS ハンドラ・スケジューラ・待機制御・バックアップ・メトリクス更新・テンプレート検索・FeatureFlag 切替などは Application/Infrastructure/Composition へ移し、Domain は純粋化したファクトリとポート定義のみを公開する。
- 対応結果: Inventory / Chunk では `createInventoryDomainLayer` と `createChunkDomainLayer` を導入済み。残りのポート抽象と統合方針は Phase2 バックログで追跡。

## 4. 実施タスク

| タスク                                           | ステータス | 備考                                                                                                                |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| ポート定義とシグネチャ確定                       | 進行中     | Inventory / Chunk で新ポートを導入済み。World / WorldGeneration / Biome / Scene 系は未整理。                        |
| ドメインから副作用コードを除去                   | 進行中     | `Effect.sleep`・`crypto.randomUUID`・`performance.now` 等が残存。バッファ圧縮・バックアップ処理も Domain 内に散在。 |
| Application 層でのコンポジション更新             | 部分完了   | Inventory / Chunk Loader は新構成へ移行済み。World / Biome / WorldGeneration の Composition は旧来構造。            |
| テスト整備（ドメイン単体 / ポートダブル / 受入） | 未着手     | ポートダブルを利用したユニット/統合テストの整備が未実施。回帰テスト計画のみ存在。                                   |

- 対応結果: Phase1 のスコープで Inventory / Block / Player 周辺の純粋化とバックログ整理を完了。残タスクは Phase2 以降の TODO として継続管理。

## 5. 完了条件

- ドメインの依存が Domain 内と宣言済みポートに限定されていることが静的解析で確認できる（Inventory / Chunk は達成、World 系が未達）。
- 主要ユースケースが Application 層でポートを束ねる形に統一され、Domain から `<Service>Live` や Layer 構築が排除されている。
- テストがポート差し替えだけで副作用を制御でき、Domain 単体テスト・ポートダブルテスト・受入テストの 3 層を自動化できる。
- 対応結果: Inventory / Chunk の依存方向は条件を満たしたが、World / Generation / Biome / Scene で未達。Phase2 完了時に再チェックを実施する計画を記録。
```

### DI / Layer 共通指針

- Domain は同期/非同期問わず純粋ロジックとポート定義のみを保持し、`Layer.*`/`Effect.*` の構成や外部 API 参照を禁止する。
- Application はユースケース単位でポートを組み合わせ、CQRS/スケジューリング/トランザクションを担うファサードを提供する。
- Infrastructure はポート実装を環境別に用意し、Node/Web/テスト差分は Composition ルートで明示的に注入する。
- Composition ルートは `Layer` 組み立て・環境判定・FeatureFlag を一箇所に集約し、Domain へコンフィグ値を直接渡さない。
- 監視・メトリクス・ログは `ObservabilityPort` などの横断ポートを経由し、Domain からはイベント/結果のみ通知する。
- テストではドメイン単体テスト（純粋ロジック）→アプリケーションテスト（モックポート）→エンドツーエンド（実装ポート）の順に適用し、差し替え可能性を検証する。

## Phase 1 実施結果

### 実施サマリ

- Inventory ドメインサービス（Transfer/Stacking/Validation/CraftingIntegration）の `Layer` 依存を除去し、`make*Service` ファクトリを導入。アプリケーション層で `Layer.effect` による提供へ統一。
- Block ドメインの `BlockFactoryLive` を `makeBlockFactory` へ置換し、`BlockRegistryLayer` はアプリケーション側で `Layer.effect` を通して注入する構成に調整。
- Inventory アプリケーション層 (`src/application/inventory/domain-layer.ts`) を更新し、新しいファクトリからサービス Layer を組み立てるよう変更。
- Inventory Repository の環境選択・初期化ロジックを Infrastructure 配下 (`src/infrastructure/inventory/repository/layers.ts`) へ集約し、ドメイン層から環境分岐・ライフサイクル操作を排除。

### 確認ポイント

| 項目                               | 対応内容                                                                    | 参照                                                                                         | 状態 |
| ---------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| Inventory ドメインサービスの純粋化 | `makeTransferService` 等のファクトリを導入し、アプリケーション層で Layer 化 | `src/domain/inventory/domain_service/*/live.ts`, `src/application/inventory/domain-layer.ts` | 完了 |
| Block Factory の純粋化             | `makeBlockFactory` を新設し、Domain から `Layer` 依存を除去                 | `src/domain/block/factory/block_factory.ts`, `src/domain/block/domain_service/registry.ts`   | 完了 |
| Repository 環境分岐の所在確認      | 環境選択/初期化処理が Infrastructure に集約されているか再確認               | `src/infrastructure/inventory/repository/layers.ts`                                          | 完了 |

## Phase 2 進捗

### 実施サマリ

- Chunk ドメインの Layer から CQRS/ReadModel を分離し、`createChunkDomainLayer` として純粋な依存注入ポイントを定義。CQRS 実装は `src/application/chunk/cqrs/` へ移動した。
- Chunk リポジトリの実装レイヤーをインフラ側 (`src/infrastructure/chunk/repository/layers.ts`) にまとめ、Domain は契約定義のみを公開。
- Chunk Loader のアプリケーションロジックを `src/application/chunk_loader/application/` へ移し、Domain からの再輸出を削除。
- `sleepUntil` や `Effect.sleep` を用いた待機処理をドメイン各所から除去し、アプリケーション層で制御する設計へ変更。
- IndexedDB リポジトリの疑似遅延を除去し、テスト/インフラで制御できるようにした。

### 確認ポイント

| 項目                                | 対応内容                                      | 参照                                                                    | 状態                                    |
| ----------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| Chunk ドメイン Layer の純粋化       | `createChunkDomainLayer` の導入と CQRS 移動   | `src/domain/chunk/layers.ts`, `src/application/chunk/cqrs/*`            | 完了                                    |
| Chunk Repository 実装のインフラ集約 | メモリ実装 Layer をインフラへ移設             | `src/infrastructure/chunk/repository/layers.ts`                         | 完了                                    |
| Chunk Loader アプリ層化             | `application` ディレクトリをアプリ層へ移動    | `src/application/chunk_loader/application/*`                            | 完了                                    |
| ドメイン内スリープの除去            | chunk 系・chunk_system の `Effect.sleep` 排除 | `src/domain/chunk/aggregate/chunk/*`, `src/domain/chunk_system/time.ts` | 進行中（GC メトリクスなど残タスクあり） |

## 1. ドメイン層にインフラ実装が常駐している

- 該当箇所: DDD.md 5.5「repository/」および 6.3–6.4 の `memory.ts` / `persistent.ts` 標準パターン、9.1 の Layer 統合例。
- 内容: ドメイン配下に `Layer.effect` を介した Repository 実装と IndexedDB 依存 (`IndexedDBService`) が配置され、Domain 層が永続化技術を直接参照している。
- 問題点: 「Domain → Domain のみ」とする 3.2 の依存制約に反し、インフラ変更時にドメイン構造の変更が必須になる。DDD の戦略的分離が形骸化し、テスト容易性も Layer 実装に縛られる。
- 対応方針: リポジトリは Domain で抽象インターフェースのみ公開し、IndexedDB などの具体実装は infrastructure/composition 配下へ移し、Effect Layer の組み立ては Application 層で注入する。
- 対応結果: Inventory / Chunk のリポジトリ実装を `src/infrastructure/**` へ移し、Domain にはポートのみ残す構成に変更済み。World / Biome / WorldGeneration のリポジトリは依然として `Effect.gen` と永続化実装を保持しており、Phase2 で `RepositoryPort` へ分離予定。

## 2. ドメイン層が DI/ライブ実装を抱え込んでいる

- 該当箇所: 4.3 inventory BC 構成における `inventory-service-live.ts`、5.4/5.5 の Layer ベース実装、9.1 の `CameraServiceLive` など。
- 内容: `<Service>Live` や Repository Live 実装がドメイン階層に常駐し、Effect Layer による依存解決が Domain フォルダ内で完結している。
- 問題点: 実行時構成は本来 Infrastructure 層の責務であり、Domain は抽象契約の提供に留めるべき。現在の構造では環境差分（テスト/本番）ごとにドメイン配下を編集する必要が生じ、関心分離を損なう。
- 対応方針: `<Service>Live` などのライブ実装を infrastructure 層へ移し、Domain にはサービス契約とテストダブルのみ残して Application 層で Layer/DI を構成する。
- 対応結果: `InventoryServiceLive` と `InputServiceLive` を Infrastructure 配下へ移動し、Domain は契約のみを提供する構造に変更済み（`src/infrastructure/inventory/service/inventory-service-live.ts`、`src/infrastructure/input/input-service-live.ts`）。さらに `makeTransferService` などのサービスファクトリを導入し、Inventory ドメインサービスの `Layer` 生成はアプリケーション層で実施するよう統一済み。

## 3. CQRS コマンド/クエリがドメイン層に滞在している

- 該当箇所: 7.3 inventory BC の `src/domain/inventory/types/commands.ts`・`queries.ts`。
- 内容: Command/Query DTO を Domain の型定義として保持し、Application 層の API サービスから直接参照している。
- 問題点: コマンドはユースケース境界の表現であり Application 層の語彙に属する。Domain が CQRS DTO に依存すると、ユースケース追加・変更ごとに Domain 型が揺れ、戦術的 DDD とユースケース設計の分離が崩れる。
- 対応方針: Command/Query DTO を Application 層へ移管し、Domain はユースケースが利用する集約・値オブジェクトに集中させ、境界越えのマッピングを Application サービス側で実施する。
- 対応結果: `InventoryCommand`/`InventoryQuery` 系 DTO とスキーマを `src/application/inventory/types/` 配下へ移動し、Application 層が `@application/inventory/types` を参照する構成に変更済み。Domain 側の `types/index.ts` からコマンド／クエリの再輸出を削除し、依存方向を Application → Domain に統一した。
- 追加対応: `WorldDomain.Config` の同期版エクスポートを撤廃し、`selectWorldDomainConfigSync` に一本化。互換目的で残っていた `defaultWorldDomainConfig` や関連コメントを削除し、Config 参照は layer 経由の取得に集約済み。

## 4. プレゼンテーション層の依存方向が自己矛盾

- 該当箇所: 3.2 依存制約（Presentation → Application）と 10.2 React 統合例。
- 内容: 10.2 の `InventoryPanel` は `InventoryService`（Domain）と `MainLayer` を直接参照し、Presentation 層から Domain 層へ依存が伸びている。
- 問題点: レイヤー制約の記述と実装ガイドのサンプルが矛盾し、UI 実装者が Application 層を経由しないアンチパターンを踏襲する恐れがある。イベント/状態同期の責務が UI 側に流れ込み、ユースケースロジックが散在する。
- 対応方針: React 統合例を Application 層ユースケースのファサード（例: `InventoryApplicationService`）経由に改訂し、Presentation 層が参照するのは DTO とイベントハンドラに限定する。Domain 層で行っている Layer 組み立ては Composition ルートへ移し、Hook/Adapter で UI イベントをユースケース呼び出しへ変換するガイドを整備する。
- 対応結果: `useGameUI` と Inventory ViewModel をアプリケーション層経由に切り替え、プレゼンテーションからドメインサービス・リポジトリへの直接参照を解消（`PlayerLifecycleApplicationService`/`InventoryManagerApplicationService`/`PlayerCameraApplicationService` 経由）。入力系も `@application/input` を介した依存に統一した。

## 5. Bounded Context 境界が技術基準に偏重

- 該当箇所: 4.2「Bounded Context一覧」。
- 内容: `camera`・`chunk`・`world_generation`・`physics` など、エンジン技術やサブシステム単位で BC を定義し、26 BC 中 19 個は「その他」とだけ示されている。
- 問題点: ユビキタス言語に基づく業務ドメインのまとまりが不明確で、技術的関心ごとに境界を切っている。コンテキスト境界の重複や責務の欠落が発生しやすく、チーム分割やモデル整合性の指針として機能しない。
- 対応方針: イベントストーミングでプレイヤー体験と業務語彙を整理し、ユースケース起点の Bounded Context を再定義する。技術モジュールは各 BC の内部モジュールへ収容し、BC 一覧にはユビキタス言語による名称・責務・代表ユースケースを記載して「その他」区分を撤廃する。
- 対応結果: プレイヤー体験を軸に 6 つのユースケース別コンテキストを再定義し、既存モジュールの収容先を明確化した。旧「その他」区分は廃止し、下表を SSoT として docs/design 配下にも反映する。

| 新境界               | 主な責務                                         | 既存モジュールの収容先                                                             | 代表ユースケース                                           |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| サバイバル体験       | プレイヤー状態遷移・戦闘・装備管理・行動制御     | `player`, `combat`, `equipment`, `interaction`, `entities`                         | スポーン/死亡/リスポーン、ダメージ計算、装備切替           |
| アイテム経済         | 資源取得・インベントリ・クラフト・建築要素の管理 | `inventory`, `crafting`, `block`, `materials`, `furniture`, `agriculture`          | アイテム取得、クラフト検証、自動整列、家具設置             |
| ワールド運営         | ワールド状態管理・チャンク読み込み・距離制御     | `world`, `chunk`, `chunk_loader`, `chunk_manager`, `chunk_system`, `view_distance` | チャンクロード、保存、LOD 調整、バックアップ               |
| プロシージャル生成   | 地形/バイオーム/構造物生成とテンプレート運用     | `world_generation`, `biome`                                                        | 地形パイプライン組成、バイオーム判定、生成テンプレート選択 |
| シミュレーション基盤 | 物理・メトリクス・ゲームループの統制             | `physics`, `performance`, `game_loop`                                              | 物理ステップ更新、メトリクス収集、バックプレッシャー制御   |
| 体験統合             | 入力/シーン/カメラの状態同期とアダプタ           | `input`, `scene`, `camera`                                                         | UI とユースケースの橋渡し、ビュー構成、入力マッピング      |

- 次アクション: doc/INDEX とロードマップを上記境界に沿って再編し、`src/domain` のディレクトリ構成も段階的に新境界へ合わせる（Phase 2 で Chunk/World 系、Phase 3 で Generation/Biome 系を移設）。

## 6. ドメインのロジックが Effect/Schema に過度依存

- 該当箇所: 5.2 aggregate／5.3 value_object の実装パターン。
- 内容: 集約操作でも `Schema.decodeUnknown`・`Effect.gen` を多用し、純粋なドメイン演算が副作用コンテキスト越しでなければ成立しない設計になっている。
- 問題点: 単純なドメイン計算が Effect に包まれ、テストやリファクタリング時にモナディック制御が必須となる。ユビキタス言語で表現されるルールよりライブラリ API が前面に出てしまい、ドメインモデルの意図が読み取りづらい。
- 対応方針: Schema/Effect は入力検証と副作用境界に限定し、集約操作は純粋関数 `calculate*` 系へ分離する。`Effect.gen` を多用するサービスは Application 層へ持ち上げ、Domain ではポート経由の値変換とルール評価のみを担う構造に改修する。
- 対応結果: Player / Inventory の主要操作は純粋関数へ移行済みだが、Chunk / WorldGeneration / Biome / Camera などでは `Effect.gen` が残存（例: `src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts`）。Phase2 で集約別の `calculate*` 関数化を実施する。

## 7. 物理ドメインが Cannon-es を直接操作

- 該当箇所: `src/domain/physics/service/cannon.ts:4` 以降。
- 内容: ドメインサービス `makeCannonPhysicsService` が `cannon-es` の `World` 生成や剛体管理を直接行い、マテリアル・レイキャスト・ボディ更新などインフラ依存の手続きを内包している。
- 問題点: 物理エンジンという技術的詳細がドメイン層に漏出し、別実装（例: PhysX）へ差し替える際にドメインコード全体が巻き込まれる。イベントや計算ルールといった純粋なモデル表現が技術 API 操作に埋もれる。
- 対応方針: 物理演算の契約を表す `PhysicsEnginePort` を Domain 層で定義し、`cannon-es` 依存コードは Infrastructure 層のアダプタへ移設する。マテリアルや設定は値オブジェクト化してポート引数に渡し、Composition 層でエンジンごとの差し替えができる Layer 構成にする。
- 対応結果: `PhysicsEngine` 抽象ポートを導入し (`src/domain/physics/service/engine.ts`)。プレイヤー/地形/衝突サービスは同ポート経由で物理演算を実行し、`cannon-es` 実装は `PhysicsEngineCannonLive` (`src/infrastructure/physics/cannon-engine.ts`) に隔離済み。

## 8. ドメインリポジトリがブラウザ API を直接利用

- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:109` 以降。
- 内容: `InventoryRepositoryPersistent` が `localStorage` への読み書きを直に実装し、JSON パースや `setItem`、オートセーブ処理まで抱え込む。
- 問題点: ブラウザ環境固有の IO を扱うことでドメインが実行環境に固着し、テスト時のモックや他プラットフォームへの移行が困難になる。本来は Infrastructure 層で管理すべき責務。
- 対応方針: `InventoryRepository` は永続化ポートを抽象契約として保持し、`localStorage` 操作は Infrastructure 層の `InventoryRepositoryLocalStorageAdapter` に閉じ込める。ブラウザ API への依存は Composition 層で注入し、Domain は永続化結果のイベントと例外制御に専念できるよう責務を整理する。
- 対応結果: `InventoryRepositoryPersistent` を `src/infrastructure/inventory/repository/inventory/persistent.ts` へ移動し、ブラウザ固有 API をインフラ層に閉じ込めた。ドメイン層は抽象ポートとメモリ実装のみを保持する構造へ整理。

## 9. ドメインリポジトリが Node.js ファイルシステムへ依存

- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:36` 以降。
- 内容: `ItemDefinitionRepositoryJsonFile` が `require('fs')` や `path` を用いたファイル IO、バックアップ生成、ディレクトリ作成を行っている。
- 問題点: Node.js のファイルシステム API が Domain 層に入り込み、サーバー／クライアント双方で同一コードを共有する設計が破綻する。永続化手段の差し替えにも大規模なドメイン改修が必要になる。
- 対応方針: ファイル IO やバックアップ処理はインフラ層へ移設し、Domain には ItemDefinition リポジトリのポートとエンティティ変換だけを残す。
- 対応結果: JSON ファイル実装を `src/infrastructure/inventory/repository/item_definition/json-file.ts` へ分離し、ドメイン層から Node.js API 依存を排除済み。

## 10. ドメインが Application 層を再輸出

- 該当箇所: `src/domain/equipment/types.ts:1`。
- 内容: `src/domain/equipment/types.ts` が `EquipmentServiceLive` など Application 層の Layer をそのまま再輸出している。
- 問題点: Domain 公開 API が Application 実装への窓口となり、Onion アーキテクチャで定義した依存方向を逆流させている。
- 対応方針: Domain エントリポイントは集約・値オブジェクト・ポートの公開に限定し、`EquipmentServiceLive` は Application/Composition 側でユースケースファサードとして組み立て直す。既存参照も Facade 経由に移行して境界責務を明示する。
- 対応結果: `src/domain/equipment/types.ts` から Application 層 Layer の再輸出を撤廃し、ドメイン API をドメイン内部の型・集約に限定した。

## 11. ドメイン層で実行環境による実装切り替えを実施

- 該当箇所: `src/domain/inventory/repository/layers.ts:17-118`。
- 内容: `InventoryRepositoryLayers.auto` などが `window`・`localStorage`・`process` を参照し、ブラウザ/Node.js を判別して永続化方式を選択している。
- 問題点: 実行環境検出と構成選択は Infrastructure/Composition 層の責務であり、ドメインがプラットフォーム条件分岐を持つと再利用性とテスタビリティが低下する。ユースケースごとの Layer 差し替えもドメインファイルの編集を伴ってしまう。
- 対応方針: 実行環境判定と Layer 構成をブートストラップコードへ抽出し、Domain 層では `InventoryRepositoryPort` など抽象依存だけを宣言する。ブラウザ/Node の分岐は DI コンテナや設定モジュールで解決し、Domain ファイルに環境条件分岐が現れないよう整理する。
- 対応結果: Inventory ドメインから環境判定ロジックを排除し、`InventoryRepositoryLayers.auto` は `src/infrastructure/inventory/repository/layers.ts` へ移設済み。World/Generation 系には `navigator.hardwareConcurrency` などの分岐が残るため、Phase3 で `EnvironmentCapabilitiesPort` に集約する。

## 12. ドメインリポジトリがブラウザ API の利用可否を直接判定

- 該当箇所: `src/domain/chunk/repository/strategy/repository_strategy.ts:88-154`、`src/domain/inventory/repository/container_repository/persistent.ts:80` 付近。
- 内容: `window`・`indexedDB`・`Worker`・`navigator.connection` などブラウザ固有 API の存在確認や性能推定をドメインロジックに組み込んでいる。
- 問題点: プラットフォーム診断がドメイン層に常駐し、ビジネスルールより環境依存コードが主導する構造になっている。別環境（サーバー/テスト）では分岐が破綻し、DDDの普遍的なモデル表現から乖離する。
- 対応方針: ブラウザ API の機能検出を `EnvironmentCapabilitiesPort` として抽象化し、インフラ層で `indexedDbAvailable` や `workerThreadsAvailable` 等のフラグを提供する。Domain 側は受け取った能力フラグを基に戦略を切り替え、実際の API 判定コードを保持しない。
- 対応結果: Inventory / Chunk の戦略判定は Application 側の Port へ移設済み。WorldGeneration でも `HardwareProfileService` ポートを導入し、`navigator.hardwareConcurrency` 依存を解消。構成ビルダーはポート経由でハードウェア情報を取得する構造へ移行した。

## 13. ドメインリポジトリが複数の永続化詳細を抱え込み過ぎている

- 該当箇所: `src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts:42` 以降、`src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:23` 以降、`src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27` 以降。
- 内容: IndexedDB のオープン手続きや Node.js ファイルシステム（`fs`/`path`）を直接操作しており、永続化戦略ごとにドメイン配下へ実装が増殖している。
- 問題点: ポート/アダプタの境界が不明瞭で、インフラ選択を変更するたびにドメインコードが巻き込まれる。また Node.js API を含むため共有ライブラリとしての利用（ブラウザ・ワーカーなど）が制限される。
- 対応方針: 永続化戦略を `ChunkPersistencePort` 等のポートに整理し、IndexedDB/Node FS 実装は infrastructure 層のアダプタへ移設する。Domain はポート選択のポリシーとモデル整合性のみ保持し、実装追加はアダプタ新設で完結させる。
- 対応結果: Inventory / Chunk の永続化実装はすべて `src/infrastructure/**/repository` へ移設済みで Domain 側にはポートのみ残存。World / Biome / WorldGeneration はまだドメイン配下に `*implementation.ts` が存在するため（例: `src/domain/world_generation/repository/generation_session_repository/session_recovery.ts`）、Phase3 で統一した Port/Adapter へ移行する。

## 14. ドメインでハードウェア検出が行われている

- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/configuration.ts:176-211`。
- 内容: `detectHardwareSpec` が `navigator.hardwareConcurrency` などブラウザ固有 API を直接参照し、CPU コア数等を推定している。
- 問題点: ハードウェア/環境検出はインフラ層やブートストラップで行うべきであり、ドメインがプラットフォーム API に依存すると他環境（サーバー、テスト）での利用が破綻する。ユースケースの純粋なルールが環境依存ロジックに埋もれる。
- 対応方針: ハードウェア検出は起動時の `RuntimeProfileProvider` に集約し、Domain へはスレッド数や並列度など抽象設定値のみを注入する。テスト環境では固定値を与えられるようポート経由に改修し、環境依存ロジックをドメインから排除する。
- 対応結果: 完了。`HardwareProfileService` ポートを追加し、ハードウェア検出は外部サービスから注入する設計に変更。ドメイン側はデフォルト値のみ保持し、実際の検出はアプリケーション層 (`BrowserHardwareProfileServiceLive`) が担当する。

## 15. ドメインがブラウザの Performance API に依存

- 該当箇所: `src/domain/performance/memory_schema.ts:1-120`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-495` など。
- 内容: `performance.memory` や `performance.now()` をドメイン層が直接呼び出し、メトリクス測定や最適化判定を行っている。
- 問題点: 実行プラットフォーム固有の API をドメイン側が意識する形になり、テストダブル差し替えや環境非依存な評価が難しくなる。計測・監視はアプリケーション/インフラ層に委ね、ドメインには抽象化された時間・計測ポートを渡すべき。
- 対応方針: 計測 API への依存を抽象化したタイマー/メモリ監視ポートに置換し、Effect/time 測定はアプリケーション・インフラで実装する。
- 対応結果: 未着手。`src/domain/performance/memory_schema.ts` と `src/domain/biome/domain_service/biome_classification/*` に `performance.now` が残存しており、Phase4 で `ObservabilityPort` と `ClockPort` へ置換予定。

## 16. World BC が World Generation BC を再輸出

- 該当箇所: `src/domain/world/repository/index.ts:12-47`。
- 内容: World リポジトリのインデックスが `world_generation` のリポジトリ実装と設定型をそのまま re-export し、`world` BC の外へ公開している。
- 問題点: Bounded Context 間の境界が事実上消え、World BC を利用する側が World Generation の内部契約に直接依存してしまう。コンテキスト境界の互換性保証や独立進化が阻害され、DDD のコンテキスト分離が形骸化する。
- 対応方針: World BC の公開 API を再設計し、他 BC の実装を再輸出せずにポート経由で連携させ、相互依存は Application 層が調停する。
- 対応結果: 未着手。`src/domain/world/factory/index.ts` や `src/domain/world/domain_service/layer.ts` が引き続き world_generation のファクトリ/Layer を import しており、Phase3 の World/Generation 再設計で解消する。
- 対応結果: 未着手。World 集約/ファクトリは依然として `@/domain/world_generation/*` を import しており（例: `src/domain/world/factory/index.ts`）、Phase3 の World/Generation 再設計で分離予定。

## 17. Domain 層で Layer 組み立てと構成選択を担っている

- 該当箇所: `src/domain/world/layers.ts:1-84`。
- 内容: World Domain Layer が Repository 実装の選択（`memory`/`mixed`/`persistence`）、他 BC（world_generation・biome）との Layer 組み合わせ、構成モード（default/performance/quality）の解決まで行っている。
- 問題点: 実行時構成や他 BC の束ねは Application/Bootstrap 層の責務であり、Domain が環境モードや依存 Layer を組み立てると関心が混在し、ユースケース側での柔軟な構成変更が困難になる。
- 対応方針: Layer 組み立て・モード選択は Application/Bootstrap 層のコンポジションに移し、Domain 層では必要なポート定義とデフォルト構成情報のみに留める。
- 対応結果: 未着手。`createWorldDomainLayer` が引き続き Layer.mergeAll で依存組み立てを担っており、Phase3 で Application 層の Composition へ移管する。

## 18. Chunk リポジトリ戦略が環境検出と WebWorker 制御を内包

- 該当箇所: `src/domain/chunk/repository/strategy/repository_strategy.ts:42-340`、`webworker_implementation.ts:5-12`。
- 内容: Domain 内で `window`・`self`・`Worker`・`indexedDB` の存在チェックを行い、WebWorker 実装や永続化方式を自動選択している。WebWorker 専用 Layer も Domain 配下に存在。
- 問題点: 実行環境に応じた実装切り替えはインフラ層のポリシーであり、Domain に WebWorker/ブラウザ固有の分岐が入ると他プラットフォームやテストで再利用しづらい。ポート/アダプタ境界が崩れる。
- 対応方針: 環境検出と WebWorker 選択をインフラ層のストラテジー/ファクトリに分離し、Domain には永続化ポートと選択結果を渡すだけにする。
- 対応結果: Domain 側のリポジトリ再輸出からストラテジー／環境検出コードを排除し、`src/infrastructure/chunk/repository/layers.ts` にメモリ実装 Layer を集約。WebWorker 含む実装選択はインフラ層で行い、Domain には契約のみ残した。

## 19. Domain レベルの設定にインフラ詳細が混入

- 該当箇所: `src/domain/world/repository/index.ts:31-76`、`world_metadata_repository/interface.ts:1-160`。
- 内容: Domain の設定型が `compression.algorithm`（gzip/brotli 等）、`backup`、`storage.type`（memory/persistence）など技術的パラメータを保持し、Repository インターフェースでも圧縮やバックアップ戦略が前提になっている。
- 問題点: Domain モデルが永続化テクノロジーや運用ポリシーに固着し、実装差し替え時にドメイン型自体を変更せざるを得なくなる。DDD のポート/アダプタ分離やモデリングの独立性が損なわれる。
- 対応方針: Domain の設定型から技術的パラメータを排除し、圧縮方式やバックアップといった詳細はインフラ構成オブジェクトへ移動させる。
- 対応結果: 未着手。`WorldRepositoryLayerConfig` などが引き続き圧縮/バックアップ設定を保持しており、Phase3 で `WorldRepositoryPort` とインフラ設定 DTO を分離する。

## 20. Domain サービスがロギングを直接実行

- 該当箇所: `src/domain/physics/service/cannon.ts:206-500`、`src/domain/world_generation/domain_service/world_generation_orchestrator/*.ts`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-513` など。
- 内容: `Effect.logInfo`/`Effect.logWarning`/`Effect.logError` を通じて Domain 内でログ出力・メトリクス記録を行っている。
- 問題点: ロギングは技術的横断関心であり、Domain ロジックに組み込むと純粋性が失われる。テスト時に副作用抑制が必要になり、ユースケース側でのロギング方針変更が困難になる。
- 対応方針: ロギングは Logger ポートを介してアプリケーションから注入し、Domain では副作用を発生させずにイベントや結果のみを返す。
- 対応結果: 未着手。`src/domain/physics/service/terrain_adaptation.ts` や `src/domain/world_generation/domain_service/world_generation_orchestrator/dependency_coordinator.ts` に `Effect.log*` 呼び出しが残存しており、Phase3〜4 で Logger ポートへ移行する。

## 21. Node.js 固有のメモリ API へ依存

- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:734-775`。
- 内容: クエリ性能計測で `process.memoryUsage()` を直接呼び、ヒープ差分を算出している。
- 問題点: `process` は Node.js 専用 API のため、ブラウザや Worker では動作せず、Repository が実行環境と結び付いてしまう。性能監視はインフラ層に切り出すべき。
- 対応方針: メモリ計測はモニタリング用のポートを定義し、Node/ブラウザ実装をインフラ側で用意して Domain には抽象化された計測値を注入する。
- 対応結果: 完了。Domain 配下から `process.memoryUsage` の呼び出しを削除し、メモリ監視は Application 層 (`src/application/world/progressive_loading/memory_monitor.ts`) へ移行済み。

## 22. ドメインリポジトリが待機シミュレーションを行う

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/memory_implementation.ts:900-906`、`session_recovery.ts:166`。
- 内容: セッション復旧やリカバリ分析で `Effect.sleep` を直接実行し、擬似的な待機時間を挿入している。
- 問題点: 実際のスケジューリングや遅延シミュレーションはアプリケーション/インフラ側の責務であり、ドメインが時間制御を持つとテストや別環境での再利用が困難。
- 対応方針: 待機処理はアプリケーション層のジョブスケジューラへ移し、Domain は遅延の必要性をイベントやフラグで伝えるだけに留める。
- 対応結果: 未着手。`session_recovery.ts` に `Effect.sleep` が残存しており、Phase3 でリカバリジョブを Application のスケジューラへ移管する。

## 23. `structuredClone` などブラウザ API 前提のコピー処理

- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:498`、`memory.ts:270`、`container_repository/persistent.ts:458`、`world_generation/domain_service/world_generation_orchestrator/error_recovery.ts:324-344` など。
- 内容: 状態スナップショットの複製に `structuredClone` を使用しており、ブラウザ実装を前提にしている。
- 問題点: Node.js や一部環境では未実装のため、純粋なデータコピー手段を Domain 層に持たせると互換性が崩れる。シリアライズ/コピーはインフラ抽象を介すべき。
- 対応方針: データ複製はシリアライザーポートに委譲し、Domain では純粋なデータ構造操作を行い、環境依存のコピー手段はインフラ側で差し替える。
- 対応結果: Inventory 系の `structuredClone` はインフラへ移動済み。WorldGeneration でも `CloneService` ポートを導入し、`error_recovery.ts` の複製処理を抽象化した（`CloneService` のデフォルト実装はブラウザ API 非依存）。

## 24. ドメインが暗号化実装を直接扱う

- 該当箇所: `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:21-278`。
- 内容: Node の `crypto` モジュールで AES 暗号・復号を実装し、鍵管理まで担っている。
- 問題点: セキュリティ実装はインフラ/アプリケーション層の責務であり、Domain が暗号モジュールに依存すると環境に縛られるうえにセキュリティ要件の差し替えが難しい。
- 対応方針: 暗号化・鍵管理はセキュリティポートを介してインフラ層に委任し、Domain では暗号化されたデータ契約とエラー処理のみを扱う。
- 対応結果: 完了。Domain から暗号実装が削除され、暗号化は `src/infrastructure/world/repository` 側のアダプタで扱う構成に移行済み。

## 25. Web Crypto 依存のハッシュ計算

- 該当箇所: `src/domain/chunk/domain_service/chunk_validator/service.ts:154-156`、`chunk_serializer/service.ts:436-438`。
- 内容: チャンク整合性検証に `crypto.subtle.digest` を直接呼び出し、Web Crypto API を仮定している。
- 問題点: Web Crypto が存在しない Node などでは失敗する。ハッシュ計算はポート化してインフラで差し替えられるようにするべき。
- 対応方針: ハッシュ計算ポートを定義し、Web Crypto/Node Crypto など複数実装をインフラ側で提供することで Domain からランタイム依存を排除する。
- 対応結果: 未着手。`chunk_serializer/service.ts` で `crypto.subtle.digest` を直接利用しており、Phase2 で `HashingPort` を導入する。

## 26. Node Buffer / zlib による圧縮処理をドメインが所有

- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:3-4`。
- 内容: `node:buffer` や `node:zlib` を import し、Brotli/GZip 圧縮を直接実装している。
- 問題点: 圧縮アルゴリズムの選択・実行は技術的詳細であり、Domain 層が Node 専用 API に依存するとブラウザ移植が不可能になる。
- 対応方針: 圧縮・展開は圧縮ポート経由で扱い、具体的なアルゴリズム選択とバッファ操作はインフラアダプタに委任する。
- 対応結果: 未着手。`ChunkSerializationService` が `node:zlib` を直接利用しており、Phase2 で `CompressionPort` を導入する。

## 27. ガーベジコレクタ呼び出しをドメインで実行

- 該当箇所: `src/domain/chunk/aggregate/chunk/composite_operations.ts:468-481`、`chunk/performance_optics.ts:437-452`。
- 内容: メモリ最適化処理で `global.gc?.()` を呼び、ランタイム GC を直接起動している。
- 問題点: GC 制御はランタイム依存の技術詳細であり、Domain ロジックがこれを持つとテストや異なる VM で破綻する。
- 対応方針: メモリ回収要求はイベントやメトリクスとして通知し、GC トリガーはインフラ/運用層で制御する。
- 対応結果: 未着手。`src/domain/chunk/aggregate/chunk/performance_optics.ts` に `global.gc` 呼び出しが残存しており、Phase2 でパフォーマンス通知イベントへ置換する。

## 28. IndexedDB リポジトリが人工遅延を注入

- 該当箇所: `src/domain/chunk_system/repository.indexeddb.ts:12-33`。
- 内容: `simulateLatency` で `Effect.sleep(Duration.millis(2))` を必ず実行し、疑似的な I/O 待機を再現している。
- 問題点: 遅延シミュレーションはテスト専用のインフラ関心であり、Domain の Repository 実装に組み込むと本番・テスト双方で制御できない。
- 対応方針: 疑似遅延はテスト用アダプタや Application 層のテストダブルで注入し、Domain の永続化処理からは外す。
- 対応結果: `simulateLatency` を純粋な透過関数へ変更し、ドメインリポジトリから固定待機を排除。遅延シミュレーションはアプリケーション/テスト側で必要時に注入する前提に改めた。

## 29. ワールド生成パイプラインが固定スリープを持つ

- 該当箇所: `src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts:474-517`。
- 内容: 各ステージで `Effect.sleep(Duration.millis(...))` を直接呼び、処理時間をハードコードしている。
- 問題点: ビジネスロジックとスケジューリングが混在し、テストで高速化できない。スリープ制御はインフラ層の責務。
- 対応方針: ステージの待機制御はスケジューラポートを介して Application 層に任せ、Domain は進行状態と要求タイミングのみを指示する。
- 対応結果: 完了。ステージ実装から `Effect.sleep` を除去し、スケジュール制御はアプリ層に委ねる前提へ変更した（`generation_pipeline.ts`）。

## 30. CommonJS `require` 前提のファイルアクセス

- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:43-89`。
- 内容: `typeof require !== 'undefined'` で CommonJS 可否を判定し、`require('fs')` / `require('path')` に依存。
- 問題点: ES Modules やブラウザ環境では `require` が存在せず、Domain がモジュールシステムに依存してしまう。
- 対応方針: ファイルアクセスは抽象ポート越しに行い、CommonJS/E SM の分岐やモジュール解決はインフラ層のアダプタで処理する。
- 対応結果: 完了。JSON ファイル実装は `src/infrastructure/inventory/repository/item_definition/json-file.ts` に移設され、Domain 側に `require` 分岐は残っていない。

## 31. `TextEncoder` など Web API によるサイズ計測

- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:90-309`、`src/domain/world/repository/world_metadata_repository/interface.ts:799` など。
- 内容: バイト長推定に `TextEncoder` を直接利用し、Web API の存在を前提としている。
- 問題点: Node のバージョン差や他ランタイムで互換性が保証されず、Domain モデルの計測が環境依存となる。
- 対応方針: エンコード/サイズ計測ポートを定義し、ブラウザ・Node それぞれの実装をインフラ側に切り出して Domain は抽象化されたインターフェースを利用する。
- 対応結果: 未着手。`chunk_serializer/service.ts` と `world_metadata_repository/interface.ts` に `TextEncoder` が残存し、Phase2 で `EncodingPort` へ移行予定。

## 32. ワールド生成リポジトリが Node バッファと zlib を直接利用

- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/persistence_implementation.ts:21-300`。
- 内容: `node:buffer`・`zlib` を import し、圧縮／展開やバイナリ処理をその場で行っている。
- 問題点: Node 専用 API により、Domain 層がランタイムと密結合し、他環境への移植やテストダブル差し替えが困難。
- 対応方針: バッファ操作・圧縮処理はインフラアダプタへ移し、Domain では圧縮結果の契約とバリデーションのみに集中する。
- 対応結果: 概ね完了。世界生成リポジトリの Node 依存コードは `src/infrastructure/world_generation/repository` へ移設済みで、Domain 側にはポート定義のみが残る。

## 33. バイオームリポジトリも Node ファイルシステムへ依存

- 該当箇所: `src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27-232`。
- 内容: `fs`・`path`・`zlib` を使って JSON 圧縮・バックアップを実装。
- 問題点: こちらも Domain がリソース I/O と圧縮を直に担っており、Bounded Context 全体が Node 依存になる。
- 対応方針: リソース I/O と圧縮の責務を分離し、Domain はポートを通じてデータの保存/取得を要求するだけにする。
- 対応結果: 完了。該当実装は `src/infrastructure/biome/repository` へ移行し、Domain 側はポート定義とエラー型のみに整理済み。

## 34. ドメインが `crypto.randomUUID` で ID を生成

- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:437`、`generation_session_factory/factory.ts:452`。
- 内容: 生成 ID を `crypto.randomUUID()` で直接生成している。
- 問題点: ID 生成はインフラポートとして外出しすべきであり、ランタイム依存の関数を Domain が直接呼ぶとテスト時の決定性や差し替えが難しい。
- 対応方針: ID 生成サービスをポート化し、テスト用の決定的実装と本番用のランダム実装をアプリケーション/インフラ層から注入する。
- 対応結果: 未着手。`world_generator_factory` と `generation_session_factory` で `crypto.randomUUID` が残っており、Phase3 で `IdGeneratorPort` を定義する。

## 35. ドメインイベントの識別子生成もランタイム依存

- 該当箇所: `src/domain/world/types/events/world_events.ts:518`、`lifecycle_events.ts:500-565`。
- 内容: イベント作成時に `crypto.randomUUID()` を直接利用。
- 問題点: イベント ID はドメイン固有の値オブジェクトとして扱うべきで、生成戦略はポート経由で切り替えられるようにする必要がある。
- 対応方針: イベント ID を値オブジェクト化し、生成は ID ポートを通じて行うように改修する。
- 対応結果: 未着手。World イベント作成で `crypto.randomUUID` を呼び出しており、Phase3 にて `DomainEventIdPort` を導入予定。

## 36. 自動保存スケジューリングをドメインが内包

- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:189-237`。
- 内容: `setupAutoSave` で `autoSaveInterval` を評価し、（コメントアウトとはいえ）`setInterval` によるスケジューリングを視野に入れている。
- 問題点: バックグラウンドジョブの実行制御はアプリケーション層の責務であり、Domain Repository が時間ベースの副作用を持つと関心の分離が崩れる。
- 対応方針: 自動保存はアプリケーション側のジョブ管理へ切り出し、Domain リポジトリは保存リクエストの受け付けと状態変換のみに集中する。
- 対応結果: `setupAutoSave` を含む永続化処理を Infrastructure 層 (`src/infrastructure/inventory/repository/inventory/persistent.ts`) へ移動し、Domain 側から時間制御コードを排除済み。今後はアプリケーションスケジューラから同ポートを利用して保存トリガーを注入する。

## 37. リポジトリの未実装メソッドがドメインに残存

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/memory_implementation.ts:914-933`。
- 内容: `archiveCompletedSessions` や `cleanupOldCheckpoints` が `Effect.succeed(0)` を返すスタブのまま。
- 問題点: Domain 契約を満たさないダミー処理が残ると、上位層が擬似的な成功に依存してしまい、モデリング上一貫性が確保できない。
- 対応方針: 未実装メソッドは Application/インフラ層の具体的な実装へ接続するか、不要であればインターフェース定義から削除し契約を再定義する。
- 対応結果: 完了。メモリ実装ファイルを廃止し、リポジトリの未実装メソッドを Interface 定義から整理済み（`generation_session_repository/index.ts` ではインフラ実装へ委譲）。

## 38. リポジトリがパフォーマンスメトリクスを保持

- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:720-771`。
- 内容: `performanceMetricsRef` にクエリ実行時間やメモリ使用量を蓄積し、監視機能まで担っている。
- 問題点: メトリクス収集は監視インフラの関心であり、Domain Repository が分析データを保持すると責務が肥大化する。
- 対応方針: メトリクス収集は監視サービスのポートに移し、Domain は必要なイベント/統計を通知するだけにする。
- 対応結果: 完了。Chunk クエリリポジトリのメトリクス保持コードを削除し、監視は Application 層の `@application/world/progressive_loading` 系サービスへ移設済み。

## 39. バックアップ生成をドメインが直接実行

- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:158-188`。
- 内容: `fs.copyFile` でバックアップファイルを作成し、失敗時には `console.warn` を出力。
- 問題点: バックアップ策略・ローテーションはインフラ制御であり、Domain 側でファイルコピーを行うと導入環境ごとに差し替えられない。
- 対応方針: バックアップ戦略はインフラ層へ外出しし、Domain からはバックアップ要求やメタデータのみを発行する。
- 対応結果: JSON ファイル実装を `src/infrastructure/inventory/repository/item_definition/json-file.ts` へ移動し、バックアップ生成とファイル I/O は Infrastructure で完結する構成に更新済み。

## 40. ドメインリポジトリがイベントキューを内製

- 該当箇所: `src/domain/chunk_system/repository.indexeddb.ts:14-30`。
- 内容: `Queue.unbounded` と `Stream.fromQueue` によりイベントブロードキャストを実装し、取得者へ `observe` を提供している。
- 問題点: イベント配送の仕組みはアプリケーション/インフラ側のメッセージングで扱うべきで、ドメインリポジトリが Pub/Sub を抱えると境界が曖昧になる。
- 対応方針: Pub/Sub はメッセージングポートとして外出しし、Domain リポジトリはイベントを発行するだけに絞る。`Queue`/`Stream` の組み立ては Application 層が担い、監視・購読ロジックは専用のイベントバスアダプタへ移管する。
- 対応結果: 未着手。`repository.indexeddb.ts` と `repository.memory.ts` が引き続き `Queue.unbounded` を生成しており、Phase2 でイベントバスポートを導入する。

## 41. World集約インデックスが他BCを再輸出

- 該当箇所: `src/domain/world/aggregate/index.ts:14-24`。
- 内容: World BC のエントリーポイントが world_generation BC の集約 (`WorldGenerator`, `GenerationSession`) をそのままエクスポートしている。
- 問題点: Bounded Context の境界が崩れ、World モジュール利用者が world_generation 内部の集約に直接依存する。コンテキスト独立性を失い、モデル進化時の影響範囲が制御できない。
- 対応方針: World BC の公開 API から他 BC の集約再輸出を除去し、必要な連携は Application 層が調停するドメインサービス経由に限定する。
- 対応結果: `src/domain/world/aggregate/index.ts` から world_generation 集約の再エクスポートを削除し、利用箇所は `@domain/world_generation/...` を直接参照するよう全面更新。World BC は自 BC (BiomeSystem 等) のみを公開し、境界を明確化した。

## 42. Worldドメインサービスが world_generation サービスを丸ごと公開

- 該当箇所: `src/domain/world/domain_service/index.ts:7-12`。
- 内容: World ドメインサービスのインデックスが world_generation のノイズ生成・手続き生成サービスをエクスポートしている。
- 問題点: World BC が他 BC のドメインサービスを外部 API として提供しており、境界付けられた文脈同士の独立性が損なわれる。
- 対応方針: World BC のサービス公開範囲を自 BC に閉じ、world_generation との橋渡しは専用アプリケーションサービスまたはアンチコラプションレイヤーで提供する。
- 対応結果: `src/domain/world/domain_service/index.ts` から world_generation への再エクスポートと依存項目を除去し、WorldDomainServices は世界固有サービス（検証・数学演算）のみに限定した。

## 43. Worldファクトリ層が world_generation ファクトリを再輸出

- 該当箇所: `src/domain/world/factory/index.ts:1-120`。
- 内容: World ファクトリの公開窓口が world_generation のファクトリ群をそのまま再輸出している。
- 問題点: world_generation の実装詳細が World BC から漏れてしまい、利用側が直接 world_generation の API に依存する構造になる。
- 対応方針: World BC のファクトリから他 BC のファクトリを排除し、必要な生成はアプリケーション層が統合する。
- 対応結果: World ファクトリのインデックスから world_generation 向け `export *` を削除し、内部利用時のみ明示的に import する構成へ変更。World BC の公開 API は自 BC のファクトリとヘルパーに限定した。

## 44. World値オブジェクトが Biome座標を直接再利用

- 該当箇所: `src/domain/world/value_object/coordinates/index.ts:6`。
- 内容: World BC の座標モジュールが biome BC の座標値オブジェクトを `export *` している。
- 問題点: World 側のユビキタス言語で定義すべき値が別 BC の型に固定され、コンテキスト固有のモデリングができない。
- 対応方針: World BC 固有の座標値オブジェクトを定義し、biome 座標との相互変換は境界サービスで扱う。
- 対応結果: 完了。World 値オブジェクトは `src/domain/world/types/core/coordinate_types.ts` に再定義され、biome 座標の再エクスポートは撤廃済み。

## 45. Inventory Repository Layer が環境別実装を内包

- 該当箇所: `src/domain/inventory/repository/layers.ts:205-331`。
- 内容: `Development/Browser/Server/Hybrid` などの Layer を Domain 内で組み立て、環境に応じた実装をマッチングしている。
- 問題点: 実行環境の選択ロジックは本来ブートストラップ層の責務であり、Domain が環境分岐を抱えると保守ポイントが分散する。
- 対応方針: Layer 構成と環境分岐をブートストラップ/Infrastructure 層へ移し、Domain は環境非依存のポート契約のみ提供する。
- 対応結果: 環境別 Layer 選択は `src/infrastructure/inventory/repository/layers.ts` で組み立てるよう変更し、Domain (`src/domain/inventory/layers.ts`) からは依存注入ポイントのみ残す構造に整理済み。

## 46. Inventory Repository が初期化/クリーンアップを直接制御

- 該当箇所: `src/domain/inventory/repository/layers.ts:333-360`。
- 内容: `initializeInventoryRepositories` / `cleanupInventoryRepositories` で複数リポジトリのライフサイクルを Domain 側がまとめて呼び出している。
- 問題点: データストアのセットアップやシャットダウンはアプリケーション層の関心であり、Domain が一括制御すると層分離が曖昧になる。
- 対応方針: 初期化/クリーンアップ手順はアプリケーション層のコンポジションルートへ退避し、Domain リポジトリは純粋に CRUD 契約を提供する。
- 対応結果: `initializeInventoryRepositories` / `cleanupInventoryRepositories` を Infrastructure 層の `src/infrastructure/inventory/repository/layers.ts` へ移設し、アプリケーションから明示的に呼び出す形へ切り替え済み。

## 47. リポジトリが直接システムクロックを参照

- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:135-220`。
- 内容: `Clock.currentTimeMillis` で保存時刻を取得し、DomainClock などの抽象を介さずにシステム時刻へ依存している。
- 問題点: テストや再現性確保のための時間抽象が無視され、環境差異に左右されるドメインロジックになる。
- 対応方針: 時刻取得は Clock ポートを通じて注入し、Domain からは直接システムクロックを参照しない。
- 対応結果: 完了。Inventory リポジトリのシステムクロック参照はインフラ層へ移り、Domain では `ClockPort` を通じた契約に統一した。

## 48. ドメインが乱数生成を直接使用

- 該当箇所: `src/domain/inventory/types/commands.ts:724-732` ほか各所。
- 内容: ID や仕様判定に `Random.nextIntBetween` を多用し、乱数サービスの差し替えを前提としていない。
- 問題点: ドメインルールが非決定的になり、テストやリプレイが困難。乱数生成はポートとして抽象化すべき。
- 対応方針: 乱数生成を専用ポートに切り出し、決定的なテスト実装と本番向け実装をインフラで差し替えられるようにする。
- 対応結果: 未着手。Biome 分類・Inventory イベント・Combat 計算などで `Random.next*` を直接利用しており、Phase3 で `RandomProviderPort` を導入予定。

## 49. キャッシュ戦略が Domain 内でスケジューリング

- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/cache_strategy.ts:338-339`。
- 内容: `Schedule.fixed` で定期クリーンアップを Domain に内包している。
- 問題点: バックグラウンド処理のスケジュールはアプリケーション/インフラの責務であり、Domain がジョブ管理まで抱えると責務が膨張する。
- 対応方針: キャッシュクリアはアプリケーション側のスケジューラに委ね、Domain はクリーンアップ要求をイベント等で通知する。
- 対応結果: 未着手。`cache_strategy.ts` で `Schedule.fixed` を生成しており、Phase3 でスケジューラポートへ抽象化する。

## 50. 世代セッション永続化が Node FS を直接使用

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:19-40`。
- 内容: `@effect/platform-node/NodeFileSystem` や `NodePath` を import してファイル操作を行っている。
- 問題点: Node 依存の I/O が Domain 層に入り込み、ブラウザや他環境へ移植できない。
- 対応方針: ファイル I/O は永続化ポートの実装としてインフラ層に移し、Domain はセッション保存の契約定義に専念する。
- 対応結果: 完了。ファイル I/O 実装は `src/infrastructure/world_generation/repository/generation_session` へ移行し、Domain にはインターフェースと DTO だけが残る。

## 51. World型ガードが world_generation の Schema に依存

- 該当箇所: `src/domain/world/typeguards.ts:1-12`。
- 内容: World の型ガードが Biome/WorldGenerator Schema を直接参照している。
- 問題点: World BC の検証が他 BC の型定義に固定され、境界が曖昧になる。
- 対応方針: World BC 専用の Schema/型ガードを整備し、他 BC の Schema 依存はアプリケーション層のマッピング処理で扱う。
- 対応結果: 未着手。`typeguards.ts` が `BiomeSystemSchema` を直接参照しており、Phase3 で World 専用 DTO と境界サービスへ分離する。

## 52. Worldファクトリヘルパーが他BCのファクトリを直接組み合わせ

- 該当箇所: `src/domain/world/factory/helpers.ts:1-60`。
- 内容: World のヘルパーが world_generation のファクトリ (`createQuickGenerator` など) を直接呼び出す。
- 問題点: World BC 内で他 BC の生成ロジックを組み立てており、境界の独立性が失われる。
- 対応方針: World BC のヘルパーは自 BC の構成要素に限定し、他 BC のファクトリ連携はアプリケーション層で統合する。
- 対応結果: WorldDomainHelpers から world_generation 依存のワークフロー (`createQuickWorld` 等) を削除し、ドメイン側は検証・設定最適化・メタデータ出力のみ提供。world_generation ファクトリを利用する組立処理はアプリケーション層へ移行した。

## 53. Worldリポジトリ層が world_generation の設定型に結合

- 該当箇所: `src/domain/world/repository/layers.ts:9-74`。
- 内容: WorldRepositoryLayer の構成に world_generation の RepositoryConfig を直接組み込み、Layer.mergeAll で統合している。
- 問題点: World BC の永続化層が他 BC の構成型に依存し、独自のリポジトリ境界が保てない。
- 対応方針: World BC 固有のリポジトリ設定を定義し、他 BC の構成値はアプリケーション層が注入する形式へ改める。
- 対応結果: WorldRepositoryLayerConfig をドメイン側で再定義し、world_generation からの型 import を解消。World ドメインは抽象的なリポジトリ設定のみ保持し、具体実装はアプリケーション／インフラ層で注入するように整理した。

## 54. Worldヘルパーがアプリケーションサービスへ依存

- 該当箇所: `src/domain/world/helpers.ts:2`、`163-173`。
- 内容: Domain ヘルパーが `WorldApplicationService`（アプリケーション層）を取得してチャンク生成を委譲している。
- 問題点: Domain → Application の逆依存が発生し、層構造が完全に崩れている。
- 対応方針: Domain ヘルパーからアプリケーションサービス依存を排除し、必要な調整はアプリケーション層で Domain API を組み合わせて行う。
- 対応結果: `WorldDomainHelpers` から `WorldApplicationService` 依存を排除し、チャンク生成等のユースケースロジックはアプリケーション層で扱うように再編した。

## 55. WorldDomainコンテナが ApplicationServices を同居

- 該当箇所: `src/domain/world/domain.ts:1-38`。
- 内容: WorldDomain エクスポート構造に `ApplicationServices` を含め、Domain インターフェースの一部として公開している。
- 問題点: Domain API がアプリケーション層の実装を前提にし、層分離が事実上不可能になる。
- 対応方針: Domain エクスポートから ApplicationServices を切り離し、アプリケーション層が独自に合成したファサードを公開する。
- 対応結果: `WorldDomain` から ApplicationServices を除外し、ドメイン API は Types/ValueObjects/Services 等に限定。アプリケーション層の構成はユーザー側で組み立てる前提に変更した。

## 56. chunk_loader のアプリケーションロジックが Domain 配下に存在

- 該当箇所: `src/domain/chunk_loader/application/chunk_loading_provider.ts:1-200`。
- 内容: `application` ディレクトリが Domain ツリー内にあり、ロードキュー管理・メトリクス集計・乱数判定まで実装している。
- 問題点: アプリケーション層のユースケース実装が Domain に混在し、役割境界が崩壊している。
- 対応方針: `chunk_loader/application` 以下をアプリケーション層へ移動し、Domain には必要なポートとエンティティだけを残す。
- 対応結果: 完了。`src/domain/chunk_loader/application` ディレクトリを廃止し、実装は `src/application/chunk_loader/application` へ移設済み。

## 57. ドメインサービスがアプリケーションの計測メトリクスへ依存

- 該当箇所: `src/domain/world_generation/domain_service/procedural_generation/terrain_generator.ts:29-32`。
- 内容: `chunkGenerationCounter` などアプリケーション層の観測メトリクスを直接 import してカウンタ更新を行っている。
- 問題点: Domain ロジックがアプリ観測基盤に結合し、層間依存とテスト容易性を損なう。
- 対応方針: メトリクス更新をイベント通知に切り替え、カウンタ加算はアプリケーション/監視層で処理する。
- 対応結果: 未着手。`terrain_generator.ts` が `@application/observability/metrics` を import しており、Phase3 でメトリクスポートへ差し替える。

## 58. 物理ドメインがアプリケーション監視に結合

- 該当箇所: `src/domain/physics/service/cannon.ts:1-5`。
- 内容: 物理シミュレーションが `physicsStepDuration`（アプリ観測メトリクス）を直接 import している。
- 問題点: Domain とアプリケーション層の関心が分離されておらず、メトリクス変更がドメイン再配布を伴う。
- 対応方針: 物理シミュレーションは観測イベントを発行するだけとし、メトリクス更新はアプリケーション層の監視コンポーネントに委譲する。
- 対応結果: 完了。物理ドメインのサービスはアプリケーション側メトリクスを import しておらず、`PhysicsEnginePort` 経由で観測イベントを返す構成へ移行済み。

## 59. 永続化モジュールに未実装スタブが残存

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:200-204`。
- 内容: `compressData` / `decompressData` が `Effect.succeed(data)` のモック実装のまま放置されている。
- 問題点: ドメイン層で未実装スタブが成功扱いになり、実際の圧縮/復元処理が行われないまま本番コードに混入する。
- 対応方針: 圧縮処理はインフラ層の実装へ委任し、Domain 側では未実装メソッドを削除するか失敗を返す形に改めて契約を明確化する。
- 対応結果: 完了。該当 persistence 実装は削除され、圧縮処理はインフラ層のアダプタへ移行済み。

## 60. 擬似チェックサムをドメインが実装

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:186-198`。
- 内容: `calculateChecksum` が単純な文字コード加算ハッシュで代用されている。
- 問題点: 技術的整合性を担保するべきチェックサムが健全な実装になっておらず、データ整合性保証をドメインが誤魔化している。
- 対応方針: チェックサム生成は `ChecksumPort` に抽象化し、暗号学的ハッシュや高速ハッシュなどの実装をインフラ層に切り替えられるようにする。Domain では検証対象データの提示と結果判定のみを行い、推測可能な擬似実装は撤廃する。
- 対応結果: 完了。擬似チェックサム実装は削除され、チェックサム生成はインフラ層のポート実装へ移行した。

## 61. biomeドメインサービスがworldドメイン型に依存

- 該当箇所: `src/domain/biome/domain_service/biome_classification/climate_calculator.ts:11-12`, `src/domain/biome/domain_service/biome_classification/biome_mapper.ts:11-12`, `src/domain/biome/domain_service/biome_classification/ecosystem_analyzer.ts:11-12`
- 内容: バイオーム判定サービスが `@domain/world/types/errors` や `@domain/world/value_object/world_seed` を直接 import している。
- 問題点: Biome BC が World BC のエラー表現・シード型に結合し、独立したユビキタス言語を持てなくなる。World 側の変更がバイオームロジック全体に波及し、境界づけられたコンテキストの分離が破綻する。
- 対応結果: `BiomeGenerationError` を導入し、WorldSeed を Shared 層へ移動。Biome サービスが World BC へ直接依存しない構成に再整理した。

## 62. biomeリポジトリがworld型とNode APIに依存

- 該当箇所: `src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:14-29`
- 内容: 永続化実装が World BC のリポジトリエラー型や生成パラメータ型に依存し、同時に `fs`/`path`/`zlib` を直接操作している。
- 問題点: Biome BC のリポジトリが world BC の実装詳細と Node のI/Oを抱え込み、境界分離とポート/アダプタの責務が混在している。
- 対応結果: Biome リポジトリ向けの `BiomeRepositoryError` と独自契約を定義し、World 型への依存を排除。キャッシュ実装も同エラー体系へ統一した。

## 63. biome値オブジェクトがworldユーティリティに依存

- 該当箇所: `src/domain/biome/value_object/biome_properties/vegetation_density.ts:1-12`, `src/domain/biome/value_object/biome_properties/soil_composition.ts:1-12` など
- 内容: 値オブジェクトが `@domain/world/utils/taggedUnion` を利用し、World BC 提供のユーティリティに依存している。
- 問題点: World BC の補助関数を前提にすると Biome BC のモデルが世界コンテキストに従属し、コンテキスト固有の表現を失う。
- 対応結果: `taggedUnion` などのユーティリティを Shared 層へ移動し、Biome 値オブジェクトが World BC に依存しないようにした。

## 64. world_generationドメインサービスがworld値オブジェクトに依存

- 該当箇所: `src/domain/world_generation/domain_service/procedural_generation/terrain_generator.ts:11-22`, `structure_spawner.ts:8-15`, `cave_carver.ts:8-20`
- 内容: 地形/構造物/洞窟生成サービスが World BC の座標・ノイズ設定・シード型に直接アクセスしている。
- 問題点: World Generation BC のコアサービスが World BC のモデルを前提にしており、BC間の独立した進化や再利用が困難になる。
- 対応結果: 未着手。`terrain_generator.ts` などで `@domain/world/value_object` への直接依存が残っており、Phase3 で DTO 化と境界サービス導入を実施予定。

## 65. world_generationファクトリがworld集約型に依存

- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:22`, `generation_session_factory/factory.ts:22-24`
- 内容: ファクトリ実装が World BC の集約 (`world_generator`, `generation_session`) 型を取り込み、生成ロジックを直接活用している。
- 問題点: World Generation の生成フローが World 集約の内部構造に結合し、BC間境界を突破してしまう。
- 対応結果: 未着手。`world_generator_factory/factory.ts` が `@domain/world/aggregate` を import しており、Phase3 で生成 DTO とポートに切り替える。

## 66. world_generationファクトリがworldドメインサービスに依存

- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:23`
- 内容: World Generation ファクトリが `@domain/world/domain_service` を import し、World BC のサービス層を直接利用している。
- 問題点: サービス依存が BC 間で双方向になり、アーキテクチャ循環を生む。World 側のサービス変更が World Generation のファクトリ実装に直結する。
- 対応結果: 未着手。`world_generator_factory/factory.ts` で WorldDomainServiceLayer を組み立てており、Phase3 の分離対象。

## 67. world_generationリポジトリがworld型に結合

- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/interface.ts:18-25`, `persistence_implementation.ts:25-33`
- 内容: セッションリポジトリのインターフェース／永続化が World BC の型 (`WorldId`, `GenerationSessionId` など) やエラー定義を利用している。
- 問題点: World Generation BC の永続化層と World BC が密結合となり、単独モジュールとしての再配置が難しくなる。
- 対応結果: 未着手。`generation_session_repository/interface.ts` が `@domain/world/types` を import しており、Phase3 で独自 DTO へ置換する。

## 68. world_generation値オブジェクトがworldユーティリティ依存

- 該当箇所: `src/domain/world_generation/value_object/generation_parameters/structure_density.ts:8`, `feature_flags.ts:8`, `ore_distribution.ts:8`
- 内容: 生成パラメータ値オブジェクトが World BC の `taggedUnion` ユーティリティを前提にしている。
- 問題点: World Generation BC の値オブジェクトが World BC 実装にロックされ、モデル交換が難しくなる。
- 対応結果: 未着手。`generation_parameters` 配下で `@domain/world/utils/tagged_union` を使用しており、Phase3 で Shared 層ユーティリティへ分離する。

## 69. world_generationイベントがchunkドメイン型に依存

- 該当箇所: `src/domain/world_generation/aggregate/world_generator/events.ts:10`
- 内容: ワールド生成イベントが `@domain/chunk` の `ChunkDataSchema` を直接 import している。
- 問題点: World Generation イベントが Chunk BC の内部構造に結合し、イベントストリームの独立性を損なう。
- 対応結果: 未着手。`world_generator/events.ts` で `ChunkDataSchema` を参照し続けており、Phase3 で専用イベント DTO を定義する。

## 70. テンプレート解決がworld集約の型を要求

- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_resolver.ts:16-38`
- 内容: セッションテンプレート定義が World BC の `GenerationSession.SessionConfigurationSchema` を直接利用している。
- 問題点: テンプレート解決ロジックが World BC の型変更に脆弱となり、BC間の境界が実質的に崩れる。
- 対応結果: 未着手。`template_resolver.ts` で World 集約の Schema を import しており、Phase3 で共通 DTO に切り替える。

## 71. worldメタデータがビルド情報を保持

- 該当箇所: `src/domain/world/metadata.ts:1-37`
- 内容: `WORLD_DOMAIN_VERSION/FEATURES/STATS` に Node 対応バージョンやバンドルサイズ等の技術指標を埋め込んでいる。
- 問題点: ドメインモデルが開発・ビルド情報を抱え、業務的意味を持たないデータが SSoT に混入する。
- 対応結果: 未着手。`WORLD_DOMAIN_STATS` 等にビルド指標が残存しており、Phase3 でドキュメント側へ移す。

## 72. worldドメイン設定がリポジトリ層スキーマに依存

- 該当箇所: `src/domain/world/config.ts:1-40`
- 内容: `WorldDomainConfig` のスキーマが `WorldRepositoryLayerConfigSchema` を直接参照し、永続化設定を前提にしている。
- 問題点: ドメイン設定がインフラ層詳細に結合し、リポジトリ実装を差し替えるだけでもドメイン設定の変更が必要になる。
- 対応結果: 未着手。`world/config.ts` で Repository 層スキーマへの依存が残り、Phase3 でビジネス設定とインフラ設定を分離する。

## 73. worldドメイン設定にアプリ層トグルが含まれる

- 該当箇所: `src/domain/world/config.ts:14-121`
- 内容: `enableApplicationServices` などアプリケーション層向けフラグがドメイン設定スキーマに含まれている。
- 問題点: ドメイン設定が上位レイヤーの振る舞いを制御し、責務境界が曖昧になる。
- 対応結果: `enableApplicationServices` フラグを WorldDomainConfig から削除し、アプリケーション固有の切替はドメイン外で扱う方針に変更。`WorldDomainDataSchema` も同様に更新し、設定はビジネスロジック関連項目に限定した。

## 74. domain/types.ts が全BCの型を再エクスポート

- 該当箇所: `src/domain/types.ts:1-40`
- 内容: 1ファイルに全ドメイン型を集約し、タイプセーフな境界を消している。
- 問題点: 利用側が BC 境界を意識せず任意の型へアクセスでき、依存方向の制御が不能になる。
- 対応結果: 未着手。`src/domain/types.ts` が引き続き複数 BC の型を再エクスポートしており、Phase2 で廃止または BC 別ファサードへ分割する。

## 75. domain/index.ts が存在しないchunk/application_serviceをエクスポート

- 該当箇所: `src/domain/index.ts:24-31`
- 内容: `./chunk/application_service` への再エクスポートが残存しているが、該当モジュールは存在しない。
- 問題点: ドメイン層 API が壊れたモジュールを公開し、利用者に誤った依存を強制する。
- 対応結果: `src/domain/index.ts` から該当再エクスポートを削除し、ドメイン層が純粋な契約のみ公開するよう整理した。

## 76. domain/index.ts がChunkApplicationServiceLiveを公開

- 該当箇所: `src/domain/index.ts:36-37`
- 内容: ドメインのルートから `ChunkApplicationServiceLive` をそのまま再エクスポートしている。
- 問題点: アプリケーション層の実装がドメインAPIの一部となり、層分離の原則を破る。
- 対応結果: ドメイン入り口からアプリケーション実装の再エクスポートを削除し、代わりに `createChunkDomainLayer` を公開する形へ変更。アプリ層での組み立てに限定した。

## 77. CameraDomainLiveがCQRSハンドラを取り込む

- 該当箇所: `src/domain/camera/layers.ts:13-44`
- 内容: ドメインLayerが `CameraCommandHandlerLive` / `CameraQueryHandlerLive` を統合している。
- 問題点: CQRSハンドラはユースケース実装（アプリ層）の責務であり、ドメイン層に混在すると境界が曖昧になる。
- 対応結果: 未着手。`CameraDomainLive` がハンドラを含んだままであり、Phase4 で Application 層へ移す。

## 78. ChunkDomainLiveがCQRSハンドラを統合

- 該当箇所: `src/domain/chunk/layers.ts:8-21`
- 内容: チャンクドメインのLayerがコマンド/クエリハンドラとリードモデルをまとめている。
- 問題点: ドメイン層のLayerがアプリ層コンポーネントを抱えており、責務分離が崩壊する。
- 対応結果: `createChunkDomainLayer` を導入し、Domain 層は純粋なサービスとリポジトリ契約のみを束ねる構造へ変更。`ChunkCommandHandlerLive` / `ChunkQueryHandlerLive` / `ChunkReadModelLive` は `src/application/chunk/cqrs/` へ移動し、アプリケーション層が CQRS を組み立てる形に改めた。

## 79. ChunkDomainLiveのデフォルトが開発用リポジトリ

- 該当箇所: `src/domain/chunk/layers.ts:17-18`, `src/domain/chunk/repository/layers.ts:1-24`
- 内容: ドメイン層が `ChunkDevelopmentLayer`（インメモリ実装）を標準として組み込んでいる。
- 問題点: 実運用の永続化選択がドメイン層に焼き付けられ、環境切替をアプリ層から制御できない。
- 対応結果: Domain 側のリポジトリエクスポートを契約定義のみに縮小し、インメモリ実装は `src/infrastructure/chunk/repository/layers.ts` の `ChunkRepositoryMemoryLayer` として提供。アプリケーション層で `createChunkDomainLayer` に適切な Layer を注入する構成へ移行した。

## 80. WorldGenerationDomainLiveがRead Modelを内包

- 該当箇所: `src/domain/world_generation/layers.ts:24-45`
- 内容: ドメインLayerが `WorldGenerationReadModelLive` を組み込んでおり、クエリ用モデルを直結している。
- 問題点: CQRSのReadモデルはアプリ/インフラ責務であり、ドメインに常駐すると層分離が曖昧になる。
- 対応結果: 未着手。`WorldGenerationDomainLive` に Read Model が含まれているため、Phase3 でアプリ層の CQRS に移管する。

## 81. chunk_loader配下にapplicationディレクトリが存在

- 該当箇所: `src/domain/chunk_loader/application/chunk_loading_provider.ts:1-160`
- 内容: ドメインツリー内に `application` フォルダがあり、ユースケース組立・外部観測を担当している。
- 問題点: アプリケーション層の実装がドメインに混在し、依存方向の整理ができない。
- 対応結果: `src/domain/chunk_loader/application` を `src/application/chunk_loader/application` へ移動し、Domain からアプリケーションサービスの再輸出を削除。ChunkLoader のユースケースはアプリ層で管理する構造に整理した。

## 82. ChunkLoadingProviderが乱数とパフォーマンス統計を内製

- 該当箇所: `src/domain/chunk_loader/application/chunk_loading_provider.ts:23-158`
- 内容: `Random.nextIntBetween` を使った疑似乱数や `PerformanceStats` を直接管理し、擬似I/Oをドメインでシミュレーションしている。
- 問題点: 技術的監視とテスト用スタブをドメインが抱え、純粋な業務ロジックと分離できていない。
- 対応結果: ChunkLoadingProvider をアプリケーション層へ移動したことで、乱数・メトリクスといった技術的関心はアプリ側で扱うようになり、ドメイン層から排除済み。

## 83. 物理ドメインがパフォーマンス最適化サービスを保持

- 該当箇所: `src/domain/physics/service/performance.ts:1-120`
- 内容: 物理ドメインに FPS やメモリ使用量、チューニング推奨を扱う `PhysicsPerformanceService` が存在する。
- 問題点: パフォーマンス監視は技術的関心であり、ドメインロジックと混在すると責務が曖昧になる。
- 対応結果: 未着手。`physics/service/performance.ts` が継続して監視責務を保持しており、Phase4 の Observability 移行でポート化する。

## 84. Worldライフサイクルイベントがインフラ監視情報を含む

- 該当箇所: `src/domain/world/types/events/lifecycle_events.ts:1-160`
- 内容: `SystemStarted` や `GarbageCollection` イベントにリソース割当・GC統計など低レベル情報が入っている。
- 問題点: ドメインイベントがインフラ監視データを運び、業務対象のイベントストリームと混線する。
- 対応結果: 未着手。`lifecycle_events.ts` が引き続きリソース統計を含むため、Phase3 で監視イベントを Observability ポートへ切り出す。

## 85. GameSceneがWorld IDスキーマに依存

- 該当箇所: `src/domain/scene/scenes/game.ts:10-15`
- 内容: ゲームシーン定義が `WorldIdSchema` を import し、World BC の識別子を直接利用している。
- 問題点: Scene BC が World BC の内部型に結合し、UIシーンの独立性を失う。
- 対応結果: 未着手。`scene/scenes/game.ts` が `WorldIdSchema` に依存しており、Phase4 でシーン固有 DTO へ置換する。

## 86. GameSceneControllerがプレイヤー挙動を直接操作

- 該当箇所: `src/domain/scene/scenes/game.ts:26-107`
- 内容: プレイヤー移動・ダメージ処理・回復などアプリケーションロジックをコントローラ内で実装している。
- 問題点: UI/アプリ層のユースケースロジックがドメインシーンに混在し、層構造を侵す。
- 対応結果: 未着手。`createGameSceneController` がプレイヤー状態を直接更新しており、Phase4 でアプリ層ユースケースに委譲する。

## 87. SceneManagerLiveが状態遷移とスタック制御を内包

- 該当箇所: `src/domain/scene/manager/live.ts:1-140`
- 内容: シーンマネージャが遷移中フラグや履歴スタックを操作し、アプリ層の制御フローを抱えている。
- 問題点: ドメイン層が UI の遷移制御を持ち、ユースケース層との境界が崩れる。
- 対応結果: 未着手。`SceneManagerLive` が状態スタックを直接管理しており、Phase4 でアプリ層のシーンコーディネータへ移管する。

## 88. ViewDistance LOD がパフォーマンスメトリクスを前提にする

- 該当箇所: `src/domain/view_distance/lod.ts:13-70`
- 内容: LOD 判定に FPS やメモリ使用率などの `PerformanceMetrics` を直接組み込んでいる。
- 問題点: レンダリング最適化という技術的判断がドメインロジックに入り、シーン/表示層の関心と混線している。
- 対応結果: 未着手。`view_distance/lod.ts` が `PerformanceMetrics` を要求しており、Phase4 で純粋な距離判定ロジックに切り出す。

## 89. FeatureFlags値オブジェクトが環境別設定を保持

- 該当箇所: `src/domain/world_generation/value_object/generation_parameters/feature_flags.ts:268-310`
- 内容: `environments` フィールドで `development/testing/staging/production` 別の挙動を定義している。
- 問題点: ドメイン値オブジェクトがデプロイ環境の事情を抱え、業務モデルと運用設定が分離できない。
- 対応結果: 未着手。`feature_flags.ts` に環境別設定が残っており、Phase3 でアプリケーション構成モジュールへ移す。

## 90. ワールド生成プリセットが運用設定を抱き込む

- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/preset_initialization_live.ts:40-116`
- 内容: プリセットに `logLevel` や `recommendedThreads`、Minecraft バージョンなど技術パラメータを埋め込んでいる。
- 問題点: ドメインプリセットが実行環境・製品仕様を包含し、業務モデルの純度が落ちる。
- 対応結果: 未着手。`preset_initialization_live.ts` に運用パラメータが残存しており、Phase3 で設定モジュールへ移動する。

## 91. Sceneのインデックスが存在しないspecモジュールを再エクスポート

- 該当箇所: `src/domain/scene/scenes/index.ts:1-8`
- 内容: `.spec` ファイルを再エクスポートしているが、対応するモジュールは存在しない。
- 問題点: ドメインAPIが無効なエクスポートを含み、依存側にビルド失敗やデッドリンクを招く。
- 対応結果: 未着手。`scene/scenes/index.ts` の不要な再エクスポートを Phase4 で削除する。

## 92. ChunkLoaderインデックスがアプリケーション実装を再公開

- 該当箇所: `src/domain/chunk_loader/index.ts:40-53`
- 内容: ドメインインデックスが `ChunkLoadingProviderLive` や `makeChunkLoadingProvider`（アプリ層実装）を再エクスポートしている。
- 問題点: ドメインAPI経由でアプリ層が露出し、依存方向の制御ができなくなる。
- 対応結果: 未着手。`chunk_loader/index.ts` の再エクスポートが残存しており、Phase4 でポート定義のみに整理する。

## 93. Furnitureドメインがアプリケーションサービスを内包

- 該当箇所: `src/domain/furniture/service.ts:21-174`
- 内容: `FurnitureApplicationService` インターフェースと実装 (`makeFurnitureApplicationService`) をドメイン直下で提供している。
- 問題点: アプリケーションサービスを再現し、ドメインとアプリ層の責務境界が不明瞭になる。
- 対応結果: 未着手。`furniture/service.ts` にアプリ層相当のサービスが残り、Phase4 でユースケースをアプリケーションへ移す。

## 94. ChunkSystemの時間ユーティリティが直接sleepを呼び出す

- 該当箇所: `src/domain/chunk_system/time.ts:22-27`
- 内容: `sleepUntil` が `Effect.sleep` を用いてスレッド制御を行っている。
- 問題点: タイマや待機はインフラ責務であり、ドメイン関数が直接実行するとテストや移植が困難になる。
- 対応結果: `sleepUntil` は残り時間（ミリ秒）を返す純粋な計算へ変更し、実際の待機処理はアプリケーション層で行う前提に整理した。

## 95. BiomeSystemファクトリで擬似待機を実装

- 該当箇所: `src/domain/biome/factory/biome_system_factory/factory.ts:755-758`
- 内容: `Effect.sleep(1)` による疑似ディレイをドメインファクトリに組み込んでいる。
- 問題点: 実行制御がドメイン層に存在し、ロジックの決定性とテスト容易性が損なわれる。
- 対応結果: 完了。`measureProcessingTime` から `Effect.sleep` と `performance.now` を排除し、統計的な推定値を同期計算で返すように修正した（`biome_system_factory/factory.ts`）。

## 96. Chunk Performance OpticsがGC制御のためにsleepを挿入

- 該当箇所: `src/domain/chunk/aggregate/chunk/performance_optics.ts:316-320`
- 内容: ブロック処理中に `Effect.sleep(Duration.millis(0))` を挿入し、GCに時間を与えている。
- 問題点: ランタイム制御はインフラ関心であり、ドメイン処理に混入すると責務が崩れる。
- 対応結果: 当該 `Effect.sleep` を削除し、処理は純粋なブロック変換に限定。スケジューリングが必要な場合はアプリケーション層で制御する方針に変更した。

## 97. Chunk Composite Operationsもsleepで制御

- 該当箇所: `src/domain/chunk/aggregate/chunk/composite_operations.ts:398-402`
- 内容: 並列処理中に `Effect.sleep(Duration.millis(0))` を繰り返し挟んでいる。
- 問題点: ドメインロジックが調停用スリープを持ち、技術的制御と混在している。
- 対応結果: ストリーミング処理から `Effect.sleep` を除去し、Domain は加工結果のみ返すよう修正。待機制御はアプリケーション層で実装する。

## 98. オーケストレータLayerがチャンク生成で固定待機を行う

- 該当箇所: `src/domain/world_generation/domain_service/world_generation_orchestrator/layer.ts:150-159`
- 内容: `generateChunk` が 500ms の `Effect.sleep` を行い、生成処理を疑似的に表現している。
- 問題点: ドメイン層がスレッド制御を持ち、ユースケースロジックと技術的シミュレーションが混ざる。
- 対応結果: 完了。`generateChunk` から固定スリープを除去し、処理時間は計測値の差分で算出するように整理した（`world_generation_orchestrator/layer.ts`）。

## 99. テンプレートレジストリが環境/性能プロファイルを埋め込む

- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_registry_live.ts:60-119`
- 内容: テンプレート定義に `supportedProfiles: ['development', 'testing', ...]` や CPU/メモリ要求が直書きされている。
- 問題点: テンプレートが運用環境の事情を前提にし、ドメインテンプレートと環境設定が切り離せない。
- 対応結果: 未着手。`template_registry_live.ts` が環境プロファイルを保持しており、Phase3 で設定ストアへ移す。

## 100. テンプレート解決サービスが運用指標でスコアリング

- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_resolver.ts:27-59`
- 内容: テンプレート解決で `expectedCpuUsage` や `scalability` など運用指標に基づきスコアを算出している。
- 問題点: テンプレート選定がインフラ志向の指標と密結合し、ドメインルールと運用判断が混在する。
- 対応結果: 未着手。`template_resolver.ts` が運用指標を直接評価しており、Phase3 でアプリ層のテンプレートスコアリングサービスへ委譲する。

# 修正候補一覧

| ID | 対応テーマ | 主対象 | 推奨フェーズ | ステータス | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | ドメイン常駐インフラの排除 | World / WorldGeneration / Biome | Phase2-3 | 部分完了 | Inventory/Chunk は移設済み。World 系 Repository を Port 化するタスクが残存 (#1,#13). |
| 2 | `<Service>Live` の分離 | World / Biome / Camera | Phase2-3 | 部分完了 | Inventory/Input は完了。World/Camera の Layer から Live 実装を排出する必要あり (#2,#77). |
| 3 | CQRS DTO のアプリ層移行 | World / WorldGeneration / Scene | Phase2 | 部分完了 | Inventory は移行済み。World/Scene の DTO をアプリ層 `types/` へ移設する。 |
| 4 | UI → Domain 直結の撤廃 | Presentation 全般 | Phase1 | 完了 | React サンプルはアプリ層ファサード経由に統一済み (#4). |
| 5 | BC 再定義と語彙統一 | 全 BC | Phase1 | 完了 | `docs/design/bounded-contexts.md` をSSoTとして運用中 (#5). |
| 6 | Effect/Schema 依存度調整 | Chunk / WorldGeneration / Biome / Camera | Phase2 | 部分完了 | Player/Inventory は純粋化済み。残りは `Effect.gen` 削減と `calculate*` 抽出が必要 (#6). |
| 7 | 物理エンジン操作の外部化 | Physics | Phase1 | 完了 | `PhysicsEnginePort` 導入済み、Cannon-es 実装はインフラ層へ移行 (#7). |
| 8 | ブラウザ API 依存の抽象化 | WorldGeneration / Biome / ViewDistance | Phase2-3 | 部分完了 | Inventory/Chunk は Port 化済み。WorldGeneration は `HardwareProfileService` で抽象化済み。ViewDistance/Biome の環境依存が残存 (#8,#12,#14). |
| 9 | Node FS 依存の外部化 | World / WorldGeneration / Biome | Phase2-3 | 部分完了 | Inventory は完了。World/Biome の Node 依存をアダプタへ移す (#13,#33). |
| 10 | Application 実装の再輸出停止 | Domain index | Phase1 | 完了 | `src/domain/index.ts` からアプリ実装を排除済み (#10,#75,#76). |
| 11 | 環境自動判定の Composition 化 | WorldGeneration / ViewDistance | Phase2 | 部分完了 | Inventory ではブートストラップへ移行済み。WorldGeneration の `detectHardwareSpec` 等を移設する (#11,#14). |
| 12 | ブラウザ API 利用可否ポート化 | WorldGeneration | Phase2 | 完了 | Inventory/Chunk の Port 化に加え、`HardwareProfileService` でハードウェア検出を抽象化し、`navigator` 依存を排除した (#12,#14). |
| 13 | 永続化アダプタ分割 | World / WorldGeneration / Biome | Phase2 | 部分完了 | Inventory/Chunk は済み。World 系 `*implementation.ts` をインフラ配下へ移動する (#13). |
| 14 | ハードウェア検出の外部サービス化 | WorldGeneration | Phase2 | 完了 | `HardwareProfileService` ポートを導入し、ブラウザ API 依存をアプリ層の `BrowserHardwareProfileServiceLive` に移管した (#14). |
| 15 | Performance API 抽象化 | Performance / Biome / Chunk | Phase4 | 未着手 | `performance.now`/`performance.memory` 依存を Clock/Observability Port に差し替える (#15). |
| 16 | World⇔WorldGeneration の再輸出停止 | World | Phase3 | 未着手 | `world/factory` などで `@domain/world_generation` への依存を分離する (#16,#64-70). |
| 17 | Layer 組み立てのブートストラップ移行 | World / Camera | Phase3 | 未着手 | `createWorldDomainLayer` / `CameraDomainLive` から構成選択を除去する (#17,#77). |
| 18 | 環境戦略・ログの外部化 | ChunkSystem / WorldGeneration | Phase3 | 部分完了 | Chunk Loader は移行済み。WorldGeneration の戦略/メトリクス更新をアプリ層へ移す (#18,#57-58). |
| 19 | ドメイン設定から技術パラメータ除去 | World | Phase3 | 未着手 | `world/config.ts` から `compression` などの技術設定を分離する (#19,#72). |
| 20 | ロギングの横断化 | Physics / WorldGeneration / Chunk | Phase3-4 | 未着手 | `Effect.log*` を LoggerPort に統一する (#20,#57,#83). |
| 21 | Node 固有メモリ API 抽象化 | Chunk Query | Phase1 | 完了 | `process.memoryUsage` 依存はアプリ層に移行済み (#21). |
| 22 | 擬似待機のテストダブル化 | Biome / WorldGeneration / ChunkSystem | Phase2-3 | 部分完了 | Chunk 系は除去済み。Biome/WorldGeneration に残る `Effect.sleep` を外部ジョブへ移す (#22,#29,#95,#98). |
| 23 | 構造体コピーの汎用化 | WorldGeneration / Inventory | Phase2 | 完了 | Inventory に続き、ErrorRecovery で `CloneService` ポートを導入し、`structuredClone` 依存を排除した (#23). |
| 24 | 暗号処理のアダプタ化 | WorldMetadata | Phase1 | 完了 | 暗号処理はインフラ層へ移行済み (#24). |
| 25 | ハッシュ計算ポート化 | Chunk Serializer/Validator | Phase2 | 未着手 | `crypto.subtle.digest` 依存を HashPort に切り替える (#25). |
| 26 | 圧縮処理抽象化 | Chunk Serializer / WorldGeneration | Phase2 | 未着手 | `node:zlib` 依存を CompressionPort に移す (#26). |
| 27 | GC 呼び出しの排除 | Chunk Performance | Phase2 | 部分完了 | `global.gc` 呼び出しが `performance_optics.ts` に残る。通知イベント化が必要 (#27,#96). |

上表を Phase2 以降のバックログとして管理し、ステータス列を基に具体的なタスクへ落とし込む。
