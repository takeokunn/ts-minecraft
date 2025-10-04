---
title: 'DDD 移行ロードマップ'
description: 'フェーズ0〜7の成果と残タスク、次ステップを整理したロードマップ。'
category: 'explanation'
difficulty: 'intermediate'
tags: ['migration', 'roadmap']
related_docs:
  - './bounded-context-refactor.md'
  - './application-layer-decomposition.md'
  - '../quality/dependency-rules.md'
---

# DDD 移行ロードマップ

| フェーズ | 完了内容 | 次ステップ |
| --- | --- | --- |
| 0 調査 | 依存グラフ生成 (`docs/resources/phase0-dependency.*`)、モジュール規模分析 | ルール導入後に再評価 |
| 1 ディレクトリ再設計 | `tsconfig.base.json`、Project References 骨子、Bounded Context ガイド作成 | `tsc --build` 対応と型エラー解消 |
| 2 ドメイン純化 | Inventory Storage Port 定義を Domain へ移設、Bounded Context `public.ts` 追加 | `GameApplication` 依存の段階的分離 |
| 3 アプリケーション層再編 | ユースケース雛形を `bounded-contexts/*/application` に配置、分割計画策定 | Facade 実装の差し替え |
| 4 インフラ再配置 | アダプタ棚卸し、再配置先ディレクトリ作成 | 実装移動とテスト更新 |
| 5 プレゼンテーション整備 | ViewModel 分離方針と interface 雛形 | Inventory UI の DTO 化 |
| 6 Shared Kernel | primitives/time/math/effect プレースホルダ整備、依存ルール草案 | 候補モジュールの実移動 |
| 7 テスト/CI | テストピラミッドスクリプト追加、CI チェックリスト作成 | GitHub Actions 更新 |

## グローバル次ステップ

1. フェーズ3〜5の TODO を Issue 化し、責務ごとにスプリントへ割り当てる。
2. dependency-cruiser 設定を実装し、CI で強制。
3. Shared Kernel への実移行を行い、Affected Modules を段階的に削除。
