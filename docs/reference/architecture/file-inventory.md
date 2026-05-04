# ファイル棚卸し結果

## 対象範囲

現行の package-by-feature 構成に合わせ、`src/main.ts` と `packages/**/*.ts` / `packages/**/*.tsx` を棚卸し対象にする。

## 区分ルール

- `packages/<feature>/domain`: pure domain data, values, rules, and ports.
- `packages/<feature>/application`: Effect services, use cases, and orchestration.
- `packages/<feature>/infrastructure`: external adapters such as Three.js, workers, persistence, and browser APIs.
- `packages/<feature>/presentation`: DOM/UI-facing presentation code.
- `packages/<feature>/test`: package-local unit tests and test helpers.
- `src/main.ts`: application entrypoint and package layer composition.

## 区分別件数

| レイヤー | 件数 |
| --- | ---: |
| (root) | 10 |
| application | 108 |
| bootstrap | 1 |
| domain | 120 |
| infrastructure | 46 |
| presentation | 60 |
| test | 194 |

## パッケージ別件数

| パッケージ | 件数 |
| --- | ---: |
| (entrypoint) | 1 |
| app | 119 |
| entities | 47 |
| game | 45 |
| inventory | 31 |
| kernel | 31 |
| physics | 21 |
| player | 36 |
| rendering | 68 |
| terrain | 99 |
| world-state | 41 |

## 参照データ

- 詳細なファイル一覧は `docs/reference/architecture/file-inventory.json` を参照。
- 依存グラフは `docs/reference/architecture/dependency-graph.json` を参照。
