# Bootstrap Layer

## 概要

Bootstrap層は、アプリケーション全体の初期化と依存関係グラフの生成を担う境界づけられたコンテキストです。DDDの観点では、`domain`, `application`, `infrastructure` の3ファイル構成で役割を分離し、Effect-TSを基盤とした純粋なモデルと副作用制御を明確に切り分けています。

## ファイル構成

```
bootstrap/
├── domain.ts          # 値オブジェクト・スキーマ・エラーモデル
├── application.ts     # サービスインターフェースと純粋なユースケース関数
├── infrastructure.ts  # Effect-TS Layerによる実装と依存解決
└── index.ts           # バレルエクスポートのみ
```

## 責務

- **domain.ts**
  - ブートストラップ設定のブランド付き値オブジェクト
  - ライフサイクル状態とスナップショット表現
  - AppErrorのADTとフォーマッタ
- **application.ts**
  - `ConfigService` / `AppService` のポート定義
  - ライフサイクル投影ロジック（`Either`ベースのユースケース）
  - スナップショットの構成ユーティリティ
- **infrastructure.ts**
  - Config ProviderとLayerを組み合わせた実装
  - Effect-TSの`Ref.Synchronized`による状態管理
  - MainLayer / TestLayerの合成

## テスト指針

各実装ファイルに対して1対1で`*.test.ts`を配置し、ユニットテストとEffect-TS版fast-checkによるPBTを組み合わせてカバレッジ100%を維持します。
