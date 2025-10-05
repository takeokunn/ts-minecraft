# ファイル棚卸し結果

## 区分ルール

- 構造変更対象: `src/application`, `src/domain`, `src/infrastructure`, `src/presentation` 内のファイル。DDD再編時に責務分割とレイヤー再構築を実施予定。
- 移行対象: 上記以外 (`src/bootstrap`, `src/testing`, 直下ユーティリティ等)。新構成へ配置替えまたはサポート層への転用を想定。

## 区分別件数

| 区分 | 件数 | 比率 |
|------|------|------|
| 構造変更対象 | 918 | 97.9% |
| 移行対象 | 20 | 2.1% |
| 合計 | 938 | 100.0% |

## ディレクトリ別内訳

| トップディレクトリ | 合計 | 構造変更対象 | 移行対象 |
|-----------------|------|--------------|-----------|
| domain | 843 | 843 | 0 |
| infrastructure | 35 | 35 | 0 |
| presentation | 23 | 23 | 0 |
| application | 17 | 17 | 0 |
| bootstrap | 16 | 0 | 16 |
| (root) | 3 | 0 | 3 |
| testing | 1 | 0 | 1 |

## 追加メモ

- 詳細なファイル一覧は `docs/reference/architecture/file-inventory.json` を参照。
- 直下 (`src/app.ts` など) は暫定的に移行対象とし、Phase 1 完了時に再評価する。
- 依存グラフ再生成は `.dependency-cruiser.cjs` を利用して `pnpm dlx dependency-cruiser src --config .dependency-cruiser.cjs --output-type json --output-to docs/reference/architecture/dependency-graph.json` を実行する。