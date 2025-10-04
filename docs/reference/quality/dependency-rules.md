---
title: 'Dependency-Cruiser ルール草案'
description: 'フェーズ6で導入する依存関係検証ルールと検証フロー。'
category: 'quality'
priority: 'high'
tags: ['dependency-cruiser', 'static-analysis']
related_docs:
  - '../architecture/bounded-context-refactor.md'
  - '../../resources/phase4-infrastructure-adapters.json'
---

# Dependency-Cruiser ルール草案

## 主要ルール

1. `src/domain/**` から `src/infrastructure/**` への import を禁止。
2. `src/bounded-contexts/<context>/domain` は同一コンテキスト内の `application/infrastructure/interface` のみ参照可能。
3. `shared-kernel` は循環禁止かつ他ディレクトリからの逆依存を禁止。
4. `presentation` 直下から `@domain/*` への import を禁止し、`@mc/bc-*/interface/view-models` のみ許可。
5. `platform` から各コンテキストへの依存は `application` レベルまでに限定。

## 設定テンプレート

```json
{
  "forbidden": [
    {
      "name": "domain-to-infrastructure",
      "from": { "path": "^src/domain" },
      "to": { "path": "^src/infrastructure" }
    },
    {
      "name": "presentation-to-domain",
      "from": { "path": "^src/presentation" },
      "to": { "path": "^src/domain" }
    }
  ],
  "allowed": [
    { "from": { "path": "^src/bounded-contexts/world/domain" }, "to": { "path": "^src/bounded-contexts/world/(application|infrastructure|interface)" } }
  ]
}
```

## 検証フロー

1. `npx dependency-cruiser --init` で `dependency-cruiser.config.cjs` を作成し、上記テンプレートを反映。
2. CI で `pnpm dlx dependency-cruiser --config dependency-cruiser.config.cjs "src/**/*.{ts,tsx}"` を実行。
3. 違反が検出された場合は GitHub Actions で PR を失敗させ、該当ファイルをフェーズ別バックログへ登録。

## 次のアクション

- [ ] ルールセットを実装し、`docs/resources/phase0-dependency.json` で検証。
- [ ] `shared-kernel` へ移行した値オブジェクトに対する逆依存ルールを追加。
