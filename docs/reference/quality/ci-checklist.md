---
title: 'CI チェックリスト'
description: 'フェーズ7で整備するテスト/型チェック/依存検証の実行順序。'
category: 'quality'
priority: 'high'
tags: ['ci', 'testing']
related_docs:
  - './dependency-rules.md'
  - '../../resources/phase7-test-counts.json'
---

# CI チェックリスト

1. **TypeScript Build**
   - `pnpm typecheck` (`tsc --noEmit`)
   - 今後 `tsc --build` へ移行予定、既知の型エラーはフェーズ3〜6で解消。
2. **Dependency Rules**
   - `pnpm lint:deps`
3. **Unit Tests**
   - `pnpm test:domain`
   - `pnpm test:application:legacy`
   - `pnpm test:application:new`
4. **Interface Tests**
   - `pnpm test:interface`
5. **Integration / Snapshot**
   - `pnpm test:integration`
6. **Code Style**
   - `pnpm format:check`
   - `pnpm editorconfig`

CI では上記を順番に実行し、FASTフィードバックのため型チェックと依存検証を最優先に配置する。
