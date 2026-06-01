---
title: 'リファクタ契約'
description: 'ts-minecraft モノレポを Effect-TS + DDD の目標状態へ揃えるためのレイヤー規約、禁止事項、テスト方針、命名規則'
category: 'architecture'
priority: 'critical'
related_docs:
  - 'docs/reference/architecture/src-directory-structure.md'
  - 'docs/reference/domain-effect-guideline.md'
  - 'docs/how-to/development/development-conventions.md'
tags: ['architecture', 'refactor-contract', 'ddd', 'effect-ts', 'testing', 'naming']
---

# リファクタ契約

## 概要

本ドキュメントは、ts-minecraft モノレポをリファクタ後の目標状態へ揃えるための契約である。対象は `packages/` 配下の 11 package と `src/main.ts` から接続される起動・合成コードであり、DDD のレイヤー分離、Effect-TS 3.20 準拠、テスト可能性、命名、ファイルサイズの基準を定義する。

この契約は個別 package の詳細設計を置き換えない。各 bounded context の実装詳細、性能上の局所最適化、Three.js/WebGL 固有の手順は、対象 package のリファクタ計画で決める。本ドキュメントは、すべてのリファクタが満たす共通の完了条件を示す。

## ディレクトリ構造規約

実装は package-by-feature を維持する。機能境界ごとに `packages/<feature>` を置き、巨大な横断レイヤーツリーへ戻さない。

```
packages/<feature>/
├── domain/                         # pure data, rules, schemas, ports
├── application/                    # Effect services, use cases, orchestration
├── infrastructure/                 # external adapters and resource wrappers
├── presentation/                   # UI-facing state and interaction services
├── test/                           # package-local tests, fixtures, fakes
└── index.ts                        # public package surface
```

- `domain` は外部 API、Three.js、DOM、Worker、IndexedDB、実時間 I/O に依存しない。
- `application` は use case と orchestration を担当し、domain の型・関数・port に依存する。
- `infrastructure` は外部実装を adapter として接続し、domain/application に定義された port を実装する。
- `presentation` は UI・入力・表示状態を扱い、状態変更は Effect service 経由に限定する。
- package 外からの利用は `@ts-minecraft/<package>` の公開 surface を優先する。deep import は明示的に公開された path alias のみに限定する。
- 存在しない責務のために空レイヤーディレクトリを作らない。

## ドメイン層規約

`domain/` は pure TypeScript と Effect Schema によるモデル・ルール・port 定義の場所である。副作用の実行、外部リソース生成、実装 adapter は置かない。

- `schemas.ts` は永続化・通信・境界入力に使う Schema、ブランド型、ADT の定義を置く。
- `ports.ts` は外部依存の抽象 interface または service contract を置く。実装は置かない。
- `errors.ts` は domain/application で扱う typed error を定義する。`Data.TaggedError` または Schema ベースの ADT を標準とする。
- entity ごとのファイルは、状態型、pure constructor、validation、状態遷移関数をまとめる。
- domain rule は pure function として書き、`Effect` が不要な計算を無理に Effect 化しない。
- 時刻、乱数、保存先、レンダラ、入力デバイスなどの環境依存は port として表現する。
- `Error` 継承、未型付け例外、`any` による境界突破を導入しない。

## アプリケーション層規約

`application/` はユースケースとレイヤー合成の境界である。domain の pure rule と port を組み合わせ、呼び出し側に型付けされた Effect API を提供する。

- long-lived service は `Effect.Service` と `Layer` で定義する。
- use case は `Effect.gen` を標準の制御フローとし、成功値・要求環境・失敗型を明示する。
- エラーは typed error channel で返す。`Effect<Success, DomainError | ApplicationError, Env>` のように失敗型を追跡可能にする。
- 依存注入は `Layer` の合成で行い、グローバル singleton や module-level mutable state を使わない。
- retry、timeout、schedule、resource scope は Effect の combinator で表現する。
- `Promise` を直接返さない。外部 API を包む場合のみ `Effect.tryPromise` または `Effect.fromPromise` を adapter 境界で使う。

## インフラ層規約

`infrastructure/` は外部ライブラリ、ブラウザ API、GPU/Worker/IndexedDB などを domain/application の port へ接続する adapter 層である。

- ここに置く実装は adapter のみに限定する。domain rule や use case decision を混在させない。
- 外部リソースは `Effect.Service` wrapper と `Layer.scoped` / `Effect.acquireRelease` で管理する。
- Three.js、WebGL、Worker、IndexedDB、performance API などの直接呼び出しはこの層へ閉じ込める。
- 外部 API の例外や rejected promise は typed error に変換してから上位へ返す。
- adapter は port の契約を満たす最小 surface を公開し、外部ライブラリの型を上位レイヤーへ漏らさない。

## プレゼンテーション層規約

`presentation/` は DOM/UI 入出力、入力イベント、画面状態、ユーザー操作に近い状態変換を扱う。ゲームロジックの決定権は domain/application に置く。

- presentation state は `Ref`、`MutableRef`、`SubscriptionRef` など Effect の state primitive に閉じ込める。
- UI 操作は Effect service として公開し、直接 mutable object を package 外へ渡さない。
- DOM event、Pointer Lock、keyboard/mouse 入力は adapter として受け取り、application service に変換して渡す。
- UI 都合のキャッシュや view model は presentation 内に閉じる。
- browser-only の処理はテスト対象の pure 変換関数と、実ブラウザで検証する薄い adapter に分ける。

## Effect-TS準拠ルール

リファクタ後のコードは Effect-TS を副作用、依存注入、エラー処理、リソース管理の標準とする。

禁止パターンは次の通りである。

- raw `Promise` を API として返すこと。
- raw `try/catch` で例外を握りつぶすこと。
- raw `Error`、`throw new Error()`、未分類の rejected promise を上位へ流すこと。
- non-Effect classes に service 実装や domain behavior を集約すること。
- `new Date()`、`Math.random()`、実 I/O を domain/application から直接呼び出すこと。
- 空の `catch`、`void promise`、unchecked async callback を残すこと。

外部 API との境界では `Effect.try`, `Effect.tryPromise`, `Effect.sync`, `Effect.acquireRelease` を使い、失敗を typed error へ変換する。

## 許可されるクラス例外

原則として `class` は使用しない。ただし、次の用途は例外として許可する。

- `Schema.Class`: Schema 駆動のデータモデル定義に使う場合。
- `Data.TaggedError`: typed error の定義に使う場合。
- `Effect.Service`: Effect service tag と live 実装の標準定義に使う場合。
- `infrastructure/` 配下の private Three.js adapter subclass: Three.js の継承 API に接続するために必要で、package surface へ公開しない場合。

例外クラスは責務を外部 API 接続または型定義に限定する。domain behavior、use case、状態管理を class に戻さない。

## カバレッジポリシー

Node.js 上でテスト可能な `domain/` と `application/` は 100% coverage を目標ではなく完了条件とする。対象には pure rule、Schema validation、port contract、Layer 合成、typed error path を含める。

除外できるのは、Node.js 単体では実行不能な browser/WebGL/Worker/IndexedDB 依存の実装に限る。除外する場合は次を満たす。

- 除外理由をテストまたは coverage 設定付近に明記する。
- 対応する `ports.ts` の contract test または typed fake test を必ず用意する。
- adapter 境界のエラー変換、入力 validation、resource release path は可能な範囲で Node-testable に分離する。
- browser/WebGL 挙動は E2E、integration、手動検証メモのいずれかで補完する。

coverage 除外は実装困難性ではなく実行環境制約に基づく。domain/application の未テスト分岐を browser-only として除外しない。

## ファイルサイズ制限

production file と test-support file は 300 行以下を目標上限とする。

- 300 行を超える場合は、責務分割、pure helper 抽出、fixture 分割、test case のシナリオ別分割を検討する。
- 例外は generated data、静的テーブル、意図的に集約された Schema catalog など、分割で可読性が下がる場合に限定する。
- 例外を許可する場合でも、domain rule と adapter logic を同一ファイルへ混在させない。

## テスト規約

テストは Effect service と typed dependency を前提に書く。

- Effect を含むテストは `@effect/vitest` を使う。
- 非 scoped な Effect テストは `it.effect`、resource scope が必要なテストは `it.scoped` を使う。
- property-based testing (PBT) は pure domain rule、serializer、state transition、coordinate math、inventory rule など入力空間が広い処理へ優先的に適用する。
- 外部依存は typed fake または test layer で置き換える。
- 型だけを満たす未検証 test double helper は使わない。
- fake は `ports.ts` の contract を満たし、成功 path と typed error path を明示する。
- browser/WebGL/Worker/IDB adapter は、port contract test と adapter 境界の最小 integration test に分ける。

## 命名規則

命名は package-by-feature と Effect service の discoverability を優先する。

- service tag は PascalCase の名詞句にする。例: `ChunkRepository`, `TerrainGenerator`, `RenderFrameService`。
- live layer は `<ServiceName>Live`、test layer は `<ServiceName>Test` または `<ServiceName>Fake` を使う。
- port 定義は `ports.ts`、Schema 定義は `schemas.ts`、typed error は `errors.ts` に置く。
- pure rule ファイルは対象名を含む kebab-case にする。例: `chunk-state.ts`, `inventory-transfer.ts`。
- adapter ファイルは外部技術または実装先を名前に含める。例: `indexed-db-world-storage.ts`, `three-scene-adapter.ts`。
- package public API は `index.ts` から明示 export する。
- `index.ts` は公開 surface のみを扱い、初期化副作用や hidden singleton を置かない。
- internal helper は package 外へ export しない。必要な場合は `test/` 用の明示的な test support export を用意する。

## 相互運用コード削除ポリシー

リファクタは新旧実装を長期併存させる作業ではない。移行対象が完了したら、古い実装 path、互換 wrapper、二重 dispatch、feature flag による旧経路を削除する。

保持してよい互換性は persisted data format に関するものだけである。既存ワールド、IndexedDB 保存データ、セーブファイル、ユーザー設定など、ユーザーの永続データを読み込むための migration/decoder は残す。

- 旧 runtime 実装への fallback は残さない。
- 新旧 service を同じ public API で切り替える compatibility layer は移行完了時に削除する。
- 永続化データの互換 decoder は domain Schema と migration version を通じて管理する。
- 互換コードを残す場合は、何の data format を保護するかをコメントまたはドキュメントで明示する。
