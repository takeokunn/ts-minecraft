---
title: '開発環境セットアップ - devenv + pnpm 実行手順完全ガイド'
description: 'プロジェクト同梱の devenv プロファイルを利用して TypeScript 型チェックと Vitest 実行を安定させるための実践的セットアップ手順'
category: 'how-to'
difficulty: 'beginner'
tags: ['setup', 'devenv', 'pnpm', 'typescript', 'vitest', 'effect-ts']
prerequisites: ['basic-typescript']
estimated_reading_time: '5分'
related_patterns: ['effect-ts-project-bootstrap']
related_docs: ['./development-conventions.md', './entry-points.md', '../testing/testing-guide.md']
ai_context:
  primary_concepts: ['devenv', 'environment-setup', 'pnpm', 'typecheck', 'vitest']
  prerequisite_knowledge: ['shell-basics']
  estimated_completion_time: '10分'
  complexity_level: 2
code_examples:
  executable: true
  language: 'bash'
  framework: 'devenv'
---

## 目的

プロジェクト付属の `.devenv/profile` には固定バージョンの `node` と `pnpm` が格納されている。`PATH` を明示的に切り替えて実行することで、ローカル環境の差分による `tsc`/`vitest` の失敗を防ぐ。

## 手順

1. **ラッパースクリプトの利用**
   - `./scripts/dev-shell.sh` は自動で `.devenv/profile/bin` を `PATH` に追加し、指定コマンドを実行する。
   - 引数を省略した場合は devenv が優先された対話シェルが開く。

2. **型チェックの実行**

   ```bash
   ./scripts/dev-shell.sh pnpm tsc --noEmit
   ```

   - `pnpm`/`node` が見つからないエラーが解消される。

3. **Vitest の実行**

   ```bash
   ./scripts/dev-shell.sh pnpm vitest run
   ```

   - `@effect/vitest` を含むテストが devenv 経由で安定して実行できる。

4. **既存シェルとの連携**
   - `./scripts/dev-shell.sh` を `direnv` や `make` などから呼び出すことで、CI と同一のバージョンをローカルに揃えられる。

## トラブルシューティング

- `.devenv/profile/bin` が存在しない場合は `devenv up` を実行してプロファイルを再生成する。
- 既存の環境変数で別バージョンの pnpm が優先されるケースでは、`hash -r` でコマンドキャッシュをクリアする。

## 次のステップ

- コーディング規約は `docs/how-to/development/development-conventions.md` を参照。
- Effect-TS への全面移行手順は `docs/how-to/development/effect-ts-migration-guide.md` を参照。
