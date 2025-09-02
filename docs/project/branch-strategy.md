# ブランチ戦略 (Branch Strategy)

本プロジェクトでは、シンプルさと迅速なデプロイを重視し、[GitHub Flow](https://docs.github.com/ja/get-started/quickstart/github-flow) をベースとしたブランチ戦略を採用しています。

---

## `main` ブランチ

- `main` ブランチは、常にデプロイ可能な安定した状態を維持します。
- 直接 `main` ブランチにコミットすることは固く禁じられています。すべての変更は、フィーチャーブランチからのプルリクエストを通じてマージされる必要があります。

## フィーチャーブランチ

- 新しい機能の開発、バグ修正、リファクタリングなど、あらゆる変更は `main` ブランチから作成されたフィーチャーブランチで行います。
- ブランチ名は、その目的が明確にわかるように命名します。

### 命名規則

- 形式: `<type>/<short-description>`
- `<type>` には、[Conventional Commits](https://www.conventionalcommits.org/) の `type` を使用します。
  - `feat`: 新機能 (e.g., `feat/add-new-block-type`)
  - `fix`: バグ修正 (e.g., `fix/player-collision-issue`)
  - `refactor`: リファクタリング (e.g., `refactor/optimize-rendering-system`)
  - `docs`: ドキュメント (e.g., `docs/update-architecture-diagram`)
  - `chore`: その他 (e.g., `chore/update-ci-config`)

## プルリクエスト (Pull Request)

- 作業が完了したフィーチャーブランチは、`main` ブランチへのプルリクエストを作成します。
- プルリクエストには、変更の目的、内容、テスト方法などを明確に記述します。
- CI（継続的インテグレーション）のチェックがすべて成功していることがマージの必須条件です。
- （将来的には）コードレビューで1人以上から承認 (Approve) を得ることが必須となります。

## 開発フローの例

1.  `main` ブランチを最新の状態に更新します。
    ```bash
    git checkout main
    git pull origin main
    ```
2.  新しいフィーチャーブランチを作成します。
    ```bash
    git checkout -b feat/implement-crafting-system
    ```
3.  コードを実装し、コミットします。コミットメッセージは[規約](./conventions.md#5-コミットメッセージ)に従います。
    ```bash
    git add .
    git commit -m "feat: add crafting table entity and basic recipe system"
    ```
4.  作業が完了したら、ブランチをリモートにプッシュします。
    ```bash
    git push origin feat/implement-crafting-system
    ```
5.  GitHub上で `main` ブランチへのプルリクエストを作成します。
6.  CIのチェックが通るのを待ち、（レビューを経て）プルリクエストをマージします。
7.  マージ後、不要になったフィーチャーブランチは削除します。