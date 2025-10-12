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
| 境界 | 対象ID | 主な論点 |
| --- | --- | --- |
| 基盤/共通 | 1,2,5,6,8-15,17,19-27,30,31,34,35,47,48,74-76 | ドメイン層がインフラ・ランタイム依存や Layer 組み立てを保持しており、ポートと Composition への分離が必要。 |
| Inventory | 3,36,39,45,46 | CQRS DTO や自動保存/バックアップなどアプリ層・インフラ責務がドメインへ流入。 |
| Chunk | 18,28,38,40,78,79,94,96,97 | 環境検出・メトリクス・CQRS・待機制御が Domain 内で完結し、ポート化とアプリ層移管が未実施。 |
| ChunkLoader | 56,81,82,92 | ロード戦略や乱数/観測を Domain chunk_loader が内製し、アプリケーションとの差分制御ができていない。 |
| World | 16,41-55,71-73,84 | World BC が他 BC やアプリサービスを再輸出し、設定オブジェクトに技術的詳細が混入。 |
| WorldGeneration | 29,32,37,49,50,57,59,60,64-70,80,89,90,98-100 | World/Chunk への結合と圧縮・テンプレート・スケジューリング等のインフラ実装が Domain に残存。 |
| Biome | 33,61-63,95 | World 依存と Node API 利用が残り、待機制御やユーティリティの分離が未完了。 |
| Physics | 7,58,83 | Cannon-es 制御やパフォーマンス計測を Domain が扱い、観測層との分離が不足。 |
| Scene/Camera | 4,77,85-87,91 | Presentation ロジックと CQRS ハンドラが Domain Scene/Camera に常駐。 |
| ViewDistance | 88 | LOD 判定がパフォーマンスメトリクスに依存し、環境差分の注入ポイントが未整備。 |
| Furniture | 93 | 家具アプリケーションサービスが Domain 内に存在し、ユースケース層との境界が不明瞭。 |

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
- 目的とユビキタス言語:
- 主要エンティティ / 値オブジェクト:
- 現在の副作用・外部依存:

## 2. 課題整理
- ドメインに残っている技術的詳細:
- 層違反や他 BC 依存:
- テストしづらい理由:

## 3. 純粋化方針
- ドメインに残すロジック:
- 抽象化するポートと期待する契約:
- 移設するモジュール（アプリ / インフラ / Composition）:

## 4. 実施タスク
- [ ] ポート定義とシグネチャ確定
- [ ] ドメインから副作用コードを除去
- [ ] Application 層でのコンポジション更新
- [ ] テスト整備（ドメイン単体 / ポートダブル / 受入）

## 5. 完了条件
- ドメインの依存が Domain 内と宣言済みポートに限定されている
- 主要ユースケースがポート経由で組み立てられている
- テストで副作用を差し替えられる
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
| 項目 | 対応内容 | 参照 | 状態 |
| --- | --- | --- | --- |
| Inventory ドメインサービスの純粋化 | `makeTransferService` 等のファクトリを導入し、アプリケーション層で Layer 化 | `src/domain/inventory/domain_service/*/live.ts`, `src/application/inventory/domain-layer.ts` | 完了 |
| Block Factory の純粋化 | `makeBlockFactory` を新設し、Domain から `Layer` 依存を除去 | `src/domain/block/factory/block_factory.ts`, `src/domain/block/domain_service/registry.ts` | 完了 |
| Repository 環境分岐の所在確認 | 環境選択/初期化処理が Infrastructure に集約されているか再確認 | `src/infrastructure/inventory/repository/layers.ts` | 完了 |

## Phase 2 進捗
### 実施サマリ
- Chunk ドメインの Layer から CQRS/ReadModel を分離し、`createChunkDomainLayer` として純粋な依存注入ポイントを定義。CQRS 実装は `src/application/chunk/cqrs/` へ移動した。
- Chunk リポジトリの実装レイヤーをインフラ側 (`src/infrastructure/chunk/repository/layers.ts`) にまとめ、Domain は契約定義のみを公開。
- Chunk Loader のアプリケーションロジックを `src/application/chunk_loader/application/` へ移し、Domain からの再輸出を削除。
- `sleepUntil` や `Effect.sleep` を用いた待機処理をドメイン各所から除去し、アプリケーション層で制御する設計へ変更。
- IndexedDB リポジトリの疑似遅延を除去し、テスト/インフラで制御できるようにした。

### 確認ポイント
| 項目 | 対応内容 | 参照 | 状態 |
| --- | --- | --- | --- |
| Chunk ドメイン Layer の純粋化 | `createChunkDomainLayer` の導入と CQRS 移動 | `src/domain/chunk/layers.ts`, `src/application/chunk/cqrs/*` | 完了 |
| Chunk Repository 実装のインフラ集約 | メモリ実装 Layer をインフラへ移設 | `src/infrastructure/chunk/repository/layers.ts` | 完了 |
| Chunk Loader アプリ層化 | `application` ディレクトリをアプリ層へ移動 | `src/application/chunk_loader/application/*` | 完了 |
| ドメイン内スリープの除去 | chunk 系・chunk_system の `Effect.sleep` 排除 | `src/domain/chunk/aggregate/chunk/*`, `src/domain/chunk_system/time.ts` | 進行中（GC メトリクスなど残タスクあり） |

## 1. ドメイン層にインフラ実装が常駐している
- 該当箇所: DDD.md 5.5「repository/」および 6.3–6.4 の `memory.ts` / `persistent.ts` 標準パターン、9.1 の Layer 統合例。
- 内容: ドメイン配下に `Layer.effect` を介した Repository 実装と IndexedDB 依存 (`IndexedDBService`) が配置され、Domain 層が永続化技術を直接参照している。
- 問題点: 「Domain → Domain のみ」とする 3.2 の依存制約に反し、インフラ変更時にドメイン構造の変更が必須になる。DDD の戦略的分離が形骸化し、テスト容易性も Layer 実装に縛られる。
- 対応方針: リポジトリは Domain で抽象インターフェースのみ公開し、IndexedDB などの具体実装は infrastructure/composition 配下へ移し、Effect Layer の組み立ては Application 層で注入する。

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

## 6. ドメインのロジックが Effect/Schema に過度依存
- 該当箇所: 5.2 aggregate／5.3 value_object の実装パターン。
- 内容: 集約操作でも `Schema.decodeUnknown`・`Effect.gen` を多用し、純粋なドメイン演算が副作用コンテキスト越しでなければ成立しない設計になっている。
- 問題点: 単純なドメイン計算が Effect に包まれ、テストやリファクタリング時にモナディック制御が必須となる。ユビキタス言語で表現されるルールよりライブラリ API が前面に出てしまい、ドメインモデルの意図が読み取りづらい。
- 対応方針: Schema/Effect は入力検証と副作用境界に限定し、集約操作は純粋関数 `calculate*` 系へ分離する。`Effect.gen` を多用するサービスは Application 層へ持ち上げ、Domain ではポート経由の値変換とルール評価のみを担う構造に改修する。

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

## 12. ドメインリポジトリがブラウザ API の利用可否を直接判定
- 該当箇所: `src/domain/chunk/repository/strategy/repository_strategy.ts:88-154`、`src/domain/inventory/repository/container_repository/persistent.ts:80` 付近。
- 内容: `window`・`indexedDB`・`Worker`・`navigator.connection` などブラウザ固有 API の存在確認や性能推定をドメインロジックに組み込んでいる。
- 問題点: プラットフォーム診断がドメイン層に常駐し、ビジネスルールより環境依存コードが主導する構造になっている。別環境（サーバー/テスト）では分岐が破綻し、DDDの普遍的なモデル表現から乖離する。
- 対応方針: ブラウザ API の機能検出を `EnvironmentCapabilitiesPort` として抽象化し、インフラ層で `indexedDbAvailable` や `workerThreadsAvailable` 等のフラグを提供する。Domain 側は受け取った能力フラグを基に戦略を切り替え、実際の API 判定コードを保持しない。

## 13. ドメインリポジトリが複数の永続化詳細を抱え込み過ぎている
- 該当箇所: `src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts:42` 以降、`src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:23` 以降、`src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27` 以降。
- 内容: IndexedDB のオープン手続きや Node.js ファイルシステム（`fs`/`path`）を直接操作しており、永続化戦略ごとにドメイン配下へ実装が増殖している。
- 問題点: ポート/アダプタの境界が不明瞭で、インフラ選択を変更するたびにドメインコードが巻き込まれる。また Node.js API を含むため共有ライブラリとしての利用（ブラウザ・ワーカーなど）が制限される。
- 対応方針: 永続化戦略を `ChunkPersistencePort` 等のポートに整理し、IndexedDB/Node FS 実装は infrastructure 層のアダプタへ移設する。Domain はポート選択のポリシーとモデル整合性のみ保持し、実装追加はアダプタ新設で完結させる。

## 14. ドメインでハードウェア検出が行われている
- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/configuration.ts:176-211`。
- 内容: `detectHardwareSpec` が `navigator.hardwareConcurrency` などブラウザ固有 API を直接参照し、CPU コア数等を推定している。
- 問題点: ハードウェア/環境検出はインフラ層やブートストラップで行うべきであり、ドメインがプラットフォーム API に依存すると他環境（サーバー、テスト）での利用が破綻する。ユースケースの純粋なルールが環境依存ロジックに埋もれる。
- 対応方針: ハードウェア検出は起動時の `RuntimeProfileProvider` に集約し、Domain へはスレッド数や並列度など抽象設定値のみを注入する。テスト環境では固定値を与えられるようポート経由に改修し、環境依存ロジックをドメインから排除する。

## 15. ドメインがブラウザの Performance API に依存
- 該当箇所: `src/domain/performance/memory_schema.ts:1-120`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-495` など。
- 内容: `performance.memory` や `performance.now()` をドメイン層が直接呼び出し、メトリクス測定や最適化判定を行っている。
- 問題点: 実行プラットフォーム固有の API をドメイン側が意識する形になり、テストダブル差し替えや環境非依存な評価が難しくなる。計測・監視はアプリケーション/インフラ層に委ね、ドメインには抽象化された時間・計測ポートを渡すべき。
- 対応方針: 計測 API への依存を抽象化したタイマー/メモリ監視ポートに置換し、Effect/time 測定はアプリケーション・インフラで実装する。

## 16. World BC が World Generation BC を再輸出
- 該当箇所: `src/domain/world/repository/index.ts:12-47`。
- 内容: World リポジトリのインデックスが `world_generation` のリポジトリ実装と設定型をそのまま re-export し、`world` BC の外へ公開している。
- 問題点: Bounded Context 間の境界が事実上消え、World BC を利用する側が World Generation の内部契約に直接依存してしまう。コンテキスト境界の互換性保証や独立進化が阻害され、DDD のコンテキスト分離が形骸化する。
- 対応方針: World BC の公開 API を再設計し、他 BC の実装を再輸出せずにポート経由で連携させ、相互依存は Application 層が調停する。

## 17. Domain 層で Layer 組み立てと構成選択を担っている
- 該当箇所: `src/domain/world/layers.ts:1-84`。
- 内容: World Domain Layer が Repository 実装の選択（`memory`/`mixed`/`persistence`）、他 BC（world_generation・biome）との Layer 組み合わせ、構成モード（default/performance/quality）の解決まで行っている。
- 問題点: 実行時構成や他 BC の束ねは Application/Bootstrap 層の責務であり、Domain が環境モードや依存 Layer を組み立てると関心が混在し、ユースケース側での柔軟な構成変更が困難になる。
- 対応方針: Layer 組み立て・モード選択は Application/Bootstrap 層のコンポジションに移し、Domain 層では必要なポート定義とデフォルト構成情報のみに留める。

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

## 20. Domain サービスがロギングを直接実行
- 該当箇所: `src/domain/physics/service/cannon.ts:206-500`、`src/domain/world_generation/domain_service/world_generation_orchestrator/*.ts`、`src/domain/chunk/aggregate/chunk/performance_optics.ts:473-513` など。
- 内容: `Effect.logInfo`/`Effect.logWarning`/`Effect.logError` を通じて Domain 内でログ出力・メトリクス記録を行っている。
- 問題点: ロギングは技術的横断関心であり、Domain ロジックに組み込むと純粋性が失われる。テスト時に副作用抑制が必要になり、ユースケース側でのロギング方針変更が困難になる。
- 対応方針: ロギングは Logger ポートを介してアプリケーションから注入し、Domain では副作用を発生させずにイベントや結果のみを返す。
## 21. Node.js 固有のメモリ API へ依存
- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:734-775`。
- 内容: クエリ性能計測で `process.memoryUsage()` を直接呼び、ヒープ差分を算出している。
- 問題点: `process` は Node.js 専用 API のため、ブラウザや Worker では動作せず、Repository が実行環境と結び付いてしまう。性能監視はインフラ層に切り出すべき。
- 対応方針: メモリ計測はモニタリング用のポートを定義し、Node/ブラウザ実装をインフラ側で用意して Domain には抽象化された計測値を注入する。

## 22. ドメインリポジトリが待機シミュレーションを行う
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/memory_implementation.ts:900-906`、`session_recovery.ts:166`。
- 内容: セッション復旧やリカバリ分析で `Effect.sleep` を直接実行し、擬似的な待機時間を挿入している。
- 問題点: 実際のスケジューリングや遅延シミュレーションはアプリケーション/インフラ側の責務であり、ドメインが時間制御を持つとテストや別環境での再利用が困難。
- 対応方針: 待機処理はアプリケーション層のジョブスケジューラへ移し、Domain は遅延の必要性をイベントやフラグで伝えるだけに留める。

## 23. `structuredClone` などブラウザ API 前提のコピー処理
- 該当箇所: `src/domain/inventory/repository/inventory_repository/persistent.ts:498`、`memory.ts:270`、`container_repository/persistent.ts:458`、`world_generation/domain_service/world_generation_orchestrator/error_recovery.ts:324-344` など。
- 内容: 状態スナップショットの複製に `structuredClone` を使用しており、ブラウザ実装を前提にしている。
- 問題点: Node.js や一部環境では未実装のため、純粋なデータコピー手段を Domain 層に持たせると互換性が崩れる。シリアライズ/コピーはインフラ抽象を介すべき。
- 対応方針: データ複製はシリアライザーポートに委譲し、Domain では純粋なデータ構造操作を行い、環境依存のコピー手段はインフラ側で差し替える。

## 24. ドメインが暗号化実装を直接扱う
- 該当箇所: `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts:21-278`。
- 内容: Node の `crypto` モジュールで AES 暗号・復号を実装し、鍵管理まで担っている。
- 問題点: セキュリティ実装はインフラ/アプリケーション層の責務であり、Domain が暗号モジュールに依存すると環境に縛られるうえにセキュリティ要件の差し替えが難しい。
- 対応方針: 暗号化・鍵管理はセキュリティポートを介してインフラ層に委任し、Domain では暗号化されたデータ契約とエラー処理のみを扱う。

## 25. Web Crypto 依存のハッシュ計算
- 該当箇所: `src/domain/chunk/domain_service/chunk_validator/service.ts:154-156`、`chunk_serializer/service.ts:436-438`。
- 内容: チャンク整合性検証に `crypto.subtle.digest` を直接呼び出し、Web Crypto API を仮定している。
- 問題点: Web Crypto が存在しない Node などでは失敗する。ハッシュ計算はポート化してインフラで差し替えられるようにするべき。
- 対応方針: ハッシュ計算ポートを定義し、Web Crypto/Node Crypto など複数実装をインフラ側で提供することで Domain からランタイム依存を排除する。

## 26. Node Buffer / zlib による圧縮処理をドメインが所有
- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:3-4`。
- 内容: `node:buffer` や `node:zlib` を import し、Brotli/GZip 圧縮を直接実装している。
- 問題点: 圧縮アルゴリズムの選択・実行は技術的詳細であり、Domain 層が Node 専用 API に依存するとブラウザ移植が不可能になる。
- 対応方針: 圧縮・展開は圧縮ポート経由で扱い、具体的なアルゴリズム選択とバッファ操作はインフラアダプタに委任する。

## 27. ガーベジコレクタ呼び出しをドメインで実行
- 該当箇所: `src/domain/chunk/aggregate/chunk/composite_operations.ts:468-481`、`chunk/performance_optics.ts:437-452`。
- 内容: メモリ最適化処理で `global.gc?.()` を呼び、ランタイム GC を直接起動している。
- 問題点: GC 制御はランタイム依存の技術詳細であり、Domain ロジックがこれを持つとテストや異なる VM で破綻する。
- 対応方針: メモリ回収要求はイベントやメトリクスとして通知し、GC トリガーはインフラ/運用層で制御する。

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

## 30. CommonJS `require` 前提のファイルアクセス
- 該当箇所: `src/domain/inventory/repository/item_definition_repository/json_file.ts:43-89`。
- 内容: `typeof require !== 'undefined'` で CommonJS 可否を判定し、`require('fs')` / `require('path')` に依存。
- 問題点: ES Modules やブラウザ環境では `require` が存在せず、Domain がモジュールシステムに依存してしまう。
- 対応方針: ファイルアクセスは抽象ポート越しに行い、CommonJS/E SM の分岐やモジュール解決はインフラ層のアダプタで処理する。

## 31. `TextEncoder` など Web API によるサイズ計測
- 該当箇所: `src/domain/chunk/domain_service/chunk_serializer/service.ts:90-309`、`src/domain/world/repository/world_metadata_repository/interface.ts:799` など。
- 内容: バイト長推定に `TextEncoder` を直接利用し、Web API の存在を前提としている。
- 問題点: Node のバージョン差や他ランタイムで互換性が保証されず、Domain モデルの計測が環境依存となる。
- 対応方針: エンコード/サイズ計測ポートを定義し、ブラウザ・Node それぞれの実装をインフラ側に切り出して Domain は抽象化されたインターフェースを利用する。

## 32. ワールド生成リポジトリが Node バッファと zlib を直接利用
- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/persistence_implementation.ts:21-300`。
- 内容: `node:buffer`・`zlib` を import し、圧縮／展開やバイナリ処理をその場で行っている。
- 問題点: Node 専用 API により、Domain 層がランタイムと密結合し、他環境への移植やテストダブル差し替えが困難。
- 対応方針: バッファ操作・圧縮処理はインフラアダプタへ移し、Domain では圧縮結果の契約とバリデーションのみに集中する。

## 33. バイオームリポジトリも Node ファイルシステムへ依存
- 該当箇所: `src/domain/biome/repository/biome_system_repository/persistence_implementation.ts:27-232`。
- 内容: `fs`・`path`・`zlib` を使って JSON 圧縮・バックアップを実装。
- 問題点: こちらも Domain がリソース I/O と圧縮を直に担っており、Bounded Context 全体が Node 依存になる。
- 対応方針: リソース I/O と圧縮の責務を分離し、Domain はポートを通じてデータの保存/取得を要求するだけにする。

## 34. ドメインが `crypto.randomUUID` で ID を生成
- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:437`、`generation_session_factory/factory.ts:452`。
- 内容: 生成 ID を `crypto.randomUUID()` で直接生成している。
- 問題点: ID 生成はインフラポートとして外出しすべきであり、ランタイム依存の関数を Domain が直接呼ぶとテスト時の決定性や差し替えが難しい。
- 対応方針: ID 生成サービスをポート化し、テスト用の決定的実装と本番用のランダム実装をアプリケーション/インフラ層から注入する。

## 35. ドメインイベントの識別子生成もランタイム依存
- 該当箇所: `src/domain/world/types/events/world_events.ts:518`、`lifecycle_events.ts:500-565`。
- 内容: イベント作成時に `crypto.randomUUID()` を直接利用。
- 問題点: イベント ID はドメイン固有の値オブジェクトとして扱うべきで、生成戦略はポート経由で切り替えられるようにする必要がある。
- 対応方針: イベント ID を値オブジェクト化し、生成は ID ポートを通じて行うように改修する。

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

## 38. リポジトリがパフォーマンスメトリクスを保持
- 該当箇所: `src/domain/chunk/repository/chunk_query_repository/implementation.ts:720-771`。
- 内容: `performanceMetricsRef` にクエリ実行時間やメモリ使用量を蓄積し、監視機能まで担っている。
- 問題点: メトリクス収集は監視インフラの関心であり、Domain Repository が分析データを保持すると責務が肥大化する。
- 対応方針: メトリクス収集は監視サービスのポートに移し、Domain は必要なイベント/統計を通知するだけにする。

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

## 48. ドメインが乱数生成を直接使用
- 該当箇所: `src/domain/inventory/types/commands.ts:724-732` ほか各所。
- 内容: ID や仕様判定に `Random.nextIntBetween` を多用し、乱数サービスの差し替えを前提としていない。
- 問題点: ドメインルールが非決定的になり、テストやリプレイが困難。乱数生成はポートとして抽象化すべき。
- 対応方針: 乱数生成を専用ポートに切り出し、決定的なテスト実装と本番向け実装をインフラで差し替えられるようにする。

## 49. キャッシュ戦略が Domain 内でスケジューリング
- 該当箇所: `src/domain/world_generation/repository/world_generator_repository/cache_strategy.ts:338-339`。
- 内容: `Schedule.fixed` で定期クリーンアップを Domain に内包している。
- 問題点: バックグラウンド処理のスケジュールはアプリケーション/インフラの責務であり、Domain がジョブ管理まで抱えると責務が膨張する。
- 対応方針: キャッシュクリアはアプリケーション側のスケジューラに委ね、Domain はクリーンアップ要求をイベント等で通知する。

## 50. 世代セッション永続化が Node FS を直接使用
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:19-40`。
- 内容: `@effect/platform-node/NodeFileSystem` や `NodePath` を import してファイル操作を行っている。
- 問題点: Node 依存の I/O が Domain 層に入り込み、ブラウザや他環境へ移植できない。
- 対応方針: ファイル I/O は永続化ポートの実装としてインフラ層に移し、Domain はセッション保存の契約定義に専念する。

## 51. World型ガードが world_generation の Schema に依存
- 該当箇所: `src/domain/world/typeguards.ts:1-12`。
- 内容: World の型ガードが Biome/WorldGenerator Schema を直接参照している。
- 問題点: World BC の検証が他 BC の型定義に固定され、境界が曖昧になる。
- 対応方針: World BC 専用の Schema/型ガードを整備し、他 BC の Schema 依存はアプリケーション層のマッピング処理で扱う。

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

## 57. ドメインサービスがアプリケーションの計測メトリクスへ依存
- 該当箇所: `src/domain/world_generation/domain_service/procedural_generation/terrain_generator.ts:29-32`。
- 内容: `chunkGenerationCounter` などアプリケーション層の観測メトリクスを直接 import してカウンタ更新を行っている。
- 問題点: Domain ロジックがアプリ観測基盤に結合し、層間依存とテスト容易性を損なう。
- 対応方針: メトリクス更新をイベント通知に切り替え、カウンタ加算はアプリケーション/監視層で処理する。

## 58. 物理ドメインがアプリケーション監視に結合
- 該当箇所: `src/domain/physics/service/cannon.ts:1-5`。
- 内容: 物理シミュレーションが `physicsStepDuration`（アプリ観測メトリクス）を直接 import している。
- 問題点: Domain とアプリケーション層の関心が分離されておらず、メトリクス変更がドメイン再配布を伴う。
- 対応方針: 物理シミュレーションは観測イベントを発行するだけとし、メトリクス更新はアプリケーション層の監視コンポーネントに委譲する。

## 59. 永続化モジュールに未実装スタブが残存
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:200-204`。
- 内容: `compressData` / `decompressData` が `Effect.succeed(data)` のモック実装のまま放置されている。
- 問題点: ドメイン層で未実装スタブが成功扱いになり、実際の圧縮/復元処理が行われないまま本番コードに混入する。
- 対応方針: 圧縮処理はインフラ層の実装へ委任し、Domain 側では未実装メソッドを削除するか失敗を返す形に改めて契約を明確化する。

## 60. 擬似チェックサムをドメインが実装
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/persistence_implementation.ts:186-198`。
- 内容: `calculateChecksum` が単純な文字コード加算ハッシュで代用されている。
- 問題点: 技術的整合性を担保するべきチェックサムが健全な実装になっておらず、データ整合性保証をドメインが誤魔化している。
- 対応方針: チェックサム生成は `ChecksumPort` に抽象化し、暗号学的ハッシュや高速ハッシュなどの実装をインフラ層に切り替えられるようにする。Domain では検証対象データの提示と結果判定のみを行い、推測可能な擬似実装は撤廃する。
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

## 65. world_generationファクトリがworld集約型に依存
- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:22`, `generation_session_factory/factory.ts:22-24`
- 内容: ファクトリ実装が World BC の集約 (`world_generator`, `generation_session`) 型を取り込み、生成ロジックを直接活用している。
- 問題点: World Generation の生成フローが World 集約の内部構造に結合し、BC間境界を突破してしまう。

## 66. world_generationファクトリがworldドメインサービスに依存
- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/factory.ts:23`
- 内容: World Generation ファクトリが `@domain/world/domain_service` を import し、World BC のサービス層を直接利用している。
- 問題点: サービス依存が BC 間で双方向になり、アーキテクチャ循環を生む。World 側のサービス変更が World Generation のファクトリ実装に直結する。

## 67. world_generationリポジトリがworld型に結合
- 該当箇所: `src/domain/world_generation/repository/generation_session_repository/interface.ts:18-25`, `persistence_implementation.ts:25-33`
- 内容: セッションリポジトリのインターフェース／永続化が World BC の型 (`WorldId`, `GenerationSessionId` など) やエラー定義を利用している。
- 問題点: World Generation BC の永続化層と World BC が密結合となり、単独モジュールとしての再配置が難しくなる。

## 68. world_generation値オブジェクトがworldユーティリティ依存
- 該当箇所: `src/domain/world_generation/value_object/generation_parameters/structure_density.ts:8`, `feature_flags.ts:8`, `ore_distribution.ts:8`
- 内容: 生成パラメータ値オブジェクトが World BC の `taggedUnion` ユーティリティを前提にしている。
- 問題点: World Generation BC の値オブジェクトが World BC 実装にロックされ、モデル交換が難しくなる。

## 69. world_generationイベントがchunkドメイン型に依存
- 該当箇所: `src/domain/world_generation/aggregate/world_generator/events.ts:10`
- 内容: ワールド生成イベントが `@domain/chunk` の `ChunkDataSchema` を直接 import している。
- 問題点: World Generation イベントが Chunk BC の内部構造に結合し、イベントストリームの独立性を損なう。

## 70. テンプレート解決がworld集約の型を要求
- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_resolver.ts:16-38`
- 内容: セッションテンプレート定義が World BC の `GenerationSession.SessionConfigurationSchema` を直接利用している。
- 問題点: テンプレート解決ロジックが World BC の型変更に脆弱となり、BC間の境界が実質的に崩れる。

## 71. worldメタデータがビルド情報を保持
- 該当箇所: `src/domain/world/metadata.ts:1-37`
- 内容: `WORLD_DOMAIN_VERSION/FEATURES/STATS` に Node 対応バージョンやバンドルサイズ等の技術指標を埋め込んでいる。
- 問題点: ドメインモデルが開発・ビルド情報を抱え、業務的意味を持たないデータが SSoT に混入する。

## 72. worldドメイン設定がリポジトリ層スキーマに依存
- 該当箇所: `src/domain/world/config.ts:1-40`
- 内容: `WorldDomainConfig` のスキーマが `WorldRepositoryLayerConfigSchema` を直接参照し、永続化設定を前提にしている。
- 問題点: ドメイン設定がインフラ層詳細に結合し、リポジトリ実装を差し替えるだけでもドメイン設定の変更が必要になる。

## 73. worldドメイン設定にアプリ層トグルが含まれる
- 該当箇所: `src/domain/world/config.ts:14-121`
- 内容: `enableApplicationServices` などアプリケーション層向けフラグがドメイン設定スキーマに含まれている。
- 問題点: ドメイン設定が上位レイヤーの振る舞いを制御し、責務境界が曖昧になる。
- 対応結果: `enableApplicationServices` フラグを WorldDomainConfig から削除し、アプリケーション固有の切替はドメイン外で扱う方針に変更。`WorldDomainDataSchema` も同様に更新し、設定はビジネスロジック関連項目に限定した。

## 74. domain/types.ts が全BCの型を再エクスポート
- 該当箇所: `src/domain/types.ts:1-40`
- 内容: 1ファイルに全ドメイン型を集約し、タイプセーフな境界を消している。
- 問題点: 利用側が BC 境界を意識せず任意の型へアクセスでき、依存方向の制御が不能になる。

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

## 84. Worldライフサイクルイベントがインフラ監視情報を含む
- 該当箇所: `src/domain/world/types/events/lifecycle_events.ts:1-160`
- 内容: `SystemStarted` や `GarbageCollection` イベントにリソース割当・GC統計など低レベル情報が入っている。
- 問題点: ドメインイベントがインフラ監視データを運び、業務対象のイベントストリームと混線する。

## 85. GameSceneがWorld IDスキーマに依存
- 該当箇所: `src/domain/scene/scenes/game.ts:10-15`
- 内容: ゲームシーン定義が `WorldIdSchema` を import し、World BC の識別子を直接利用している。
- 問題点: Scene BC が World BC の内部型に結合し、UIシーンの独立性を失う。

## 86. GameSceneControllerがプレイヤー挙動を直接操作
- 該当箇所: `src/domain/scene/scenes/game.ts:26-107`
- 内容: プレイヤー移動・ダメージ処理・回復などアプリケーションロジックをコントローラ内で実装している。
- 問題点: UI/アプリ層のユースケースロジックがドメインシーンに混在し、層構造を侵す。

## 87. SceneManagerLiveが状態遷移とスタック制御を内包
- 該当箇所: `src/domain/scene/manager/live.ts:1-140`
- 内容: シーンマネージャが遷移中フラグや履歴スタックを操作し、アプリ層の制御フローを抱えている。
- 問題点: ドメイン層が UI の遷移制御を持ち、ユースケース層との境界が崩れる。

## 88. ViewDistance LOD がパフォーマンスメトリクスを前提にする
- 該当箇所: `src/domain/view_distance/lod.ts:13-70`
- 内容: LOD 判定に FPS やメモリ使用率などの `PerformanceMetrics` を直接組み込んでいる。
- 問題点: レンダリング最適化という技術的判断がドメインロジックに入り、シーン/表示層の関心と混線している。

## 89. FeatureFlags値オブジェクトが環境別設定を保持
- 該当箇所: `src/domain/world_generation/value_object/generation_parameters/feature_flags.ts:268-310`
- 内容: `environments` フィールドで `development/testing/staging/production` 別の挙動を定義している。
- 問題点: ドメイン値オブジェクトがデプロイ環境の事情を抱え、業務モデルと運用設定が分離できない。

## 90. ワールド生成プリセットが運用設定を抱き込む
- 該当箇所: `src/domain/world_generation/factory/world_generator_factory/preset_initialization_live.ts:40-116`
- 内容: プリセットに `logLevel` や `recommendedThreads`、Minecraft バージョンなど技術パラメータを埋め込んでいる。
- 問題点: ドメインプリセットが実行環境・製品仕様を包含し、業務モデルの純度が落ちる。

## 91. Sceneのインデックスが存在しないspecモジュールを再エクスポート
- 該当箇所: `src/domain/scene/scenes/index.ts:1-8`
- 内容: `.spec` ファイルを再エクスポートしているが、対応するモジュールは存在しない。
- 問題点: ドメインAPIが無効なエクスポートを含み、依存側にビルド失敗やデッドリンクを招く。

## 92. ChunkLoaderインデックスがアプリケーション実装を再公開
- 該当箇所: `src/domain/chunk_loader/index.ts:40-53`
- 内容: ドメインインデックスが `ChunkLoadingProviderLive` や `makeChunkLoadingProvider`（アプリ層実装）を再エクスポートしている。
- 問題点: ドメインAPI経由でアプリ層が露出し、依存方向の制御ができなくなる。

## 93. Furnitureドメインがアプリケーションサービスを内包
- 該当箇所: `src/domain/furniture/service.ts:21-174`
- 内容: `FurnitureApplicationService` インターフェースと実装 (`makeFurnitureApplicationService`) をドメイン直下で提供している。
- 問題点: アプリケーションサービスを再現し、ドメインとアプリ層の責務境界が不明瞭になる。

## 94. ChunkSystemの時間ユーティリティが直接sleepを呼び出す
- 該当箇所: `src/domain/chunk_system/time.ts:22-27`
- 内容: `sleepUntil` が `Effect.sleep` を用いてスレッド制御を行っている。
- 問題点: タイマや待機はインフラ責務であり、ドメイン関数が直接実行するとテストや移植が困難になる。
- 対応結果: `sleepUntil` は残り時間（ミリ秒）を返す純粋な計算へ変更し、実際の待機処理はアプリケーション層で行う前提に整理した。

## 95. BiomeSystemファクトリで擬似待機を実装
- 該当箇所: `src/domain/biome/factory/biome_system_factory/factory.ts:755-758`
- 内容: `Effect.sleep(1)` による疑似ディレイをドメインファクトリに組み込んでいる。
- 問題点: 実行制御がドメイン層に存在し、ロジックの決定性とテスト容易性が損なわれる。

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

## 99. テンプレートレジストリが環境/性能プロファイルを埋め込む
- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_registry_live.ts:60-119`
- 内容: テンプレート定義に `supportedProfiles: ['development', 'testing', ...]` や CPU/メモリ要求が直書きされている。
- 問題点: テンプレートが運用環境の事情を前提にし、ドメインテンプレートと環境設定が切り離せない。

## 100. テンプレート解決サービスが運用指標でスコアリング
- 該当箇所: `src/domain/world_generation/factory/generation_session_factory/template_resolver.ts:27-59`
- 内容: テンプレート解決で `expectedCpuUsage` や `scalability` など運用指標に基づきスコアを算出している。
- 問題点: テンプレート選定がインフラ志向の指標と密結合し、ドメインルールと運用判断が混在する。

# 修正候補一覧

1. **ドメインに常駐するインフラ実装を排除する** – Repository の `Layer.effect` 実装を `src/infrastructure` など専用層へ移動し、Domain にはポート（interface）だけを残す。
2. **ライブ実装を Domain から分離** – `<Service>Live` や `Layer.effect` をアプリケーション/インフラ層へ再配置し、Domain はタグ定義のみにとどめる。
3. **CQRS DTO をアプリ層へ移行** – コマンド/クエリ schema を Application フォルダに移し、Domain ではユースケースに依存しないメソッドを提供する。
4. **UI → Domain 直結を撤廃** – Presentation からは Application ファサード経由に強制し、React サンプルを修正して Domain への直接依存を削除する。
5. **BC をユビキタス言語で再定義** – camera/chunk/world_generation 等をビジネス語彙で再切り出し、技術ドメインはサブドメインにまとめ直す。
6. **Effect/Schema 依存度の調整** – 純粋計算部分はプレーン TypeScript 関数へ分離し、Effect を入出力境界に限定する。
7. **物理エンジン操作をインフラ層へ移譲** – Cannon-es 操作を `src/infrastructure/physics` に移し、Domain には抽象化された PhysicsPort を定義する。
8. **ブラウザ API への依存を抽象化** – `localStorage` などは Port 経由で注入し、クラウド/テスト環境用の実装をインフラ層で切り替える。
9. **Node FS 依存を外部化** – `fs`/`path`/`zlib` を扱う処理をインフラ層のアダプタに移す。
10. **Application 層の再輸出を停止** – Domain の index から Application 実装の再公開を削除し、必要時はアプリ側で import させる。
11. **環境自動判定を Composition に移行** – Domain で `window` / `process` を判定せず、ブートストラップ時に適切な Layer を注入する。
12. **ブラウザ API 利用可否をポート化** – `hasIndexedDB` 等の判定を Domain 外へ出し、条件付き実装はアプリケーション層で分岐する。
13. **永続化方式ごとのアダプタを専用パッケージに分割** – `memory.ts`/`persistent.ts` を `src/infrastructure/<bc>/repository/` に再配置。
14. **ハードウェア検出を外部サービス化** – `navigator.hardwareConcurrency` 等はシステム情報サービスを通じて提供する。
15. **Performance API へのアクセスを抽象化** – 時刻・計測値は DomainClock や PerformancePort を介して取得する。
16. **World と WorldGeneration の再輸出を停止** – World BC の index から他 BC の export を取り除き、必要な依存は明示的に import する。
17. **Layer 組み立て処理をブートストラップへ移す** – Domain の Layer は純粋な `Layer` 定義にとどめ、構成選択 (`composeRepositoryLayer`) はアプリ側で実施する。
18. **環境制御ログを Infrastructure に委譲** – WebWorker/IndexedDB の戦略はアプリケーション層で組み替え、Domain には Strategy インターフェースを定義する。
19. **設定オブジェクトから技術パラメータを排除** – `compression` や `backup` などインフラ系設定を DomainConfig から切り出す。
20. **ロギングは横断関心へ集約** – ドメインサービス内の `Effect.log*` 呼び出しを LoggerPort に差し替える。
21. **Node 固有 API を抽象化** – `process.memoryUsage` を MetricsPort にラップし、各環境固有実装を用意する。
22. **擬似待機をテストダブルに置換** – `Effect.sleep` を伴うモック機能はテスト/デモ専用サービスに切り離す。
23. **構造体コピーを汎用ユーティリティへ** – `structuredClone` を環境非依存のコピー関数 (e.g. `DomainClonePort`) に置き換える。
24. **暗号処理をセキュリティアダプタ化** – `crypto.createCipher` などを SecurityPort 経由に変更し、Domain は抽象化された API を利用する。
25. **ハッシュ計算をポート化** – WebCrypto 依存をやめ、HashPort を経由してハッシュアルゴリズムを注入する。
26. **圧縮処理の抽象化** – Node zlib への直接依存を CompressionPort 経由にする。
27. **GC 呼び出しを禁止** – `global.gc` を Domain から排除し、メモリ管理はランタイム設定に委譲する。
28. **人工遅延ロジックをテスト限定に** – IndexedDB リポジトリの `simulateLatency` を開発専用フラグで切り替える。
29. **固定スリープを除去** – パイプラインの疑似待機をメトリクス収集やステートマシンへ置換し、実測値で制御する。
30. **CommonJS 判定を削除** – ESM 対応のファイルアクセスポートを提供し、require 判定を排除する。
31. **TextEncoder 利用をヘルパーへ集約** – バイトサイズ計算を環境非依存の UtilityPort にまとめる。
32. **Node バッファ/zlib を扱う実装を Infrastructure へ** – Domain は圧縮ポートを要求するのみとする。
33. **Biome 永続化でもインフラ責務を分離** – Node API を利用する処理を Infrastructure 層へ集約し、Domain から直接呼び出さない。
34. **ID 生成を Port 化** – `randomUUID` を IDGeneratorPort に置換し、テスト時には deterministic generator を注入する。
35. **イベント ID も Port 経由で生成** – Domain イベント生成部で IDGenerator を利用する。
36. **オートセーブはスケジューラに委譲** – `setupAutoSave` を Application サービスへ移し、Domain では保存トリガーのみ提供する。
37. **未実装メソッドのスタブを解消** – TODO 項目を明確な NotImplemented エラーにするか、最小限の実装を追加する。
38. **メトリクス収集を監視層に委譲** – Repository が保持するパフォーマンスデータを Observability サービスへ移す。
39. **バックアップ処理を Infrastructure に移す** – ファイルコピーやローテーションは専用アダプタで実装する。
40. **イベント配信をメッセージング層へ切り出し** – Queue/Stream 操作を Domain から外し、PubSubPort を用意する。
41. **World aggregate index を整理** – `@domain/world_generation/...` の再輸出を削除し、World BC が World Generation BC を直接公開しないよう修正する。
42. **World Domain Service の再輸出停止** – World BC から world_generation サービスを取り除き、依存が必要なら Application 層で組み合わせる。
43. **World Factory index の再構成** – world_generation ファクトリの再エクスポートを中止し、World BC 固有のファクトリのみ公開する。
44. **World 値オブジェクトを独自定義** – Biome 座標の直輸入をやめ、World BC 向け座標モデルを定義する。
45. **Inventory 環境別 Layer を Composition に委譲** – Domain で `Development/Production` を切り替えず、アプリ側でリポジトリ構成を選択する。
46. **リポジトリ初期化/終了処理を Application 層へ** – Domain の helper 関数を削除し、ブートストラッププロセスが明示的に呼び出す。
47. **Clock 依存を注入可能に** – `Clock.currentTimeMillis` を DomainClockPort 経由で取得する。
48. **乱数利用箇所を随机性ポートへ移す** – Domain では deterministic な RandomPort を使い、ユースケースによって実装を差し替える。
49. **キャッシュ戦略のスケジューリングをアプリ層で制御** – Cleanup タスクを scheduler に委任し、Domain は閾値与件のみ返す。
50. **Node FS を扱う永続化を Infrastructure に** – Persistence 実装を Domain から外し、インフラ層で提供する。
51. **型ガードの依存を削減** – World TypeGuard が他 BC の Schema に依存しないよう、必要な情報だけを受け取る。
52. **World Helper の cross-BC 依存を解消** – WorldHelper は World 内のユースケースのみに限定し、外部 BC のファクトリ呼び出しは Application 層へ移す。
53. **リポジトリ層の cross-BC Config を排除** – WorldRepositoryLayerConfig から world_generation の設定型を切り離し、独立したポートを定義する。
54. **World Helper の Application 呼び出しを禁止** – Domain 内で `WorldApplicationService` を取得せず、アプリケーション側に処理を委譲する。
55. **WorldDomain の API を純粋な Domain 構成に限定** – `ApplicationServices` を WorldDomainInterface から除外する。
56. **chunk_loader の Application ディレクトリを移動** – `src/domain/chunk_loader/application` を `src/application/chunk_loader` へ移行する。
57. **Domain サービスとメトリクスの結合を解消** – オブザーバビリティ層からメトリクスを注入し、Domain 側は Port を介して記録する。
58. **物理サービスの観測依存を削除** – `physicsStepDuration` などは ObservabilityPort に切り替える。
59. **Stub 実装を明確に** – `compressData` などのモックを TODO コメント付きの NotImplemented エラーへ置換する。
60. **簡易チェックサムを Port 化** – データ整合性は HashPort を使って実装する。
61. **Biome → World 依存を整理** – Biome BC に World 型/エラーが必要なら共通コンテキストへ抽象化し、直接 import を削減する。
62. **Biome リポジトリの Node 依存排除** – Node API をファイルストレージアダプタへ委譲し、Domain はインターフェースだけ参照する。
63. **Biome 値オブジェクトの共通ユーティリティを分離** – `taggedUnion` を共有ライブラリに切り出すか、Biome 専用ユーティリティを定義する。
64. **World Generation サービスの World 依存を削減** – 座標やノイズ設定を共通ポート・DTO として抽象化し、BC 間の直接依存を減らす。
65. **ファクトリが参照する World 集約を DTO 化** – 世界生成結果を独立 DTO として定義し、World 集約型への依存を断つ。
66. **ファクトリから World ドメインサービスを切り離す** – World Generation 側には独自サービスを用意し、World BC のサービスを直接呼ばない。
67. **リポジトリインターフェースを共通ポートに** – GenerationSession Repository は World BC の型ではなく、独立した識別子/DTO を利用する。
68. **値オブジェクトのユーティリティ依存を再考** – `taggedUnion` を BC に閉じた関数に書き換える。
69. **イベントが参照する Chunk 型を抽象化** – WorldGeneration イベントは独自の Chunk DTO を持ち、Chunk BC の schema を import しない。
70. **テンプレートと world 型の切り分け** – GenerationSession テンプレートで必要な構造を共通 DTO として定義し、World 集約 schema への依存を減らす。
71. **メタデータに含まれるビルド情報を削除** – バージョン/バンドルサイズ等はドキュメントや build system へ移し、ドメインモデルから取り除く。
72. **設定からリポジトリ schema を排除** – WorldDomainConfig では RepositoryPort を受け取る形に変更する。
73. **Application フラグを別設定に分離** – `enableApplicationServices` などはアプリ構成に移し、DomainConfig はビジネス設定に限定する。
74. **共通 types.ts を廃止** – BC ごとの index を利用し、`domain/types.ts` は削除または用途限定の facade に縮小する。
75. **壊れた再エクスポートを修正** – 存在しない `chunk/application_service` を削除する。
76. **ドメイン index から Application Live を除外** – `ChunkApplicationServiceLive` の再エクスポートをやめる。
77. **Camera Domain Layer の責務を整理** – CQRS ハンドラを Application 層へ移し、Domain Layer はサービスとリポジトリのみを統合する。
78. **Chunk Domain Layer も同様に整理** – Command/Query ハンドラをアプリ層へ移行する。
79. **開発用実装と本番層の切替をブートストラップで実施** – Domain Layers は具体的リポジトリに依存しない。
80. **Read Model をアプリケーションへ移す** – WorldGenerationReadModel を Application サービスで組み立てる。
81. **chunk_loader/application を移動** – ドメインツリーからアプリケーションロジックを排除する。
82. **ChunkLoadingProvider の疑似ロジックをテスト専用に隔離** – 本番ロジックは純粋なドメイン計算/状態遷移のみにする。
83. **Physics Performance Service を Observability に移動** – 物理 Domain はパフォーマンス調整の指針のみ返し、メトリクス収集は外部へ委譲。
84. **World Lifecycle イベントを業務イベントに限定** – SystemStart/GC などインフライベントは監視レイヤーへ移す。
85. **Scene → World 依存を解消** – Scene BC で必要な World ID を抽象化し、UI 層はアプリサービス経由で World と連携する。
86. **GameSceneController のユースケースをアプリ層へ移管** – プレイヤー状態操作は Application/Domain Service を通じて行う。
87. **SceneManager の状態遷移をアプリ側で管理** – Domain ではシーン状態モデルと制約のみ提供する。
88. **ViewDistance の LOD 計算をルールに限定** – PerformanceMetrics はアプリ層から数値として渡し、Domain 値オブジェクトがメトリクスを持たないようにする。
89. **FeatureFlags から環境依存を除外** – 環境別設定はアプリケーション構成に移動し、ドメインは機能可否のルールのみ扱う。
90. **プリセットの運用設定を外部化** – `logLevel` や `recommendedThreads` などは運用ガイドへ移し、プリセットは純粋なゲームルールのみ記述する。
91. **Scene index の不要 export を修正** – 存在するモジュールだけを再エクスポートする。
92. **ChunkLoader index の公開 API を整理** – Domain からアプリ層実装 (`ChunkLoadingProviderLive`) を除外する。
93. **Furniture Application Service をアプリ層へ移行** – Domain には家具のビジネスロジックのみ残す。
94. **ChunkSystem の sleep を外部制御に** – スケジューリングをアプリ層へ任せ、Domain は `delta` 計算のみ行う。
95. **BiomeSystemFactory の疑似待機を削除** – 遅延はテストダブルで表現し、本番ロジックは純粋に。
96. **Chunk Performance の GC 対応を除外** – メモリ制御はランタイム設定で行い、ドメイン処理は deterministic に。
97. **Composite Operations の sleep を削除** – 代わりにバッチサイズ調整や backpressure を導入する。
98. **オーケストレータの固定待機を撤廃** – 実際の生成結果を受け取る非同期処理に置換する。
99. **テンプレートに含まれる運用情報を抽象化** – CPU/メモリ要求などはドキュメント化し、ドメインテンプレートは生成ロジックだけ持つ。
100. **テンプレート検索のスコアリングをアプリケーションへ移す** – Domain はテンプレートのメタデータを提供し、検索/スコアリングはアプリ層で実装する。
