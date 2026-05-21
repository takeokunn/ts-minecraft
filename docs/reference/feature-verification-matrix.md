# 機能検証マトリクス (Feature Verification Matrix)

> ts-minecraft の検証可能な機能を**原子レベル**まで細分化したチェックリスト。
> 各項目は ① 正常系/境界/異常系、② 本家仕様 vs 本実装 vs 分類、③ Playwright実行手順、④ 非機能 に分解。
> 生成日: 2026-05-21 / 対象: `packages/*` 11パッケージ + `phase/01〜20.md`

---

## 1. 使い方

- チェック記法: `- [ ]` 未検証 / `- [x]` OK。NGは行末に `← ❌<所見>` を追記。
- **① コードベース** … 正常系・**境界値**・**異常系**を個別にチェック。
- **② 公式差分** … `本家:` 仕様値 / `実装:` 現状 / `分類:` (意図的簡略化 / 未実装 / バグ) の3行1組。
- **③ Playwright** … `window.__TS_MINECRAFT_QA__` を使った**実行ステップ列**(上から順に実行)。
- **④ 非機能** … 性能・安定性・保守性。

## 2. QAフック早見 (`qa-api.ts`)

- インベントリ: `getInventorySnapshot()` `openInventoryForQA()` `moveItemToHotbar(item,idx)` `selectHotbarSlot(idx)`
- クラフト: `craftRecipeForQA(id)` `getRecipeButtons()`
- ブロック: `dispatchMouseClick(0|2)` `consumeMouseClickForQA(b)` `clearBlocksInFront()` `placeSelectedItemInFront()` `getCurrentTargetForQA()`
- 進行: `stageProgressionScenario()` `collectStagedResources()` `aimAtStagedResource(i)` `aimAtBuildSpot()` `stageBuildSupportBlock()`
- 戦闘: `spawnLowHealthZombieInFront()` `aimAtStagedZombie()` `attackFirstZombie()`
- エンティティ: `getEntitySnapshot()` `getMobMovementSnapshot()`
- レンダ/性能: `getRenderingSnapshot()` `getLoadedWaterBlockCount()`

---

## 3. カタログ別 多面チェックリスト

> 各要素を [生成 / 描画 / 破壊→ドロップ / 物理 / 透過] の観点で個別検証。

### 3.1 ブロック (44種)

**地形系**
- **AIR** (hardness 0, transparent, **non-solid**, friction 0)
  - [ ] 生成: 空セルが AIR で初期化される
  - [ ] 描画: 面が一切生成されない(全faces=false)
  - [ ] 物理: solid=false で衝突対象外
  - [ ] 透過: 隣接ブロックの面がカリングされない
- **DIRT** (hardness 50)
  - [ ] 生成: subSurfaceとして配置 / 描画: UV+tileIndex / 破壊: ドロップ / 物理: solid, friction 0.6 / 透過: opaqueカリング
- **STONE** (hardness 100, friction 0.8)
  - [ ] 生成: 地中充填 / 破壊: COBBLESTONE化の有無を確認 / 物理: friction 0.8 / 描画: opaque
- **WOOD** (hardness 30)
  - [ ] 生成: 樹木の幹 / 破壊→ドロップ WOOD / クラフト材料として機能
- **GRASS** (hardness 20)
  - [ ] 生成: 表層(PLAINS等) / 破壊→ドロップ(DIRT or GRASS?要確認) / 上面テクスチャ差
- **SAND** (hardness 10, friction 0.5)
  - [ ] 生成: DESERT/BEACH表層 / 物理: friction 0.5 / 落下挙動(重力砂)の有無を確認
- **WATER** (hardness 0, transparent, **non-solid**)
  - [ ] 生成: SEA_LEVEL以下/湖 / 描画: 専用waterメッシュに分離 / 物理: non-solid通過 / 流体伝播(D3)
- **LEAVES** (hardness 5, transparent)
  - [ ] 生成: 樹冠 / 描画: 透過(隣接カリングしない) / 破壊→ドロップ
- **GLASS** (hardness 5, transparent)
  - [ ] 描画: 透過メッシュ / 破壊: ドロップ無しの有無を確認
- **SNOW** (hardness 5, friction 0.3)
  - [ ] 生成: SNOW/TAIGA表層 / 物理: friction 0.3(滑り)
- **GRAVEL** (hardness 15, friction 0.5)
  - [ ] 生成 / 落下挙動の有無 / 破壊→ドロップ
- **COBBLESTONE** (hardness 80, friction 0.8)
  - [ ] 破壊→ドロップ / かまど/作業台レシピ材料 / 物理
- **GRANITE / DIORITE / ANDESITE** (各 hardness 90)
  - [ ] GRANITE 生成・描画・破壊
  - [ ] DIORITE 生成・描画・破壊
  - [ ] ANDESITE 生成・描画・破壊
- **DEEPSLATE** (hardness 95)
  - [ ] 深層(低Y)で生成 / 破壊
- **BEDROCK** (hardness 100)
  - [ ] 生成: 最下層 / 破壊: **不可であるべき**(要確認) / 物理: solid
- **LAVA** (hardness 0, **emissive**, non-solid)
  - [ ] 生成 / 描画: 発光 / 物理: non-solid / ダメージ源の有無
- **OBSIDIAN** (hardness 100)
  - [ ] 生成(WATER+LAVA?要確認) / 破壊: ダイヤピッケル限定か / 物理

**鉱石系 (hardness 75)** — 各 [生成深度 / 破壊ドロップ(raw or self) / 採掘レベル要件]
- [ ] `COAL_ORE` → COAL
- [ ] `IRON_ORE` → RAW_IRON
- [ ] `GOLD_ORE` → RAW_GOLD
- [ ] `DIAMOND_ORE` → DIAMOND
- [ ] `REDSTONE_ORE` → REDSTONE_DUST
- [ ] `LAPIS_ORE` → LAPIS_LAZULI
- [ ] `EMERALD_ORE` → EMERALD

**深層鉱石 (hardness 90)** — 各 [低Yで生成 / ドロップが通常鉱石と同等]
- [ ] `DEEPSLATE_COAL_ORE`
- [ ] `DEEPSLATE_IRON_ORE`
- [ ] `DEEPSLATE_GOLD_ORE`
- [ ] `DEEPSLATE_DIAMOND_ORE`
- [ ] `DEEPSLATE_REDSTONE_ORE`
- [ ] `DEEPSLATE_LAPIS_ORE`
- [ ] `DEEPSLATE_EMERALD_ORE`

**鉱物ブロック** — 各 [クラフトで生成 / 破壊→自身ドロップ / 物理]
- [ ] `COAL_BLOCK` (85)
- [ ] `IRON_BLOCK` (90)
- [ ] `GOLD_BLOCK` (80)
- [ ] `DIAMOND_BLOCK` (95)
- [ ] `REDSTONE_BLOCK` (80)
- [ ] `LAPIS_BLOCK` (80)
- [ ] `EMERALD_BLOCK`

**加工/設置物**
- **PLANKS**
  - [ ] クラフトで生成 / 設置可 / クラフト材料
- **CRAFTING_TABLE**
  - [ ] 設置 / 近接で `hasCraftingTableAccess=true` になる / 破壊→ドロップ
- **FURNACE**
  - [ ] 設置 / 近接で `hasFurnaceAccess=true` になる / 精錬UIと連動
- **TORCH**
  - [ ] 設置 / 光源として light-engine に寄与 / 描画(emissive)

### 3.2 アイテム (15種)

各アイテム [スタック上限 / ホットバー表示 / クラフト入出力 / 用途]
- [ ] `STICKS`: スタック / 各ツール・トーチの材料
- [ ] `COAL`: 燃料 / トーチ材料 / `COAL_ORE`ドロップ
- [ ] `WOODEN_SWORD`: 非スタック(要確認) / 攻撃ダメージ`WOODEN_SWORD_ATTACK_DAMAGE`
- [ ] `WOODEN_PICKAXE`: 採掘レベル(木) / 鉱石採掘可否
- [ ] `STONE_PICKAXE`: 採掘レベル(石)
- [ ] `RAW_IRON`: 精錬入力 → IRON_INGOT
- [ ] `IRON_INGOT`: ピッケル材料
- [ ] `IRON_PICKAXE`: 採掘レベル(鉄)
- [ ] `RAW_GOLD`: 精錬入力 → GOLD_INGOT
- [ ] `GOLD_INGOT`: 用途確認
- [ ] `DIAMOND`: ピッケル材料 / `DIAMOND_ORE`ドロップ
- [ ] `REDSTONE_DUST`: 回路材料(要確認) / `REDSTONE_ORE`ドロップ
- [ ] `LAPIS_LAZULI`: 用途確認
- [ ] `EMERALD`: 取引通貨 / `EMERALD_ORE`ドロップ
- [ ] `DIAMOND_PICKAXE`: 採掘レベル(ダイヤ)

### 3.3 バイオーム (12種)

各バイオーム [分類条件(temp/humidity) / surfaceBlock / subSurfaceBlock / treeDensity / 高さ特性]
- [ ] `PLAINS`: 表層GRASS想定 / 平坦 / 中treeDensity
- [ ] `DESERT`: 表層SAND / treeDensity≈0 / 乾燥(低humidity)
- [ ] `FOREST`: 高treeDensity / 樹木密集
- [ ] `OCEAN`: 海面下 / WATER充填 / 海底ブロック
- [ ] `MOUNTAINS`: 高標高 / 岩石露出
- [ ] `SNOW`: 表層SNOW / 低temperature
- [ ] `SWAMP`: 低地 / 水たまり
- [ ] `JUNGLE`: 高temp高humidity / 高treeDensity
- [ ] `BEACH`: 海岸SAND
- [ ] `RIVER`: 線状の水路
- [ ] `TAIGA`: 寒冷針葉樹
- [ ] `SAVANNA`: 高temp乾燥 / 疎林

### 3.4 レシピ (11種)

各レシピ [station / 材料が正確に消費 / 出力数 / アクセス要件 / 材料不足でRecipeError]
- inventory:
  - [ ] `wood-to-planks`: WOOD×1 → PLANKS×4 / 無条件可
  - [ ] `planks-to-sticks`: PLANKS×2 → STICKS×4
  - [ ] `planks-to-crafting-table`: PLANKS×4 → CRAFTING_TABLE×1
  - [ ] `coal-and-stick-to-torches`: COAL×1+STICKS×1 → TORCH×4 (複数材料)
- crafting_table (要 `hasCraftingTableAccess`):
  - [ ] `cobblestone-to-furnace`: COBBLESTONE×8 → FURNACE×1
  - [ ] `planks-and-sticks-to-wooden-sword`: PLANKS×2+STICKS×1 → WOODEN_SWORD×1
  - [ ] `planks-and-sticks-to-wooden-pickaxe`: PLANKS×3+STICKS×2 → WOODEN_PICKAXE×1
  - [ ] `cobblestone-and-sticks-to-stone-pickaxe`: COBBLESTONE×3+STICKS×2 → STONE_PICKAXE×1
  - [ ] `iron-ingots-and-sticks-to-iron-pickaxe`: IRON_INGOT×3+STICKS×2 → IRON_PICKAXE×1
  - [ ] `diamonds-and-sticks-to-diamond-pickaxe`: DIAMOND×3+STICKS×2 → DIAMOND_PICKAXE×1
- furnace (要 `hasFurnaceAccess`):
  - [ ] `raw-iron-to-iron-ingot`: RAW_IRON×1 → IRON_INGOT×1
  - [ ] `raw-gold-to-gold-ingot`: RAW_GOLD×1 → GOLD_INGOT×1
- 横断:
  - [ ] 出力スロット満杯時に "No space for output" エラー
  - [ ] アクセス無しで適切なエラーメッセージ(table/furnace別)
  - [ ] ⚠️ shapeless判定(本家の形状照合は未対応)

### 3.5 Mob (4種) `mobs/*.ts`

各Mob [定義値どおりのステータス / スポーン / 状態遷移 / ドロップ]
- [ ] `Zombie`: hostile / HP20 / atk3 / spd1.25 / detect16 / range1.6 / flee0.1 / drop COBBLESTONE×1
- [ ] `Cow`: passive / HP10 / atk0 / spd1.0 / detect12 / flee0.6 / drop GRASS×1
- [ ] `Pig`: passive / HP10 / atk0 / spd1.05 / detect10 / flee0.65 / drop DIRT×1
- [ ] `Sheep`: passive / HP8 / atk0 / spd0.95 / detect10 / flee0.7 / drop LEAVES×1
- [ ] ⚠️ ドロップが本家無関係(プレースホルダ疑い) → 要件確認

### 3.6 Mob AI 遷移 (5状態) `state-machine.ts`
- [ ] `Idle → Wander`
- [ ] `Wander → Chase` (hostile, detectionRange内)
- [ ] `Wander → Flee` (passive, 被弾)
- [ ] `Chase → Attack` (attackRange到達)
- [ ] `Attack → Chase/Idle` (対象離脱/範囲外)
- [ ] `* → Flee` (HP ≤ fleeHealthThreshold)

### 3.7 レッドストーン (5部品) `redstone-model.ts`
- [ ] `wire`: 信号伝播 / 距離減衰
- [ ] `lever`: トグル電源(ON維持)
- [ ] `button`: 一時電源(数tick)
- [ ] `torch`: 電源/反転
- [ ] `piston`: 信号で作動(伸縮)

### 3.8 村 `village/*`
- 構造物: [ ] `house` / [ ] `road` / [ ] `well` / [ ] `farm`
- 職業: [ ] `Farmer` / [ ] `Librarian` / [ ] `Blacksmith`
- 村人AI: [ ] `Idle`/`Wander`/`Work`/`Rest`/`Trade` 遷移

### 3.9 キーマッピング `key-mappings.ts`
- [ ] `KeyW`前進 / [ ] `KeyS`後退 / [ ] `KeyA`左 / [ ] `KeyD`右
- [ ] `Space`ジャンプ / [ ] `ControlLeft`スプリント / [ ] `ShiftRight`スニーク
- [ ] `F5`カメラ切替 / [ ] `KeyE`インベントリ / [ ] `Escape`ポーズ
- [ ] `Digit1`〜`Digit9` ホットバー(各スロット)

### 3.10 設定項目 `settings-service.ts`
- ゲーム: [ ] `renderDistance`(2-16) / [ ] `mouseSensitivity`(0.1-3.0) / [ ] `dayLengthSeconds`(120-1200) / [ ] `graphicsQuality`(low/medium/high/ultra) / [ ] `adaptivePerformanceMode` / [ ] `audioEnabled`+master/sfx/musicVolume
- ポストプロセスBool(**個別フィールド**, プリセットが設定): [ ] `shadowsEnabled` / [ ] `ssaoEnabled` / [ ] `bloomEnabled`+`bloomStrength`(0-1) / [ ] `smaaEnabled` / [ ] `skyEnabled` / [ ] `dofEnabled` / [ ] `godRaysEnabled`+`godRaysSamples`(0-40)
- 性能: [ ] `refractionThrottleFrames`(0-5) / [ ] `refractionMinScreenRatio`(0-1) / [ ] `pixelRatioCap`(0.5-2) / [ ] `composerRtType`(1009/1016) / [ ] `useCompositePass`

### 3.11 ポストプロセス pass (順序) `session-post-processing.ts`
- [ ] RenderPass / [ ] GTAOPass(ssao) / [ ] GodRaysPass / [ ] UnrealBloomPass / [ ] BokehPass(dof) / [ ] SMAAPass / [ ] OutputPass
- [ ] CompositePass経路(FR-4.3) / [ ] 屈折gating(FR-4.4)

---

## 4. 機能ユニット 詳細チェックリスト

### グループA: 地形生成・レンダリング

#### A1. チャンクワールド生成
**① コードベース**
- 正常系: [ ] continentalness/erosion/peaks-valleys がspline合成され高さ決定
- 正常系: [ ] SEA_LEVEL=48 / LAKE_LEVEL=62 が適用
- 境界: [ ] チャンク境界(x/z=±16)で高さ・ブロックが連続
- 境界: [ ] 最下層BEDROCK / 最上層が範囲内
- 異常: [ ] 未生成チャンク参照時にエラーでなく生成 or Optionで処理
- 決定論: [ ] 同一シードで同じ地形
**② 公式差分**
- [ ] 本家: 3Dノイズ+carverで洞窟 / 実装: 洞窟有無を確認 / 分類: ___
- [ ] 本家: バイオーム境界をブレンド / 実装: ハード境界か / 分類: ___
**③ Playwright** (`new-world-regression.e2e.ts`)
- [ ] 1. 新規ワールド起動しローディング完了待ち
- [ ] 2. `getRenderingSnapshot()` 取得
- [ ] 3. `chunkMeshCount > 0` をアサート
- [ ] 4. プレイヤー周辺チャンクのメッシュ存在を確認
**④ 非機能**
- [ ] 同時生成4 fiber上限 / [ ] LRUでメモリ上限 / [ ] 生成中フレーム落ち無し

#### A2. ブロックメッシュ描画 (greedy)
**① コードベース**
- 正常系: [ ] 6方向グリーディ統合で隣接同種面が1quad化
- 正常系: [ ] 隣接opaque面がカリングされる
- 境界: [ ] チャンク端の面が隣接チャンク考慮で生成/カリング
- 境界: [ ] 全AIRチャンクで indexCount=0
- 異常: [ ] サブリージョン再メッシュが部分範囲のみ更新
**② 公式差分**
- [ ] 本家: 頂点AO有り / 実装: AO有無 / 分類: ___
- [ ] 本家: テクスチャアトラス+mipmap / 実装: tileIndex方式 / 分類: ___
**③ Playwright**
- [ ] 1. ワールド起動 → `getRenderingSnapshot()`
- [ ] 2. `indexCount > 0` / `hasUv===true` / `hasTileIndex===true`
**④ 非機能**
- [ ] `getBlock()` bounds-checkインライン(Option割当回避) / [ ] worker poolで非ブロッキング

#### A3. 水/透過ブロック描画
**① コードベース**
- 正常系: [ ] `TRANSPARENT_BLOCK_IDS` で opaque/water メッシュ分離
- 正常系: [ ] water が半透明マテリアルで描画
- 正常系: [ ] 屈折uniform(uTime/uRefractionMap/uResolution/uCameraPosition)設定
- 境界: [ ] 水が無いチャンクで waterMesh=null
**② 公式差分**
- [ ] 本家: 水流レベル7→0 / 実装: 流体D3と連動 / 分類: ___
- [ ] 本家: 水中フォグ / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. OCEAN/湖付近へ移動 or staging
- [ ] 2. `getLoadedWaterBlockCount() > 0` をアサート
**④ 非機能**
- [ ] 屈折gating(FR-4.4)で非表示時に屈折描画スキップ

#### A4. 距離LOD簡略化
**① コードベース**
- 正常系: [ ] 距離しきい値でメッシュ簡略化選択(FR-3.1/3.2)
- 境界: [ ] 近距離は最高詳細
- 境界: [ ] しきい値境界で詳細/簡略が切替
**② 公式差分**
- [ ] 本家: ブロックLODなし / 実装: 独自最適化 / 分類: 意図的拡張
**③ Playwright**
- [ ] 1. 近距離/遠距離チャンクの `getRenderingSnapshot().indexCount` を比較
- [ ] 2. 遠距離 < 近距離 をアサート
**④ 非機能**
- [ ] LOD有効でFPS改善 / [ ] ポップイン許容範囲

#### A5. ポストプロセス合成
**① コードベース**
- 正常系: [ ] §3.11 順序で composer 構成
- 正常系: [ ] CompositePass経路(FR-4.3)動作
- 境界: [ ] 各passが対応Boolトグルで有効/無効
**② 公式差分**
- [ ] 本家: Vanillaに無し / 実装: シェーダ相当 / 分類: 意図的拡張
**③ Playwright** (`settings-overlay.e2e.ts`)
- [ ] 1. 設定で graphicsQuality を low→ultra
- [ ] 2. `getRenderingSnapshot()` で pass有効状態の変化をアサート
**④ 非機能**
- [ ] プリセット別FPSしきい値達成(`perf-target.e2e.ts`)

#### A6. 物理スカイ/昼夜照明
**① コードベース**
- 正常系: [ ] `setDayLength(sec)` → `setTimeOfDay(0.5)`(正午)で初期化
- 正常系: [ ] 時刻進行で太陽方向/ライト色が変化
- 境界: [ ] `skyEnabled=false` で Sky破棄・`effectiveLights.sky=null`
- 境界: [ ] dayLengthSeconds 最小120/最大1200 で破綻しない
**② 公式差分**
- [ ] 本家: 1日=20分(24000tick) / 実装: dayLengthSeconds可変 / 分類: ___
- [ ] 本家: 月相/星空 / 実装: 有無 / 分類: ___
**③ Playwright** (`lighting-entities.e2e.ts`)
- [ ] 1. `timeService` で時刻を進める(QA経由)
- [ ] 2. ライト方向/色の変化を観測
**④ 非機能**
- [ ] sky無効時の負荷削減

### グループB: ゲームループ・入力・物理

#### B1. フレームループ / deltaTime cap
**① コードベース**
- 境界: [ ] `raw < 0.001` → 0.001 にクランプ
- 境界: [ ] `raw > 0.05` → 0.05 にクランプ
- 正常系: [ ] 0.001〜0.05 は素通り
- 境界: [ ] 初回フレーム delta = 0.016
- 異常: [ ] NaN/負値の扱い(要確認)
- 正常系: [ ] `Effect.forever`+`Queue.take` でループ
- 正常系: [ ] `Fiber.interrupt` で stop() が停止
- 正常系: [ ] 多段ステージが順次実行・キャンセル可能(FR-1.1)
**② 公式差分**
- [ ] 本家: 固定20tick / 実装: 可変+cap近似 / 分類: 意図的
**③ Playwright** (`long-run-stability.e2e.ts`)
- [ ] 1. ゲームを長時間放置(規定秒)
- [ ] 2. コンソールエラー無し / クラッシュ無しをアサート
**④ 非機能**
- [ ] frame-budget超過検出 / [ ] ステージ別ベースライン(`perf-stage-baseline.e2e.ts`)

#### B2. 一人称カメラ
**① コードベース**
- 境界: [ ] pitch を +90°で上限クランプ
- 境界: [ ] pitch を -90°で下限クランプ
- 正常系: [ ] yaw が360°連続(ラップ)
- 正常系: [ ] CameraRotationPort経由(THREE非依存)
- 正常系: [ ] mouseSensitivity が回転量に比例
**② 公式差分**
- [ ] 本家: FOV/感度カーブ / 実装: 線形か / 分類: ___
**③ Playwright**
- [ ] 1. (ポインタロック不可)`playerCameraState` に角度を直接注入
- [ ] 2. `camera` の rotation が反映されたことを確認
**④ 非機能**
- [ ] 毎フレーム回転更新が軽量

#### B3. 三人称カメラ切替 (F5)
**① コードベース**
- 正常系: [ ] F5 で first→third→first
- 正常系: [ ] 三人称でカメラがプレイヤー背後
- 境界: [ ] 壁越しでカメラ距離が縮む(クリップ回避)
**② 公式差分**
- [ ] 本家: 背面/正面/前面の3モード / 実装: モード数 / 分類: ___
**③ Playwright** (`player-controls.e2e.ts`)
- [ ] 1. `browser_press_key('F5')`
- [ ] 2. カメラモード状態が変化したことを確認
**④ 非機能**
- [ ] 切替時にフレーム落ち無し

#### B4. WASD移動
**① コードベース**
- 正常系: [ ] W前進 / S後退 / A左 / D右
- 正常系: [ ] 移動方向がカメラyaw基準
- 境界: [ ] 斜め(W+D)で速度が正規化され過大化しない
- 異常: [ ] 相反キー(W+S)同時で停止 or 一方優先
**② 公式差分**
- [ ] 本家: 加速/慣性あり / 実装: 即時速度か / 分類: ___
**③ Playwright** (`player-controls.e2e.ts`)
- [ ] 1. 初期位置を記録
- [ ] 2. `KeyW` を一定時間押下
- [ ] 3. player.z(前方)が変化したことをアサート
**④ 非機能**
- [ ] 入力遅延が小さい

#### B5. ジャンプ
**① コードベース**
- 正常系: [ ] 接地時に Space で上向き初速
- 境界: [ ] 空中で Space → 再ジャンプ不可
- 正常系: [ ] 重力で放物落下し再接地
**② 公式差分**
- [ ] 本家: ジャンプ高≈1.25ブロック / 実装: 高さ / 分類: ___
**③ Playwright**
- [ ] 1. 接地確認 → `Space` 押下
- [ ] 2. y が上昇後下降して元高度付近に戻る

#### B6. スプリント/スニーク
**① コードベース**
- 正常系: [ ] ControlLeft で速度増加
- 正常系: [ ] ShiftRight で速度減少
- 境界: [ ] sprint+sneak同時の優先順位(要確認)
**② 公式差分**
- [ ] 本家: sneakは縁から落ちない / 実装: 有無 / 分類: ___
- [ ] 本家: sprintでFOV変化 / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. 通常移動距離を計測 → 2. sprint移動距離を計測 → 3. sprint>通常をアサート

#### B7. 重力・落下・AABB衝突
**① コードベース**
- 正常系: [ ] Euler積分で速度→位置更新
- 正常系: [ ] `step(deltaTime)` 単一引数
- 正常系: [ ] AABB-vs-plane 衝突解決
- 正常系: [ ] CustomShape box/sphere/plane が `Match.exhaustive`
- 境界: [ ] 大deltaでも貫通しない(B8と連携)
**② 公式差分**
- [ ] 本家: 終端速度/落下ダメージ / 実装: 有無 / 分類: ___
- [ ] 本家: 0.5ブロック自動ステップ / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. 空中スポーン → 2. 落下を観測 → 3. 地表で停止(y安定)をアサート
**④ 非機能**
- [ ] deltaTime capでトンネリング防止(B8)

#### B8. 地面クランプ / トンネリング防止
**① コードベース**
- 正常系: [ ] `physicsService.step()` 後に `resolveBlockCollisions`
- 正常系: [ ] `isBlockSolid` でソリッド判定
- 正常系: [ ] 物理面 `surfaceY+1` / スポーン `surfaceY+1+3`
- 境界: [ ] [y, y+1]立方体と物理面が整合
**② 公式差分**
- [ ] 本家: 高速落下でも床貫通せず / 実装: 同等 / 分類: 一致目標
**③ Playwright** (`long-run-stability.e2e.ts`)
- [ ] 1. 高所からスポーン → 2. 長時間放置 → 3. y座標が地表で安定・すり抜け無し

### グループC: ブロック操作

#### C1. ブロック破壊 (左クリック)
**① コードベース**
- 正常系: [ ] レイキャストでヒットブロック取得
- 正常系: [ ] ヒットを AIR に置換
- 正常系: [ ] 適合ツール時ドロップをインベントリ追加
- 異常: [ ] ヒット無し(空振り)で何も起きない
- 境界: [ ] 最大到達距離外は破壊不可
- 境界: [ ] BEDROCK破壊不可(要確認)
- 正常系: [ ] サブリージョン再メッシュ
**② 公式差分**
- [ ] 本家: 破壊時間=hardness×ツール / 実装: 即時 or 計測 / 分類: ___
- [ ] 本家: 不適合ツールはドロップ無し&減速 / 実装: ドロップ無しのみか / 分類: ___
**③ Playwright** (`block-interaction.e2e.ts`)
- [ ] 1. `clearBlocksInFront()` で前方を整地
- [ ] 2. 対象ブロックに `aimAtStagedResource(0)` 等で照準
- [ ] 3. `dispatchMouseClick(0)` 実行
- [ ] 4. `getCurrentTargetForQA()` で対象が AIR 化を確認
- [ ] 5. `getInventorySnapshot()` でドロップ反映を確認
**④ 非機能**
- [ ] 全再生成でなく差分メッシュ

#### C2. ブロック設置 (右クリック)
**① コードベース**
- 正常系: [ ] ヒット面の隣接セルへ設置
- 正常系: [ ] 選択ホットバーアイテムが置かれる
- 正常系: [ ] インベントリが1消費
- 異常: [ ] 選択スロット空で設置不可
- 境界: [ ] プレイヤー占有セルに設置しない
- 境界: [ ] 既存ブロック上書きしない
**② 公式差分**
- [ ] 本家: 置けない面/向き判定 / 実装: 判定範囲 / 分類: ___
**③ Playwright** (`progression-loop.e2e.ts`)
- [ ] 1. `stageBuildSupportBlock()` で足場準備
- [ ] 2. `aimAtBuildSpot()` で照準
- [ ] 3. ホットバーに設置アイテムを `moveItemToHotbar()` + `selectHotbarSlot()`
- [ ] 4. `placeSelectedItemInFront()` 実行
- [ ] 5. `getCurrentTargetForQA()` で新ブロック出現を確認
- [ ] 6. `getInventorySnapshot()` で個数-1を確認

#### C3. ブロックハイライト/レイキャスト
**① コードベース**
- 正常系: [ ] `Ref<HitState>`(target+hit)原子更新
- 正常系: [ ] ヒット面法線を算出
- 境界: [ ] maxDistanceで打ち切り(到達外はhit無し)
- 異常: [ ] AIRはヒット対象外
**② 公式差分**
- [ ] 本家: リーチ≈4.5ブロック / 実装: maxDistance値 / 分類: ___
**③ Playwright**
- [ ] 1. ブロックに照準 → 2. `getCurrentTargetForQA()` が blockX/Y/Z/distance/maxDistance を返す
- [ ] 3. 遠距離で target が null/空になることを確認
**④ 非機能**
- [ ] 毎フレームのレイキャストが軽量

#### C4. ツール適合・採掘可否
**① コードベース**
- 正常系: [ ] ピッケル種別×鉱石で harvestable 判定
- 境界: [ ] 木ピッケルで鉄鉱石→不可(要確認の階層)
- 異常: [ ] 不適合ツールでドロップ無し
- 正常系: [ ] 適合ツールで正しいドロップ
**② 公式差分**
- [ ] 本家: 採掘レベル 木<石<鉄<ダイヤ / 実装: 階層一致 / 分類: ___
- [ ] 本家: silk touch/fortune / 実装: 対象外 / 分類: 意図的省略
**③ Playwright**
- [ ] 1. 不適合ツール装備で鉱石破壊 → ドロップ無しを確認
- [ ] 2. 適合ツール装備で破壊 → ドロップ有りを確認

### グループD: 地形・環境

#### D1. バイオーム分類
**① コードベース**
- 正常系: [ ] temp/humidity から §3.3 の12種に分類
- 正常系: [ ] surface/subSurfaceBlock が適用
- 境界: [ ] treeDensity/temperature/humidity が 0〜1 範囲(Schema検証)
- 境界: [ ] 分類しきい値の境界で安定
**② 公式差分**
- [ ] 本家: より多数のバイオーム / 実装: 12種 / 分類: 意図的縮小
- [ ] 本家: 境界ブレンド / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. 複数チャンクを探索/staging → 2. 異なる表層ブロックを観測
**④ 非機能**
- [ ] 純関数で決定論的(`biome-classifier.test.ts`)

#### D2. 鉱石分布
**① コードベース**
- 正常系: [ ] §3.1 の7鉱石+7深層が生成
- 境界: [ ] 深さしきい値で通常/深層が切替
**② 公式差分**
- [ ] 本家: 鉱石別高度分布 / 実装: 分布ロジック / 分類: ___
- [ ] 本家: 鉱脈クラスタ / 実装: 単体散布か / 分類: ___
**③ Playwright**
- [ ] 1. 地下チャンクを生成 → 2. 各鉱石typeの出現を確認

#### D3. 流体シミュレーション
**① コードベース**
- 正常系: [ ] 水が隣接セルへ伝播
- 正常系: [ ] 流体レベルが減衰
- 境界: [ ] tick budgetで1フレーム処理量を制限
- 異常: [ ] 閉空間で無限増殖しない
**② 公式差分**
- [ ] 本家: 水平7→0減衰/無限水源 / 実装: 挙動 / 分類: ___
- [ ] 本家: LAVA流体 / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. 水隣接ブロックを破壊 → 2. `getLoadedWaterBlockCount()` の変化を観測
**④ 非機能**
- [ ] tick予算超過でフレーム落ち無し

#### D4. 光伝播
**① コードベース**
- 正常系: [ ] 太陽光フラッドフィル
- 正常系: [ ] TORCH等ブロック光フラッドフィル
- 境界: [ ] チャンク跨ぎを境界レポート(FR-3.5)で処理
- 境界: [ ] 光源除去で減衰が伝播
**② 公式差分**
- [ ] 本家: light level 0-15, skylight/blocklight分離 / 実装: 一致度 / 分類: ___
**③ Playwright** (`lighting-entities.e2e.ts`)
- [ ] 1. 暗所で TORCH 設置 → 2. 周辺メッシュ/snapshotが明るくなることを確認
**④ 非機能**
- [ ] 差分計算で全再計算回避

#### D5. 樹木生成
**① コードベース**
- 正常系: [ ] treeDensity に応じ WOOD+LEAVES 配置
- 境界: [ ] DESERT(density≈0)で樹木ほぼ無し
**② 公式差分**
- [ ] 本家: 樹種/形状多様 / 実装: 単一形状か / 分類: ___
**③ Playwright**
- [ ] 1. FOREST/JUNGLE 探索 → 2. WOODブロック出現を確認

### グループE: インベントリ・クラフト

#### E1. インベントリ開閉 (E)
**① コードベース**
- 正常系: [ ] E でオーバーレイ表示
- 正常系: [ ] 再度 E で非表示
- 正常系: [ ] 開時にポインタロック解除
- 正常系: [ ] DOM一回生成(`const`)で再生成しない
**② 公式差分**
- [ ] 本家: 27+9スロット / 実装: スロット数 / 分類: ___
**③ Playwright** (`inventory-overlay.e2e.ts`)
- [ ] 1. `openInventoryForQA()` が true
- [ ] 2. オーバーレイDOMが可視
- [ ] 3. 再呼び出しで非表示

#### E2. アイテムスタック/移動
**① コードベース**
- 境界: [ ] maxStack=64 で打ち止め(65個目は別スロット)
- 正常系: [ ] 同種が統合される
- 正常系: [ ] スロット間移動が不変更新
- 異常: [ ] 空スロットからの移動は no-op
**② 公式差分**
- [ ] 本家: ツール等は非スタック(max1) / 実装: 個別上限 / 分類: ___
**③ Playwright** (`inventory-management.e2e.ts`)
- [ ] 1. `getInventorySnapshot()` 初期状態取得
- [ ] 2. `moveItemToHotbar(item, idx)` が true
- [ ] 3. 再取得し count/slot 変化を確認

#### E3. ホットバー選択 (1-9)
**① コードベース**
- 正常系: [ ] Digit1〜9 で選択スロット変更
- 境界: [ ] スロット0と8(端)が選択可
- 正常系: [ ] HUDハイライト追従
- 正常系: [ ] `SlotIndex` ブランド型で扱う
**② 公式差分**
- [ ] 本家: マウスホイール選択 / 実装: 有無 / 分類: ___
**③ Playwright** (`hud.e2e.ts`)
- [ ] 1. `selectHotbarSlot(3)` → 2. HUDの該当スロットが強調
**④ 非機能**
- [ ] resize callbackの `Effect.runSync` は意図的例外

#### E4. クラフト (インベントリ)
**① コードベース**
- 正常系: [ ] station='inventory' は無条件可
- 正常系: [ ] 材料が事前チェック後に消費
- 正常系: [ ] 出力がインベントリ追加
- 異常: [ ] 材料不足で RecipeError("Insufficient...")
- 異常: [ ] 出力満杯で RecipeError("No space")
- 異常: [ ] 未知IDで RecipeError("not found")
**② 公式差分**
- [ ] 本家: 2x2 shaped配置 / 実装: shapeless集合 / 分類: 意図的簡略化
**③ Playwright**
- [ ] 1. WOODを所持(stage) → 2. `craftRecipeForQA('wood-to-planks')`
- [ ] 3. `getInventorySnapshot()` で PLANKS+4 / WOOD-1 を確認

#### E5. クラフト (作業台)
**① コードベース**
- 正常系: [ ] station='crafting_table' は `hasCraftingTableAccess` 必須
- 異常: [ ] アクセス無しで RecipeError("requires a crafting table")
**② 公式差分**
- [ ] 本家: 3x3 shaped照合 / 実装: shapeless / 分類: 意図的簡略化
**③ Playwright** (`inventory-management.e2e.ts`)
- [ ] 1. `getRecipeButtons()` に作業台レシピが含まれる
- [ ] 2. 材料を stage → `craftRecipeForQA('planks-and-sticks-to-wooden-pickaxe')`
- [ ] 3. WOODEN_PICKAXE が増加

#### E6. かまど精錬
**① コードベース**
- 正常系: [ ] 入力+燃料(COAL)で精錬開始
- 正常系: [ ] tick経過で出力生成(RAW_IRON→IRON_INGOT)
- 正常系: [ ] 燃料が消費される
- 境界: [ ] 燃料切れで精錬停止
- 異常: [ ] `hasFurnaceAccess` 無しでエラー
**② 公式差分**
- [ ] 本家: 精錬10s/燃料燃焼時間 / 実装: tick数 / 分類: ___
- [ ] 本家: 精錬で経験値 / 実装: 対象外 / 分類: 意図的省略
**③ Playwright**
- [ ] 1. `furnaceService` で RAW_IRON+COAL 投入
- [ ] 2. 時間を進める
- [ ] 3. 出力スロットに IRON_INGOT を確認
**④ 非機能**
- [ ] 精錬 tick budget

### グループF: 体力・戦闘

#### F1. 体力システム
**① コードベース**
- 正常系: [ ] current/max を管理
- 境界: [ ] current が max を超えない / 0未満にならない
- 正常系: [ ] invincibilityTicks 中は再被弾しない
- 境界: [ ] invincibilityTicks が0になると再被弾可
**② 公式差分**
- [ ] 本家: 20HP / 実装: max値 / 分類: ___
- [ ] 本家: 空腹で自然回復 / 実装: 空腹無(F4) / 分類: 未実装依存
**③ Playwright**
- [ ] 1. ダメージを与える → 2. HP snapshot が減少
**④ 非機能**
- [ ] invincibilityTicks の経過処理

#### F2. ダメージ/死亡画面
**① コードベース**
- 境界: [ ] HP≤0 で death-screen 表示
- 正常系: [ ] リスポーンでHP回復・位置リセット
**② 公式差分**
- [ ] 本家: 落下/溺水/溶岩ダメージ / 実装: 網羅状況 / 分類: ___
**③ Playwright**
- [ ] 1. HPを0にする → 2. death-screen DOM出現を確認 → 3. リスポーン操作
**④ 非機能**
- [ ] death-screen z-index がオーバーレイ上

#### F3. 近接攻撃
**① コードベース**
- 正常系: [ ] 素手 `PLAYER_ATTACK_DAMAGE`
- 正常系: [ ] 剣装備 `WOODEN_SWORD_ATTACK_DAMAGE`
- 正常系: [ ] ターゲティングで最寄りMob選択
- 境界: [ ] attackRange外は当たらない
- 正常系: [ ] ダメージでMob HP減少→撃破
**② 公式差分**
- [ ] 本家: 攻撃クールダウン / 実装: 有無 / 分類: ___
- [ ] 本家: ノックバック / 実装: 有無 / 分類: ___
**③ Playwright** (`lighting-entities.e2e.ts`)
- [ ] 1. `spawnLowHealthZombieInFront()`
- [ ] 2. `aimAtStagedZombie()`
- [ ] 3. `attackFirstZombie()` が true(撃破)
- [ ] 4. `getEntitySnapshot()` でzombie消滅を確認

#### F4. 空腹システム — ❌ 未実装の疑い
**① コードベース**
- [ ] hunger/saturation フィールドの存在を確認(現状 `player-health.ts` に**無し**)
**② 公式差分**
- [ ] 本家: 空腹ゲージ20/満腹度で回復 / 実装: 無 / 分類: **未実装**
- [ ] `phase/11-health-hunger.md` 要件との差を記録
> ③④: 実装が無ければ対象外。追加実装 or 要件削除を判断。

### グループG: エンティティ

#### G1. Mobスポーン
**① コードベース**
- 正常系: [ ] §3.5 の4種が定義どおり生成
- 境界: [ ] 湧き条件(時間/明るさ)で抑制/許可
- 境界: [ ] 湧き上限で増殖停止
- 異常: [ ] 非ソリッド地形に湧かない
**② 公式差分**
- [ ] 本家: zombie=暗所湧き等 / 実装: 条件 / 分類: ___
- [ ] 本家: デスポーン距離/時間 / 実装: 有無 / 分類: ___
**③ Playwright** (`lighting-entities.e2e.ts`)
- [ ] 1. スポーン条件を整える(staging)
- [ ] 2. `getEntitySnapshot()` に各typeが出現
**④ 非機能**
- [ ] エンティティ数に対する更新コスト

#### G2. Mob AI状態機械
**① コードベース**
- 正常系: [ ] §3.6 の各遷移が成立
- 境界: [ ] detectionRange境界でChase開始/解除
- 境界: [ ] HP=fleeHealthThreshold ちょうどでFlee
- 異常: [ ] 対象消失でChase→Idleに戻る
**② 公式差分**
- [ ] 本家: A*経路探索 / 実装: 直進/簡易か / 分類: ___
- [ ] 本家: 視線(line of sight)判定 / 実装: 距離のみか / 分類: ___
**③ Playwright**
- [ ] 1. zombie をstage → 2. `getMobMovementSnapshot()` で状態/位置の時系列変化を観測
**④ 非機能**
- [ ] 多数エンティティで安定(`long-run-stability.e2e.ts`)

#### G3. Mobドロップ
**① コードベース**
- 正常系: [ ] 撃破時に §3.5 のドロップ生成
- 異常: [ ] 自然死/デスポーンでドロップ有無
**② 公式差分**
- [ ] 本家: mob別ドロップ(zombie→rotten flesh等) / 実装: COBBLESTONE等 / 分類: **要確認(プレースホルダ疑い)**
- [ ] 本家: ドロップ確率/レアドロップ / 実装: 固定数か / 分類: ___
**③ Playwright**
- [ ] 1. Mob撃破 → 2. ドロップ/インベントリ増加を確認

#### G4. 村/構造物生成
**① コードベース**
- 正常系: [ ] §3.8 構造物4種が生成
- 正常系: [ ] 職業3種の村人配置
- 正常系: [ ] 村人AI 5状態が遷移
- 境界: [ ] 地形に適合配置(水中/崖に建てない)
**② 公式差分**
- [ ] 本家: 村レイアウト/職業ブロック / 実装: 生成ロジック / 分類: ___
**③ Playwright**
- [ ] 1. 村生成シナリオ実行 → 2. 構造物/村人の出現を確認
**④ 非機能**
- [ ] 構造物生成コスト(`village-simulation.config.ts`)

#### G5. 村人取引
**① コードベース**
- 正常系: [ ] 取引オファー(EMERALD等)提示
- 正常系: [ ] 取引で在庫減少→再補充
- 異常: [ ] 通貨不足で取引不可
**② 公式差分**
- [ ] 本家: 職業別取引/需給価格変動/解放レベル / 実装: 範囲 / 分類: ___
**③ Playwright**
- [ ] 1. 取引UI表示 → 2. 提供→受領 → 3. インベントリ反映を確認

#### G6. レッドストーン回路
**① コードベース**
- 正常系: [ ] §3.7 の5部品が機能
- 正常系: [ ] lever/button が電源
- 正常系: [ ] wire が伝播・減衰
- 正常系: [ ] piston が信号で作動
- 境界: [ ] 信号強度0で停止
**② 公式差分**
- [ ] 本家: 信号0-15減衰 / 実装: 減衰式 / 分類: ___
- [ ] 本家: tick遅延/piston押出 / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. lever ON → 2. wire伝播 → 3. piston反応を確認(`interaction-redstone-handler.ts`)
**④ 非機能**
- [ ] 回路規模に対するtickコスト

### グループH: オーディオ

#### H1. 効果音 (SE)
**① コードベース**
- 正常系: [ ] AudioEnginePort経由(THREE非依存)
- 正常系: [ ] 設置/破壊/攻撃でSE発火
- 正常系: [ ] sfxVolume が音量反映
- 境界: [ ] audioEnabled=false で無音
**② 公式差分**
- [ ] 本家: ブロック別足音/破壊音 / 実装: 種別差 / 分類: ___
**③ Playwright** (`settings-overlay.e2e.ts`)
- [ ] 1. audioEnabled=true → 2. イベントでSE発火(モックport観測)
**④ 非機能**
- [ ] audioEnabled=false で完全無音

#### H2. BGM
**① コードベース**
- 正常系: [ ] トラック切替
- 正常系: [ ] musicVolume 反映
**② 公式差分**
- [ ] 本家: 状況別BGM(昼/夜/戦闘) / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. master/musicVolume を変更 → 2. 反映を確認

### グループI: 永続化・メニュー

#### I1. ワールド保存/読込
**① コードベース**
- 正常系: [ ] IndexedDB DB名 `'minecraft-worlds'`
- 正常系: [ ] チャンク永続化
- 正常系: [ ] インベントリ永続化
- 正常系: [ ] プレイヤー状態永続化
- 正常系: [ ] block-codec でエンコード/デコード
- 異常: [ ] 破損データ読込時のフォールバック
**② 公式差分**
- [ ] 本家: region(.mca)形式/複数ワールド / 実装: IDB / 分類: ___
**③ Playwright** (`save-load.e2e.ts`)
- [ ] 1. ブロックを変更 → 2. 保存 → 3. リロード → 4. 変更が復元
- [ ] 5. `db-helpers.ts` でDBレコードを直接検査
**④ 非機能**
- [ ] 保存サイズ/圧縮効率

#### I2. 自動保存 (5s)
**① コードベース**
- 正常系: [ ] `Effect.forkDaemon(Effect.repeat(..., Schedule.spaced(5s)))`
- 境界: [ ] spaced でタブ復帰時にburstしない
**② 公式差分**
- [ ] 本家: オートセーブ間隔 / 実装: 5s / 分類: ___
**③ Playwright** (`save-load.e2e.ts`)
- [ ] 1. 変更 → 2. 5s待機 → 3. DB更新を確認(明示保存なし)
**④ 非機能**
- [ ] 保存中フレーム落ち無し

#### I3. メインメニュー
**① コードベース**
- 正常系: [ ] New/Load/Settings ボタン機能
- 境界: [ ] confirmダイアログ z-index がメニュー上(既存修正済)
**③ Playwright** (`main-menu.e2e.ts`)
- [ ] 1. メニュー表示 → 2. 各ボタンの表示と遷移を確認

#### I4. 設定オーバーレイ
**① コードベース**
- 正常系: [ ] §3.10 の各設定が読み書き
- 正常系: [ ] プリセット選択で§3.10 Bool群を一括設定
- 正常系: [ ] `Schema.decodeUnknown` で検証(不正値拒否)
- 境界: [ ] 各数値が範囲外でデコード失敗
**② 公式差分**
- [ ] 本家: 設定項目網羅 / 実装: 範囲 / 分類: ___
- [ ] UIラベル "Ambient Occlusion (GTAO)"
**③ Playwright** (`settings-overlay.e2e.ts`)
- [ ] 1. プリセット切替 → 2. `getRenderingSnapshot()`/pass状態の変化を確認
**④ 非機能**
- [ ] adaptivePerformanceMode で自動品質調整

#### I5. ポーズメニュー
**① コードベース**
- 正常系: [ ] Esc でポーズ表示
- 正常系: [ ] ループ一時停止/再開
**③ Playwright**
- [ ] 1. `Escape` 押下 → 2. ポーズUI表示 → 3. 再開操作

#### I6. ローディング画面
**① コードベース**
- 正常系: [ ] 初期生成中に進捗表示
- 正常系: [ ] 完了で消去
**③ Playwright** (`loading-screen.e2e.ts`, `boot.e2e.ts`)
- [ ] 1. 起動 → 2. ローディング表示 → 3. 消滅を確認
**④ 非機能**
- [ ] 初期ロード時間(`production-smoke.e2e.ts`)

### グループJ: ゲームモード

#### J1. ゲームモード切替
**① コードベース**
- 正常系: [ ] survival/creative 切替
- 境界: [ ] creative でブロック消費しない(要確認)
- 境界: [ ] creative で無敵(要確認)
**② 公式差分**
- [ ] 本家: adventure/spectator / 実装: 対象外 / 分類: 意図的省略
- [ ] 本家: creative飛行 / 実装: 有無 / 分類: ___
**③ Playwright**
- [ ] 1. survivalでブロック設置→個数減を確認
- [ ] 2. creativeに切替→個数不変を確認

---

## 5. 検証の進め方
- [ ] 要件ギャップ(①②)を先行確定(`F4 空腹`/`G3 ドロップ`等)
- [ ] `pnpm vitest run` のテストとユニットを紐付け
- [ ] QAフックで③を実機検証、未カバーは新規E2E起票
- [ ] ④を perf系E2Eのしきい値と照合
- [ ] チェックを `- [x]` 更新、NGは ❌所見+Issue化

## 6. 既知の注意点
- ポインタロックはheadless不可 → カメラ(B2)は角度直接注入。
- `effect-vitest` のDOMフローtestは `it.effect`/`it.scoped` でデッドロック → プレーン `it`+`Effect.runPromise`。
- ベースライン: `pnpm vitest run` = 3385 passing/292 files、`tsc --noEmit` = 0 errors、E2E port 5180(SwiftShader)。
- `craft` は非トランザクション(check→remove間の競合で不整合の可能性／コード内コメント済)。
- Mobドロップ(§3.5)が本家無関係 → プレースホルダ疑い。
- 設定の post-process Bool群は独立フィールドとして実在(プリセットが各値を設定する構造)。
