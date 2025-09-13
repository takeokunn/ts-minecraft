# 付録

TypeScript Minecraft Cloneプロジェクトに関する参考情報とリソース集です。

## 📚 リソース一覧

### 📖 **参考資料**
- **[用語集](00-glossary.md)** - プロジェクト全体で使用される技術用語と概念の詳細定義
- **[アセット出典](01-asset-sources.md)** - 使用している外部アセットのライセンスと出典情報

## 🔍 用語集の活用方法

### 📋 **カテゴリ別索引**
用語集では以下のカテゴリで技術用語を整理しています:

#### 🏗️ **アーキテクチャ関連**
- **DDD**: Aggregate, Entity, Value Object, Repository
- **ECS**: Entity, Component, System, Archetype
- **レイヤード**: Domain, Application, Infrastructure

#### ⚡ **技術スタック**
- **Effect-TS**: Effect, Context, Schema, Service
- **Three.js**: WebGL, WebGPU, TSL
- **TypeScript**: 型システム関連用語

#### 🎮 **ゲーム固有**
- **Minecraft**: Block, Chunk, Biome, Voxel
- **グラフィックス**: LOD, Frustum Culling, Greedy Meshing
- **物理**: AABB, 衝突検知

### 🔗 **リンク機能**
各用語にはアンカーID（例: `#chunk`）が設定されており、
ドキュメント間での相互参照が可能です。

```markdown
詳細は[チャンク](../04-appendix/00-glossary.md#chunk)を参照してください。
```

### 📝 **用語の追加・更新**
新しい技術用語や概念が導入された場合は、
用語集への追加を推奨します。

## 🖼️ アセット管理

### 📄 **ライセンス遵守**
本プロジェクトで使用する外部アセットは
[アセット出典](01-asset-sources.md)にて管理しています。

### 🔍 **出典確認**
- 新しいアセットの追加時は必ずライセンス確認
- 適切な帰属表示とライセンス遵守
- 商用利用可能性の事前確認

## 🔗 関連ドキュメント

### 📚 **メインドキュメント**
- **[アーキテクチャ](../01-architecture/)** - システム設計の詳細
- **[仕様書](../02-specifications/)** - 機能仕様の定義
- **[開発ガイド](../03-guides/)** - 実装・運用ガイド

### 🌐 **外部リソース**
効率的な学習のための推奨外部リソース:

#### 📘 **技術文書**
- [Effect-TS 公式ドキュメント](https://effect.website/)
- [Three.js 公式ドキュメント](https://threejs.org/docs/)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/)

#### 📖 **設計手法**
- [Domain-Driven Design](https://www.amazon.com/dp/0321125215) - Eric Evans
- [Clean Architecture](https://www.amazon.com/dp/0134494164) - Robert C. Martin
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) - Robert Nystrom

## 💡 活用のコツ

### 🎯 **効率的な情報検索**
1. **キーワード検索**: ブラウザの検索機能（Ctrl+F / Cmd+F）
2. **アンカーリンク**: 他ドキュメントからの直接参照
3. **カテゴリ分類**: 関連用語の体系的理解

### 📝 **貢献方法**
- 用語定義の改善提案
- 新しいアセット情報の追加
- 外部リソースの推奨

---

📚 **ヒント**: 理解が曖昧な用語に遭遇したら、まず用語集を確認することを習慣化しましょう。