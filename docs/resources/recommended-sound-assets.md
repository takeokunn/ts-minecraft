# 推奨音源アセットリスト

## 📋 概要
TypeScript Minecraft Cloneプロジェクトで使用可能な高品質フリー音源のキュレーションリストです。
全て商用利用可能なCC0ライセンスまたは帰属表示不要の素材を厳選しています。

## 🎯 必須音源カテゴリ

### 1. ブロック破壊音

#### Freesound.org
- **石ブロック破壊音**
  - URL: https://freesound.org/people/ryanconway/sounds/240801/
  - ライセンス: 要確認
  - 説明: Pickaxe mining stone - ツルハシで石を採掘する音

- **岩石破砕音**
  - URL: https://freesound.org/people/iwanPlays/sounds/567249/
  - ライセンス: CC0
  - 説明: Bricks/Stones/Rocks/Gravel Falling - 石や砂利の落下音（破壊音として利用可能）

#### Pixabay
- **ブロック破壊汎用**
  - URL: https://pixabay.com/sound-effects/search/block/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: ブロック関連の効果音コレクション

#### OpenGameArt.org
- **100 CC0 SFX #2**
  - URL: https://opengameart.org/content/100-cc0-sfx-2
  - ライセンス: CC0
  - 説明: 石・木材の破壊音を含む100種類の効果音パック

### 2. ブロック設置音

#### Pixabay
- **木材ブロック設置**
  - URL: https://pixabay.com/sound-effects/search/wood-block/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 木製ブロックの設置音

- **石ブロック設置**
  - URL: https://pixabay.com/sound-effects/search/stone/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 石の設置・衝撃音

#### OpenGameArt.org
- **100 CC0 metal and wood SFX**
  - URL: https://opengameart.org/content/100-cc0-metal-and-wood-sfx
  - ライセンス: CC0
  - 説明: 木材の設置・衝撃音を含むサウンドパック

### 3. 足音

#### Freesound.org
- **Minecraft関連ダウンロード済み音源**
  - URL: https://freesound.org/people/minecraft/downloaded_sounds/
  - ライセンス: 個別確認必要
  - 説明: Minecraftユーザーがダウンロードした音源リスト（参考用）

#### Pixabay
- **石の足音**
  - URL: https://pixabay.com/sound-effects/search/footsteps%20on%20stones/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 石の上を歩く足音

- **土・砂の足音**
  - URL: https://pixabay.com/sound-effects/search/dirt/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 土や砂の上を歩く音

- **木材の足音**
  - URL: https://pixabay.com/sound-effects/search/wood/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 木材の上を歩く音

- **汎用足音コレクション**
  - URL: https://pixabay.com/sound-effects/search/footstep/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: 様々な材質の足音

#### OpenGameArt.org
- **Different steps on wood, stone, leaves, gravel and mud**
  - URL: https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud
  - ライセンス: CC0
  - 説明: 8種類の異なる材質（木、石、葉、砂利、泥）の足音
  - タグ: footstep, minecraft, stone, wood, leaves, dirt

- **Footstep Sounds**
  - URL: https://opengameart.org/content/footstep-sounds
  - ライセンス: CC0
  - 説明: 石、水、雪、木、土の上を歩く足音

- **Fantozzi's Footsteps (Grass/Sand & Stone)**
  - URL: https://opengameart.org/content/fantozzis-footsteps-grasssand-stone
  - ライセンス: CC0
  - 説明: 12種類の単一足音（草/砂、石）

### 4. アンビエント・BGM

#### Pixabay
- **ゲーム音楽・アンビエント**
  - URL: https://pixabay.com/music/
  - ライセンス: 商用利用無料・帰属表示不要
  - 説明: ループ可能なBGM、アンビエント音楽

#### OpenGameArt.org
- **CC0 Sounds Library**
  - URL: https://opengameart.org/content/cc0-sounds-library
  - ライセンス: CC0
  - 説明: CC0ライセンスの汎用サウンドライブラリ

### 5. その他の効果音

#### itch.io
- **CC0 Game Assets**
  - URL: https://itch.io/game-assets/free/tag-cc0
  - ライセンス: CC0
  - 説明: インディーゲーム開発者による高品質CC0アセット

## 🛠️ 実装推奨事項

### ダウンロード手順
1. 各URLにアクセスして音源をダウンロード
2. ファイル形式を`.ogg`に統一（Web Audio API推奨形式）
3. `public/assets/sounds/`以下の適切なディレクトリに配置

### ファイル命名規則
```
{material}.{action}.ogg

例：
- stone.break.ogg
- stone.place.ogg
- stone.step.ogg
- dirt.break.ogg
- wood.place.ogg
```

### 品質チェックリスト
- [ ] ファイルサイズ: 100KB以下推奨
- [ ] サンプルレート: 44.1kHz推奨
- [ ] ビットレート: 128kbps以上
- [ ] ループノイズがないことを確認
- [ ] 音量レベルの正規化（-12dB推奨）

## 📝 ライセンス記録テンプレート

```json
{
  "assetId": "stone.break",
  "source": "OpenGameArt.org",
  "author": "作者名",
  "license": "CC0",
  "url": "https://...",
  "downloadDate": "2025-01-27",
  "modifications": "none",
  "attribution": null
}
```

## ⚠️ 注意事項

- **ライセンス確認**: ダウンロード前に必ず各音源のライセンスを個別確認
- **CC0優先**: 可能な限りCC0（パブリックドメイン）を選択
- **帰属表示**: CC-BYライセンスの場合は適切なクレジット表記を追加
- **改変記録**: 音源を編集した場合は変更内容を記録

## 🔗 追加リソース

### 音源編集ツール（無料）
- **Audacity**: https://www.audacityteam.org/
- **ocenaudio**: https://www.ocenaudio.com/

### フォーマット変換
- **CloudConvert**: https://cloudconvert.com/mp3-to-ogg
- **FFmpeg**: コマンドライン変換ツール

## 📊 推奨優先順位

1. **最優先**: OpenGameArt.org「Different steps」コレクション（CC0・Minecraft用途明記）
2. **高優先**: Pixabay音源（帰属表示不要・商用利用可）
3. **中優先**: OpenGameArt.org その他CC0コレクション
4. **低優先**: Freesound.org（ライセンス個別確認必要）

この優先順位に従って音源を選択することで、ライセンス管理の簡素化と品質の一貫性を保つことができます。