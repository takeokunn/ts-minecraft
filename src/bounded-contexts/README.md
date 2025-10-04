# Bounded Context Modules

Bounded Context 単位で `domain / application / infrastructure / interface` を明確に分離するためのルートディレクトリです。各文脈は以下の規約を満たします。

- `domain`: ドメインモデル、値オブジェクト、ポート定義のみを配置。
- `application`: ユースケースサービス、DTO、Effect Layer 合成を配置。
- `infrastructure`: ポート実装と外部サービスアダプタを配置。
- `interface`: UI や API など外部との接点を配置。

フェーズ2以降で既存の `src/domain`, `src/application`, `src/infrastructure`, `src/presentation` から順次移動します。
